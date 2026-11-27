import { CATEGORY_DEFAULT_TOPIC, IMAGE_TOPIC_IDS, isImageTopic, type ImageTopic } from '../data/imageTopics';
import { pickPhoto, type Photo } from '../enrich/photos';
import type { Category, Enrichment, Story } from '../types';

export interface SourceState {
  source_id: string;
  etag: string | null;
  last_modified: string | null;
  last_fetch_at: number;
  last_ok_at: number;
  last_error: string | null;
  consecutive_failures: number;
}

export async function getSourceStates(db: D1Database): Promise<Map<string, SourceState>> {
  const { results } = await db.prepare('SELECT * FROM source_state').all<SourceState>();
  return new Map(results.map((r) => [r.source_id, r]));
}

export async function saveSourceState(
  db: D1Database,
  id: string,
  now: number,
  r: { ok: boolean; etag?: string; lastModified?: string; error?: string; newItems?: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO source_state (source_id, etag, last_modified, last_fetch_at, last_ok_at, last_error, consecutive_failures, last_new_items)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT(source_id) DO UPDATE SET
         etag = COALESCE(?2, etag),
         last_modified = COALESCE(?3, last_modified),
         last_fetch_at = ?4,
         last_ok_at = CASE WHEN ?7 = 0 THEN ?4 ELSE last_ok_at END,
         last_error = ?6,
         consecutive_failures = CASE WHEN ?7 = 0 THEN 0 ELSE consecutive_failures + 1 END,
         last_new_items = ?8`,
    )
    .bind(id, r.etag ?? null, r.lastModified ?? null, now, r.ok ? now : 0, r.error ?? null, r.ok ? 0 : 1, r.newItems ?? 0)
    .run();
}

/** Returns the subset of ids already stored. */
export async function existingIds(db: D1Database, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const { results } = await db
      .prepare(`SELECT id FROM stories WHERE id IN (${chunk.map(() => '?').join(',')})`)
      .bind(...chunk)
      .all<{ id: string }>();
    for (const r of results) found.add(r.id);
  }
  return found;
}

export async function recentTitles(db: D1Database, since: number): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT title FROM stories WHERE published_at > ?1 ORDER BY published_at DESC LIMIT 1500')
    .bind(since)
    .all<{ title: string }>();
  return results.map((r) => r.title);
}

export async function insertStories(db: D1Database, stories: Story[]): Promise<void> {
  if (!stories.length) return;
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO stories (id, source_id, source_name, url, title, snippet, region, kind, published_at, fetched_at, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'pending')`,
  );
  await db.batch(
    stories.map((s) => stmt.bind(s.id, s.sourceId, s.sourceName, s.url, s.title, s.snippet, s.region, s.kind, s.publishedAt, s.fetchedAt)),
  );
}

interface StoryRow {
  id: string; source_id: string; source_name: string; url: string; title: string; snippet: string;
  region: Story['region']; kind: Story['kind']; published_at: number; fetched_at: number; attempts: number;
}

/** Atomically leases up to `limit` stories for AI enrichment (newest first). */
export async function leasePending(db: D1Database, now: number, limit: number, leaseMs = 120_000): Promise<{ story: Story; attempts: number }[]> {
  const { results } = await db
    .prepare(
      `UPDATE stories SET status = 'processing', lease_until = ?1, attempts = attempts + 1
       WHERE id IN (
         SELECT id FROM stories
         WHERE status = 'pending' OR (status = 'processing' AND lease_until < ?2)
         ORDER BY published_at DESC LIMIT ?3)
       RETURNING id, source_id, source_name, url, title, snippet, region, kind, published_at, fetched_at, attempts`,
    )
    .bind(now + leaseMs, now, limit)
    .all<StoryRow>();
  return results.map((r) => ({
    attempts: r.attempts,
    story: {
      id: r.id, sourceId: r.source_id, sourceName: r.source_name, url: r.url, title: r.title, snippet: r.snippet,
      region: r.region, kind: r.kind, publishedAt: r.published_at, fetchedAt: r.fetched_at,
    },
  }));
}

export async function saveEnrichment(db: D1Database, id: string, e: Enrichment, now: number): Promise<void> {
  await db
    .prepare(
      `UPDATE stories SET status = ?2, summary = ?3, category = ?4, sentiment = ?5, relevance = ?6, region_impact = ?7,
         companies = ?8, flags = ?9, enriched_at = ?10, image_topic = ?11, error = NULL WHERE id = ?1`,
    )
    .bind(
      id, e.marketRelevant ? 'ready' : 'rejected', e.summary, e.category, e.sentiment, e.relevance, e.regionImpact,
      JSON.stringify(e.companies), JSON.stringify(e.flags), now, e.imageTopic,
    )
    .run();
}

/** After too many failed attempts the story stays visible as headline-only. */
export async function markFailed(db: D1Database, id: string, error: string, attempts: number, maxAttempts = 3): Promise<void> {
  await db
    .prepare(`UPDATE stories SET status = ?2, error = ?3, lease_until = 0 WHERE id = ?1`)
    .bind(id, attempts >= maxAttempts ? 'failed' : 'pending', error.slice(0, 500))
    .run();
}

/** Puts leased stories back without counting the attempt (e.g. AI rate limit). */
export async function releaseLease(db: D1Database, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db
    .prepare(`UPDATE stories SET status = 'pending', lease_until = 0, attempts = MAX(attempts - 1, 0) WHERE id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids)
    .run();
}

export interface FeedQuery {
  region?: 'india' | 'global';
  category?: string;
  before?: number;
  limit: number;
}

export async function queryFeed(db: D1Database, q: FeedQuery, photos?: Map<string, Photo[]>) {
  // Only complete cards: AI summary written and checked. New stories appear a few minutes after publication.
  const where = [`status = 'ready'`, `summary IS NOT NULL`, `COALESCE(relevance, 'medium') != 'low'`];
  const binds: (string | number)[] = [];
  if (q.before) { binds.push(q.before); where.push(`published_at < ?${binds.length}`); }
  if (q.region) { binds.push(q.region); where.push(`(region = ?${binds.length} OR region_impact = ?${binds.length} OR region_impact = 'both')`); }
  if (q.category) { binds.push(q.category); where.push(`category = ?${binds.length}`); }
  binds.push(q.limit);
  const { results } = await db
    .prepare(
      `SELECT id, source_name, url, title, summary, category, sentiment, relevance, region, region_impact, kind, companies, published_at, status, image_topic
       FROM stories WHERE ${where.join(' AND ')} ORDER BY published_at DESC LIMIT ?${binds.length}`,
    )
    .bind(...binds)
    .all<Record<string, unknown>>();
  return results.map((r) => toCard(r, photos));
}

const CARD_COLUMNS = 's.id, s.source_name, s.url, s.title, s.summary, s.category, s.sentiment, s.relevance, s.region, s.region_impact, s.kind, s.companies, s.published_at, s.status, s.image_topic';

function toCard(r: Record<string, unknown>, photos?: Map<string, Photo[]>) {
  return {
    id: r.id,
    title: r.title,
    summary: r.summary ?? null,
    summaryStatus: r.status === 'ready' ? (r.summary ? 'ready' : 'unavailable') : r.status === 'failed' ? 'unavailable' : 'pending',
    source: r.source_name,
    url: r.url,
    category: r.category ?? null,
    sentiment: r.sentiment ?? null,
    relevance: r.relevance ?? null,
    region: r.region_impact ?? r.region,
    kind: r.kind,
    companies: r.companies ? JSON.parse(r.companies as string) : [],
    publishedAt: r.published_at,
    image: photos ? imageFor(photos, r.id as string, r.image_topic as string | null, r.category as string | null) : null,
  };
}

export async function getStory(db: D1Database, id: string, photos?: Map<string, Photo[]>) {
  const r = await db
    .prepare(`SELECT ${CARD_COLUMNS} FROM stories s WHERE s.id = ?1 AND s.status = 'ready' AND s.summary IS NOT NULL`)
    .bind(id)
    .first<Record<string, unknown>>();
  return r ? toCard(r, photos) : null;
}

/** Turns user text into a safe FTS5 query: every word must match, as a prefix ("infos" finds Infosys). */
export function toFtsQuery(q: string): string | null {
  const words = q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}&.\- ]+/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[.\-&]+|[.\-&]+$/g, ''))
    .filter((w) => w.length > 0)
    .slice(0, 8);
  if (!words.length) return null;
  return words.map((w) => `"${w.replace(/"/g, '')}"*`).join(' ');
}

export async function searchStories(db: D1Database, q: string, opts: { before?: number; limit: number }, photos?: Map<string, Photo[]>) {
  const fts = toFtsQuery(q);
  if (!fts) return [];
  const binds: (string | number)[] = [fts];
  let where = `stories_fts MATCH ?1 AND s.status = 'ready' AND s.summary IS NOT NULL`;
  if (opts.before) { binds.push(opts.before); where += ` AND s.published_at < ?${binds.length}`; }
  binds.push(opts.limit);
  const { results } = await db
    .prepare(`SELECT ${CARD_COLUMNS} FROM stories_fts JOIN stories s ON s.rowid = stories_fts.rowid WHERE ${where} ORDER BY s.published_at DESC LIMIT ?${binds.length}`)
    .bind(...binds)
    .all<Record<string, unknown>>();
  return results.map((r) => toCard(r, photos));
}

/** Companies mentioned most in recent published cards. */
export async function trendingCompanies(db: D1Database, since: number, limit = 12) {
  const { results } = await db
    .prepare(
      `SELECT MIN(json_extract(c.value, '$.name')) AS name, MAX(json_extract(c.value, '$.symbol')) AS symbol, COUNT(*) AS n
       FROM stories s, json_each(s.companies) c
       WHERE s.published_at > ?1 AND s.status = 'ready' AND s.summary IS NOT NULL
       GROUP BY lower(json_extract(c.value, '$.name')) ORDER BY n DESC, MAX(s.published_at) DESC LIMIT ?2`,
    )
    .bind(since, limit)
    .all<{ name: string; symbol: string | null; n: number }>();
  return results.filter((r) => r.name).map((r) => ({ name: r.name, symbol: r.symbol ?? null, count: r.n }));
}

const GENERIC_TOPICS: ImageTopic[] = ['stock_market', 'trading_screen', 'economy_growth', 'business_meeting'];

/**
 * Story's own topic first; while that topic has no photos yet, the category's default,
 * then a generic market photo, then any topic that has photos. So every card gets a photo.
 */
function imageFor(photos: Map<string, Photo[]>, id: string, topic: string | null, category: string | null) {
  const chain: string[] = [];
  if (isImageTopic(topic)) chain.push(topic);
  chain.push(CATEGORY_DEFAULT_TOPIC[(category ?? 'other') as Category] ?? 'business_meeting', ...GENERIC_TOPICS);
  let list: Photo[] | undefined;
  for (const t of chain) {
    const l = photos.get(t);
    if (l && l.length) { list = l; break; }
  }
  if (!list) list = [...photos.values()].find((l) => l.length);
  const p = pickPhoto(list ?? [], id);
  if (!p) return null;
  const provider = p.provider ?? 'pexels';
  return {
    url: p.url,
    photographer: p.photographer,
    photographerUrl: p.photographerUrl,
    pageUrl: p.pageUrl ?? p.pexelsUrl,
    provider,
    providerName: provider === 'unsplash' ? 'Unsplash' : 'Pexels',
    color: p.avgColor,
  };
}

// ---- Photo cache (Unsplash / Pexels) ----

/** Topics needed by recent stories (their AI topic, or their category's default). */
export async function recentTopics(db: D1Database, since: number): Promise<Set<string>> {
  const { results } = await db
    .prepare(`SELECT DISTINCT image_topic, category FROM stories WHERE published_at > ?1 AND status = 'ready'`)
    .bind(since)
    .all<{ image_topic: string | null; category: string | null }>();
  const out = new Set<string>();
  for (const r of results) {
    if (isImageTopic(r.image_topic)) out.add(r.image_topic);
    else if (r.category) out.add(CATEGORY_DEFAULT_TOPIC[r.category as Category] ?? 'business_meeting');
  }
  return out;
}

export async function getPhotoCache(db: D1Database): Promise<Map<string, Photo[]>> {
  const { results } = await db.prepare('SELECT topic, photos FROM image_cache').all<{ topic: string; photos: string }>();
  return new Map(results.map((r) => [r.topic, JSON.parse(r.photos) as Photo[]]));
}

/** Topics with no photos yet come first, then the oldest; failed topics wait 6 hours. */
export async function topicsToRefresh(db: D1Database, now: number, maxAgeMs: number, limit: number, priority: Set<string> = new Set()): Promise<ImageTopic[]> {
  const { results } = await db.prepare('SELECT topic, fetched_at, photos, last_error FROM image_cache').all<{ topic: string; fetched_at: number; photos: string; last_error: string | null }>();
  const known = new Map(results.map((r) => [r.topic, r]));
  // Topics used by today's stories first, so cards get photos quickly.
  const missing = IMAGE_TOPIC_IDS.filter((t) => !known.has(t)).sort((a, b) => Number(priority.has(b)) - Number(priority.has(a)));
  const stale = results
    .filter((r) => isImageTopic(r.topic))
    .filter((r) => (r.last_error ? now - r.fetched_at > 6 * 3_600_000 : now - r.fetched_at > maxAgeMs))
    .sort((a, b) => a.fetched_at - b.fetched_at)
    .map((r) => r.topic as ImageTopic);
  return [...missing, ...stale].slice(0, limit);
}

export async function savePhotos(db: D1Database, topic: string, photos: Photo[] | null, now: number, error?: string): Promise<void> {
  if (photos && photos.length) {
    await db.prepare(`INSERT INTO image_cache (topic, photos, fetched_at, last_error) VALUES (?1, ?2, ?3, NULL)
      ON CONFLICT(topic) DO UPDATE SET photos = ?2, fetched_at = ?3, last_error = NULL`).bind(topic, JSON.stringify(photos), now).run();
  } else {
    // Keep old photos if we had some; just record the error/time.
    await db.prepare(`INSERT INTO image_cache (topic, photos, fetched_at, last_error) VALUES (?1, '[]', ?2, ?3)
      ON CONFLICT(topic) DO UPDATE SET fetched_at = ?2, last_error = ?3`).bind(topic, now, error ?? 'no photos').run();
  }
}

/** Deletes stories published before `cutoff` (search index rows go with them via triggers), plus leftover test-alert markers. */
export async function pruneOld(db: D1Database, cutoff: number): Promise<number> {
  const r = await db.prepare('DELETE FROM stories WHERE published_at < ?1').bind(cutoff).run();
  await db.prepare("DELETE FROM source_state WHERE source_id LIKE '\\_\\_test\\_%' ESCAPE '\\'").run();
  return r.meta.changes ?? 0;
}
