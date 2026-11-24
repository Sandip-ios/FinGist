import { SOURCES } from './config/sources';
import { enrichBatch } from './enrich/enrich';
import { RateLimitError, TransientError } from './enrich/gemini';
import { dedupeList, titleTokens } from './ingest/dedupe';
import { collectSource } from './pipeline';
import {
  existingIds, getSourceStates, releaseLease, insertStories, leasePending, markFailed, queryFeed, recentTitles, saveEnrichment, saveSourceState,
} from './store/db';
import { CATEGORIES } from './types';

export interface Env {
  DB: D1Database;
  SELF: Fetcher;
  GEMINI_API_KEY: string;
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
    const states = await getSourceStates(env.DB);
    const internal = { headers: { 'x-internal-key': env.INTERNAL_KEY } };
    for (const s of SOURCES) {
      if (!s.enabled) continue;
      const st = states.get(s.id);
      // Back off failing feeds: wait longer after each consecutive failure (max 1h).
      const backoff = Math.min(60, s.pollMinutes * 2 ** Math.min(st?.consecutive_failures ?? 0, 5));
      if (st && now - st.last_fetch_at < backoff * 60_000 - 15_000) continue;
      ctx.waitUntil(env.SELF.fetch(`https://internal/internal/ingest/${s.id}`, internal));
    }
    const batches = Number(env.ENRICH_BATCHES_PER_TICK) || 3;
    for (let i = 0; i < batches; i++) ctx.waitUntil(env.SELF.fetch('https://internal/internal/enrich', internal));
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.startsWith('/internal/')) {
      if (!env.INTERNAL_KEY || req.headers.get('x-internal-key') !== env.INTERNAL_KEY) return json({ error: 'forbidden' }, 403);
      if (path.startsWith('/internal/ingest/')) return json(await ingestOne(env, path.slice('/internal/ingest/'.length)));
      if (path === '/internal/enrich') return json(await enrichOnce(env));
      return json({ error: 'not found' }, 404);
    }

    if (path === '/health') return json({ ok: true, time: Date.now() });

    if (path === '/v1/feed' && req.method === 'GET') {
      const region = url.searchParams.get('region');
      const category = url.searchParams.get('category');
      const before = Number(url.searchParams.get('before')) || undefined;
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), 50);
      const items = await queryFeed(env.DB, {
        region: region === 'india' || region === 'global' ? region : undefined,
        category: category && (CATEGORIES as readonly string[]).includes(category) ? category : undefined,
        before,
        limit,
      });
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
