import { SOURCES } from './config/sources';
import { enrichBatch } from './enrich/enrich';
import { RateLimitError, TransientError } from './enrich/gemini';
import { photoSourceFromEnv } from './enrich/photos';
import { IMAGE_TOPICS } from './data/imageTopics';
import { dedupeList, titleTokens } from './ingest/dedupe';
import { collectSource } from './pipeline';
import {
  existingIds, getPhotoCache, getSourceStates, recentTopics, releaseLease, savePhotos, saveSourceState, topicsToRefresh, insertStories, leasePending, markFailed, queryFeed, recentTitles, saveEnrichment,
} from './store/db';
import { CATEGORIES } from './types';

export interface Env {
  DB: D1Database;
  SELF?: Fetcher;
  GEMINI_API_KEY: string;
  /** Optional photo keys (free). Without either, cards show the coloured banner only. */
  UNSPLASH_ACCESS_KEY?: string;
  PEXELS_API_KEY?: string;
  /** Minutes between photo refresh runs and topics per run (Unsplash demo keys allow 50 requests/hour). */
  IMAGE_REFRESH_EVERY_MIN?: string;
  IMAGE_TOPICS_PER_RUN?: string;
  INTERNAL_KEY: string;
  GEMINI_MODEL: string;
  GEMINI_FALLBACK_MODEL?: string;
  MAX_AGE_HOURS: string;
  ENRICH_BATCH_SIZE: string;
  ENRICH_BATCHES_PER_TICK: string;
}

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...extra },
  });

export default {
  /** Cron: fan out one invocation per due feed, plus a few AI batches. */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = Date.now();
    if (!env.INTERNAL_KEY) console.error('INTERNAL_KEY secret is not set: internal jobs will be rejected');
    if (!env.GEMINI_API_KEY) console.error('GEMINI_API_KEY secret is not set: no AI summaries');
    const states = await getSourceStates(env.DB);
    const due = SOURCES.filter((s) => {
      if (!s.enabled) return false;
      const st = states.get(s.id);
      // Back off failing feeds: wait longer after each consecutive failure (max 1h).
      const backoff = Math.min(60, s.pollMinutes * 2 ** Math.min(st?.consecutive_failures ?? 0, 5));
      return !st || now - st.last_fetch_at >= backoff * 60_000 - 15_000;
    });
    const batches = Number(env.ENRICH_BATCHES_PER_TICK) || 3;
    const jobs = [
      ...due.map((s) => `/internal/ingest/${s.id}`),
      ...Array.from({ length: batches }, () => '/internal/enrich'),
      ...(imagesDue(env, states, now) ? ['/internal/images'] : []),
    ];
    console.log(`cron: ${due.length} feeds due, ${batches} AI batches`);
    ctx.waitUntil(
      Promise.allSettled(jobs.map((path) => runJob(env, path))).then((results) => {
        const failed = results.filter((r) => r.status === 'rejected');
        console.log(`cron: ${results.length - failed.length}/${results.length} jobs ok`);
        for (const f of failed) console.error('cron job failed:', String((f as PromiseRejectedResult).reason));
      }),
    );
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.startsWith('/internal/')) {
      if (!env.INTERNAL_KEY || req.headers.get('x-internal-key') !== env.INTERNAL_KEY) return json({ error: 'forbidden' }, 403);
      if (path.startsWith('/internal/ingest/')) return json(await ingestOne(env, path.slice('/internal/ingest/'.length)));
      if (path === '/internal/enrich') return json(await enrichOnce(env));
      if (path === '/internal/images') return json(await refreshImages(env));
      return json({ error: 'not found' }, 404);
    }

    if (path === '/health') return json({ ok: true, time: Date.now() });

    if (path === '/v1/feed' && req.method === 'GET') {
      const region = url.searchParams.get('region');
      const category = url.searchParams.get('category');
      const before = Number(url.searchParams.get('before')) || undefined;
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), 50);
      const photos = await getPhotoCache(env.DB);
      const items = await queryFeed(env.DB, {
        region: region === 'india' || region === 'global' ? region : undefined,
        category: category && (CATEGORIES as readonly string[]).includes(category) ? category : undefined,
        before,
        limit,
      }, photos);
      const last = items[items.length - 1];
      return json(
        { items, nextBefore: items.length === limit && last ? last.publishedAt : null },
        200,
        { 'cache-control': 'public, max-age=30' },
      );
    }

    if (path === '/v1/sources') {
      const states = await getSourceStates(env.DB);
      return json(
        SOURCES.map((s) => {
          const st = states.get(s.id);
          return { id: s.id, name: s.name, region: s.region, kind: s.kind, enabled: s.enabled, lastOkAt: st?.last_ok_at ?? null, lastError: st?.last_error ?? null };
        }),
      );
    }

    return json({ error: 'not found' }, 404);
  },
} satisfies ExportedHandler<Env>;

/**
 * Runs an internal job as its own invocation through the SELF binding (separate CPU budget).
 * If the binding is missing or fails, runs the job inline so news still flows.
 */
async function runJob(env: Env, path: string): Promise<void> {
  if (env.SELF) {
    try {
      const res = await env.SELF.fetch(`https://internal${path}`, { headers: { 'x-internal-key': env.INTERNAL_KEY ?? '' } });
      const body = await res.text();
      if (res.ok) { console.log(path, body.slice(0, 200)); return; }
      console.error(`${path} via SELF -> HTTP ${res.status} ${body.slice(0, 200)}; running inline`);
    } catch (e) {
      console.error(`${path} via SELF failed: ${(e as Error).message}; running inline`);
    }
  }
  const result =
    path === '/internal/enrich' ? await enrichOnce(env)
    : path === '/internal/images' ? await refreshImages(env)
    : await ingestOne(env, path.slice('/internal/ingest/'.length));
  console.log(path, '(inline)', JSON.stringify(result).slice(0, 200));
}

async function ingestOne(env: Env, sourceId: string) {
  const source = SOURCES.find((s) => s.id === sourceId && s.enabled);
  if (!source) return { error: 'unknown source' };
  const now = Date.now();
  const maxAge = Number(env.MAX_AGE_HOURS) || 48;
  const prev = (await getSourceStates(env.DB)).get(source.id);
  const r = await collectSource(source, now, maxAge, { etag: prev?.etag, lastModified: prev?.last_modified });
  if (r.fetch.status === 'error') {
    await saveSourceState(env.DB, source.id, now, { ok: false, error: r.fetch.error });
    return { source: source.id, error: r.fetch.error };
  }
  let inserted = 0;
  if (r.stories.length) {
    const known = await existingIds(env.DB, r.stories.map((s) => s.id));
    const fresh = r.stories.filter((s) => !known.has(s.id));
    if (fresh.length) {
      // Only now read recent titles (keeps D1 reads low when nothing is new).
      const titles = await recentTitles(env.DB, now - 36 * 3_600_000);
      const { kept } = dedupeList(fresh, (s) => s.title, titles.map(titleTokens));
      await insertStories(env.DB, kept);
      inserted = kept.length;
    }
  }
  await saveSourceState(env.DB, source.id, now, { ok: true, etag: r.fetch.etag, lastModified: r.fetch.lastModified, newItems: inserted });
  return { source: source.id, status: r.fetch.status, parsed: r.parsed, inserted, stale: r.stale, routine: r.routine };
}

async function enrichOnce(env: Env) {
  const now = Date.now();
  const leased = await leasePending(env.DB, now, Number(env.ENRICH_BATCH_SIZE) || 8);
  if (!leased.length) return { enriched: 0 };
  const attempts = new Map(leased.map((l) => [l.story.id, l.attempts]));
  try {
    const stories = leased.map((l) => l.story);
    let out;
    try {
      out = await enrichBatch({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL }, stories);
    } catch (e) {
      // Main model overloaded: try the fallback model once before giving up for this tick.
      if (!(e instanceof TransientError) || !env.GEMINI_FALLBACK_MODEL) throw e;
      out = await enrichBatch({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_FALLBACK_MODEL }, stories);
    }
    let ok = 0;
    for (const o of out) {
      if (o.enrichment) { await saveEnrichment(env.DB, o.story.id, o.enrichment, now); ok++; }
      else await markFailed(env.DB, o.story.id, o.error ?? 'unknown', attempts.get(o.story.id) ?? 1);
    }
    return { enriched: ok, failed: out.length - ok };
  } catch (e) {
    // On rate limit / overload, release without counting it as a failed attempt.
    if (e instanceof RateLimitError || e instanceof TransientError) await releaseLease(env.DB, leased.map((l) => l.story.id));
    else for (const l of leased) await markFailed(env.DB, l.story.id, String((e as Error).message), l.attempts);
    return { enriched: 0, error: String((e as Error).message) };
  }
}

const IMAGES_STATE_ID = '__images';

function imagesDue(env: Env, states: Map<string, { last_fetch_at: number }>, now: number): boolean {
  if (!photoSourceFromEnv(env)) return false;
  const every = Number(env.IMAGE_REFRESH_EVERY_MIN) || (env.UNSPLASH_ACCESS_KEY ? 10 : 2);
  const last = states.get(IMAGES_STATE_ID)?.last_fetch_at ?? 0;
  return now - last >= every * 60_000 - 15_000;
}

/** Fills/refreshes the photo sets a few topics at a time, staying inside the free API limits. */
async function refreshImages(env: Env) {
  const source = photoSourceFromEnv(env);
  if (!source) return { skipped: 'no UNSPLASH_ACCESS_KEY or PEXELS_API_KEY' };
  const now = Date.now();
  const perRun = Number(env.IMAGE_TOPICS_PER_RUN) || (source.provider === 'unsplash' ? 1 : 3);
  const priority = await recentTopics(env.DB, now - 48 * 3_600_000);
  const topics = await topicsToRefresh(env.DB, now, 7 * 24 * 3_600_000, perRun, priority);
  const done: Record<string, number | string> = {};
  let ok = true;
  for (const topic of topics) {
    try {
      const photos = await source.search(IMAGE_TOPICS[topic]);
      await savePhotos(env.DB, topic, photos, now, photos.length ? undefined : 'no results');
      done[topic] = photos.length;
    } catch (e) {
      ok = false;
      await savePhotos(env.DB, topic, null, now, String((e as Error).message).slice(0, 300));
      done[topic] = String((e as Error).message).slice(0, 120);
    }
  }
  await saveSourceState(env.DB, IMAGES_STATE_ID, now, { ok, error: ok ? undefined : 'see image_cache.last_error' });
  return { provider: source.provider, refreshed: done };
}
