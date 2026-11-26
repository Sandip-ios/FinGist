import { categoryLabel } from '../data/labels';
import { generateJson, type GeminiConfig } from '../enrich/gemini';
import { DIGEST_SCHEMA, DIGEST_SYSTEM, DIGEST_TITLES, digestPrompt, dueDigest, istClock, validateDigest, type DigestKind, type DigestStory } from './digest';
import { inQuietHours, istParts, sendPush, type PushMessage } from './push';

export interface NotifyConfig {
  minGapMinutes: number; // at most one alert per this many minutes (for everyone)
  dailyCap: number; // per phone, per Indian calendar day
  maxAgeMinutes: number; // only alert on fresh stories
}

const STATE_ID = '__notify';

interface Candidate { id: string; title: string; summary: string; category: string | null; region: string; region_impact: string | null }
interface Device { token: string; region: string; quiet_hours: number; sent_day: string | null; sent_count: number; morning?: number; market_open?: number; breaking?: number }

/** Devices that want this story: region match, not in quiet hours, under today's limit. */
export function eligible(devices: Device[], storyRegion: string, now: number, dailyCap: number): Device[] {
  const quiet = inQuietHours(now);
  const { day } = istParts(now);
  return devices.filter((d) => {
    if (d.region === 'india' && storyRegion === 'global') return false;
    if (d.region === 'global' && storyRegion === 'india') return false;
    if (quiet && d.quiet_hours) return false;
    if (d.sent_day === day && d.sent_count >= dailyCap) return false;
    return true;
  });
}

export function buildMessage(token: string, c: Candidate): PushMessage {
  const body = c.summary.split(/(?<=[.!?])\s+/)[0] ?? c.summary;
  return {
    to: token,
    title: c.title.length > 110 ? `${c.title.slice(0, 107)}…` : c.title,
    body: `${categoryLabel(c.category)} · ${body.length > 140 ? `${body.slice(0, 137)}…` : body}`,
    data: { storyId: c.id },
    sound: 'default',
    channelId: 'breaking',
    priority: 'high',
  };
}

/** Sends at most one "breaking" alert per run: the newest high-relevance story not yet alerted. */
export async function notifyOnce(db: D1Database, cfg: NotifyConfig, now = Date.now()) {
  const state = await db.prepare('SELECT last_fetch_at FROM source_state WHERE source_id = ?1').bind(STATE_ID).first<{ last_fetch_at: number }>();
  if (state && now - state.last_fetch_at < cfg.minGapMinutes * 60_000) return { skipped: 'too soon' };

  const c = await db
    .prepare(
      `SELECT id, title, summary, category, region, region_impact FROM stories
       WHERE status = 'ready' AND summary IS NOT NULL AND relevance = 'high' AND notified_at IS NULL AND published_at > ?1
       ORDER BY published_at DESC LIMIT 1`,
    )
    .bind(now - cfg.maxAgeMinutes * 60_000)
    .first<Candidate>();
  if (!c) return { skipped: 'no new high-relevance story' };

  const all = (await db.prepare('SELECT token, region, quiet_hours, sent_day, sent_count FROM devices WHERE breaking = 1').all<Device>()).results;
  const targets = eligible(all, c.region_impact ?? c.region, now, cfg.dailyCap);
  await db.prepare('UPDATE stories SET notified_at = ?2 WHERE id = ?1').bind(c.id, now).run();
  if (!targets.length) return { story: c.id, sent: 0, devices: all.length };

  const result = await sendPush(targets.map((d) => buildMessage(d.token, c)));
  await recordSends(db, targets, result.invalid, now);
  return { story: c.id, targets: targets.length, sent: result.sent, removed: result.invalid.length, errors: result.errors.slice(0, 3) };
}

/** Updates daily counters, removes dead tokens and remembers the time of the last alert. */
async function recordSends(db: D1Database, targets: Device[], invalid: string[], now: number) {
  const { day } = istParts(now);
  const ok = targets.map((d) => d.token).filter((t) => !invalid.includes(t));
  for (let i = 0; i < ok.length; i += 90) {
    const chunk = ok.slice(i, i + 90);
    await db
      .prepare(`UPDATE devices SET sent_count = CASE WHEN sent_day = ?1 THEN sent_count + 1 ELSE 1 END, sent_day = ?1 WHERE token IN (${chunk.map((_, j) => `?${j + 2}`).join(',')})`)
      .bind(day, ...chunk)
      .run();
  }
  for (let i = 0; i < invalid.length; i += 90) {
    const chunk = invalid.slice(i, i + 90);
    await db.prepare(`DELETE FROM devices WHERE token IN (${chunk.map((_, j) => `?${j + 1}`).join(',')})`).bind(...chunk).run();
  }
  await db
    .prepare(`INSERT INTO source_state (source_id, last_fetch_at, last_ok_at) VALUES (?1, ?2, ?2) ON CONFLICT(source_id) DO UPDATE SET last_fetch_at = ?2, last_ok_at = ?2`)
    .bind(STATE_ID, now)
    .run();
}

/**
 * Scheduled notes on weekdays: "Morning market mood" (~8:45 IST) and "Market open update" (~9:30 IST).
 * Each is sent at most once a day; the open update is skipped if there is no opening news by 10:00
 * (e.g. market holidays).
 */
export async function digestOnce(db: D1Database, gemini: GeminiConfig, dailyCap: number, now = Date.now()) {
  const kind = dueDigest(now);
  if (!kind) return { skipped: 'not scheduled now' };
  const { day } = istClock(now);
  const stateId = `__digest_${kind}`;
  const state = await db.prepare('SELECT last_error FROM source_state WHERE source_id = ?1').bind(stateId).first<{ last_error: string | null }>();
  if (state?.last_error === day) return { skipped: `${kind} already sent today` };

  const stories = await digestStories(db, kind, now);
  if (stories.length < 2) return { skipped: `${kind}: not enough stories yet` };

  let body: string | null = null;
  try {
    const out = (await generateJson(gemini, DIGEST_SYSTEM, digestPrompt(kind, stories), DIGEST_SCHEMA)) as { body?: unknown };
    body = validateDigest(out?.body, stories);
  } catch {
    body = null;
  }
  // If the AI note fails checks, fall back to the top headline.
  if (!body) body = stories[0]!.title.length > 170 ? `${stories[0]!.title.slice(0, 167)}…` : stories[0]!.title;

  const column = kind === 'morning' ? 'morning' : 'market_open';
  const all = (await db.prepare(`SELECT token, region, quiet_hours, sent_day, sent_count FROM devices WHERE ${column} = 1`).all<Device>()).results;
  // Region filter does not apply: these notes cover the whole market.
  const targets = eligible(all, 'both', now, dailyCap);
  await db
    .prepare(`INSERT INTO source_state (source_id, last_fetch_at, last_error) VALUES (?1, ?2, ?3) ON CONFLICT(source_id) DO UPDATE SET last_fetch_at = ?2, last_error = ?3`)
    .bind(stateId, now, day)
    .run();
  if (!targets.length) return { kind, body, sent: 0 };
  const msgs: PushMessage[] = targets.map((d) => ({ to: d.token, title: DIGEST_TITLES[kind], body: body!, data: { type: kind }, sound: 'default', channelId: 'breaking', priority: 'high' }));
  const result = await sendPush(msgs);
  await recordSends(db, targets, result.invalid, now);
  return { kind, body, targets: targets.length, sent: result.sent, errors: result.errors.slice(0, 3) };
}

async function digestStories(db: D1Database, kind: DigestKind, now: number): Promise<DigestStory[]> {
  if (kind === 'morning') {
    // Overnight and early-morning news (last 14 hours), most relevant first.
    const { results } = await db
      .prepare(
        `SELECT title, summary, source_name AS source, COALESCE(region_impact, region) AS region FROM stories
         WHERE status = 'ready' AND summary IS NOT NULL AND relevance IN ('high', 'medium') AND published_at > ?1
           AND category IN ('markets', 'stocks', 'economy', 'policy', 'global', 'commodities', 'currency', 'earnings')
         ORDER BY CASE relevance WHEN 'high' THEN 0 ELSE 1 END, published_at DESC LIMIT 12`,
      )
      .bind(now - 14 * 3_600_000)
      .all<DigestStory>();
    return results;
  }
  // Opening news: Indian market stories published since 9:15 IST today.
  const { minutes } = istClock(now);
  const openAt = now - (minutes - (9 * 60 + 15)) * 60_000;
  const { results } = await db
    .prepare(
      `SELECT title, summary, source_name AS source, COALESCE(region_impact, region) AS region FROM stories
       WHERE status = 'ready' AND summary IS NOT NULL AND published_at >= ?1 AND category IN ('markets', 'stocks')
         AND COALESCE(region_impact, region) IN ('india', 'both')
       ORDER BY published_at DESC LIMIT 8`,
    )
    .bind(openAt)
    .all<DigestStory>();
  return results;
}

export interface DevicePrefs { token: string; platform: string; region: string; quietHours: boolean; morning: boolean; marketOpen: boolean; breaking: boolean }

export async function upsertDevice(db: D1Database, d: DevicePrefs, now: number) {
  await db
    .prepare(
      `INSERT INTO devices (token, platform, region, quiet_hours, morning, market_open, breaking, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
       ON CONFLICT(token) DO UPDATE SET platform = ?2, region = ?3, quiet_hours = ?4, morning = ?5, market_open = ?6, breaking = ?7, updated_at = ?8`,
    )
    .bind(d.token, d.platform, d.region, d.quietHours ? 1 : 0, d.morning ? 1 : 0, d.marketOpen ? 1 : 0, d.breaking ? 1 : 0, now)
    .run();
}

export async function deleteDevice(db: D1Database, token: string) {
  await db.prepare('DELETE FROM devices WHERE token = ?1').bind(token).run();
}
