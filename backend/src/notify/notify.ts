import { categoryLabel } from '../data/labels';
import { generateJson, type GeminiConfig } from '../enrich/gemini';
import { DIGEST_AUDIENCES, DIGEST_SCHEMA, DIGEST_SYSTEM, DIGEST_TITLES, digestDay, digestPrompt, dueDigests, istClock, nyClock, validateDigest, type Audience, type DigestKind, type DigestStory } from './digest';
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

  const all = withCounts((await db.prepare('SELECT token, region, quiet_hours FROM devices WHERE breaking = 1').all<Device>()).results, await loadCounts(db, now), now);
  const targets = eligible(all, c.region_impact ?? c.region, now, cfg.dailyCap);
  await db.prepare('UPDATE stories SET notified_at = ?2 WHERE id = ?1').bind(c.id, now).run();
  if (!targets.length) return { story: c.id, sent: 0, devices: all.length };

  const result = await sendPush(targets.map((d) => buildMessage(d.token, c)));
  await recordSends(db, targets, result.invalid, now);
  return { story: c.id, targets: targets.length, sent: result.sent, removed: result.invalid.length, errors: result.errors.slice(0, 3) };
}

/** Today's alert count per audience (all / india / global). Every phone in an audience gets the same alerts. */
async function loadCounts(db: D1Database, now: number): Promise<Map<string, number>> {
  const { results } = await db.prepare('SELECT audience, count FROM alert_counts WHERE day = ?1').bind(istParts(now).day).all<{ audience: string; count: number }>();
  return new Map(results.map((r) => [r.audience, r.count]));
}

/** Gives each phone its audience's count for today, so `eligible` can apply the daily limit. */
export function withCounts(devices: Device[], counts: Map<string, number>, now: number): Device[] {
  const { day } = istParts(now);
  return devices.map((d) => ({ ...d, sent_day: day, sent_count: counts.get(d.region) ?? 0 }));
}

/** Updates the daily counters (one row per audience, not per phone), removes dead tokens and remembers the last alert time. */
async function recordSends(db: D1Database, targets: Device[], invalid: string[], now: number) {
  const { day } = istParts(now);
  const audiences = [...new Set(targets.filter((d) => !invalid.includes(d.token)).map((d) => d.region))];
  for (const audience of audiences) {
    await db
      .prepare('INSERT INTO alert_counts (day, audience, count) VALUES (?1, ?2, 1) ON CONFLICT(day, audience) DO UPDATE SET count = count + 1')
      .bind(day, audience)
      .run();
  }
  await db.prepare('DELETE FROM alert_counts WHERE day < ?1').bind(istParts(now - 3 * 86_400_000).day).run();
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
 * Scheduled notes: "Morning market mood" (~8:45 IST, written separately for India / Global / All
 * phones), "Indian market open" (~9:30 IST, India and All phones) and "Wall Street open"
 * (~20 minutes after the NYSE open, Global and All phones). Each is sent at most once a day and
 * skipped if there is no fresh news for it.
 */
export async function digestOnce(db: D1Database, gemini: GeminiConfig, dailyCap: number, now = Date.now()) {
  const due = dueDigests(now);
  if (!due.length) return { skipped: 'not scheduled now' };
  const results: Record<string, unknown> = {};
  for (const kind of due) results[kind] = await sendDigest(db, gemini, dailyCap, kind, now);
  return results;
}

async function sendDigest(db: D1Database, gemini: GeminiConfig, dailyCap: number, kind: DigestKind, now: number) {
  const day = digestDay(kind, now);
  const stateId = `__digest_${kind}`;
  const state = await db.prepare('SELECT last_error FROM source_state WHERE source_id = ?1').bind(stateId).first<{ last_error: string | null }>();
  if (state?.last_error === day) return { skipped: 'already sent today' };

  const column = kind === 'morning' ? 'morning' : 'market_open';
  const audiences = DIGEST_AUDIENCES[kind];
  const counts = await loadCounts(db, now);
  const devices = withCounts((await db.prepare(`SELECT token, region, quiet_hours FROM devices WHERE ${column} = 1`).all<Device>()).results, counts, now)
    .filter((d) => audiences.includes((d.region as Audience) ?? 'all'));

  // One note per audience for the morning mood; one shared note for the market opens.
  const groups = new Map<Audience, Device[]>();
  for (const d of devices) {
    const key: Audience = kind === 'morning' ? ((d.region as Audience) ?? 'all') : 'all';
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  if (!groups.size) groups.set('all', []);

  const out: Record<string, unknown> = {};
  let anyStories = false;
  for (const [audience, group] of groups) {
    let stories = await digestStories(db, kind, now, audience);
    if (kind === 'morning' && stories.length < 2 && audience !== 'all') stories = await digestStories(db, kind, now, 'all');
    if (stories.length < 2) { out[audience] = { skipped: 'not enough stories yet' }; continue; }
    anyStories = true;
    const body = await composeNote(gemini, kind, stories, audience);
    const targets = eligible(group, 'both', now, dailyCap);
    if (!targets.length) { out[audience] = { body, sent: 0 }; continue; }
    const msgs: PushMessage[] = targets.map((d) => ({ to: d.token, title: DIGEST_TITLES[kind], body, data: { type: kind }, sound: 'default', channelId: 'breaking', priority: 'high' }));
    const result = await sendPush(msgs);
    await recordSends(db, targets, result.invalid, now);
    out[audience] = { body, targets: targets.length, sent: result.sent, errors: result.errors.slice(0, 3) };
  }
  // Mark as done for today once a note could be written (otherwise keep trying within the window).
  if (anyStories) {
    await db
      .prepare(`INSERT INTO source_state (source_id, last_fetch_at, last_error) VALUES (?1, ?2, ?3) ON CONFLICT(source_id) DO UPDATE SET last_fetch_at = ?2, last_error = ?3`)
      .bind(stateId, now, day)
      .run();
  }
  return out;
}

async function composeNote(gemini: GeminiConfig, kind: DigestKind, stories: DigestStory[], audience: Audience): Promise<string> {
  try {
    const out = (await generateJson(gemini, DIGEST_SYSTEM, digestPrompt(kind, stories, audience), DIGEST_SCHEMA)) as { body?: unknown };
    const body = validateDigest(out?.body, stories);
    if (body) return body;
  } catch {
    // fall through to the headline
  }
  const top = stories[0]!.title;
  return top.length > 170 ? `${top.slice(0, 167)}…` : top;
}

const REGION_FILTER: Record<Audience, string> = {
  india: `AND COALESCE(region_impact, region) IN ('india', 'both')`,
  global: `AND COALESCE(region_impact, region) IN ('global', 'both')`,
  all: '',
};

async function digestStories(db: D1Database, kind: DigestKind, now: number, audience: Audience): Promise<DigestStory[]> {
  const cols = `title, summary, source_name AS source, COALESCE(region_impact, region) AS region`;
  if (kind === 'morning') {
    // Overnight and early-morning news (last 14 hours), most relevant first.
    const { results } = await db
      .prepare(
        `SELECT ${cols} FROM stories
         WHERE status = 'ready' AND summary IS NOT NULL AND relevance IN ('high', 'medium') AND published_at > ?1 AND published_at <= ?2
           AND category IN ('markets', 'stocks', 'economy', 'policy', 'global', 'commodities', 'currency', 'earnings')
           ${REGION_FILTER[audience]}
         ORDER BY CASE relevance WHEN 'high' THEN 0 ELSE 1 END, published_at DESC LIMIT 12`,
      )
      .bind(now - 14 * 3_600_000, now)
      .all<DigestStory>();
    return results;
  }
  if (kind === 'market_open') {
    // Indian market stories published since 9:15 IST today.
    const { minutes } = istClock(now);
    const openAt = now - (minutes - (9 * 60 + 15)) * 60_000;
    const { results } = await db
      .prepare(
        `SELECT ${cols} FROM stories
         WHERE status = 'ready' AND summary IS NOT NULL AND published_at >= ?1 AND published_at <= ?2 AND category IN ('markets', 'stocks')
           ${REGION_FILTER.india}
         ORDER BY published_at DESC LIMIT 8`,
      )
      .bind(openAt, now)
      .all<DigestStory>();
    return results;
  }
  // Wall Street stories published since the NYSE open (9:30 New York time) today.
  const { minutes } = nyClock(now);
  const openAt = now - (minutes - (9 * 60 + 30)) * 60_000;
  const { results } = await db
    .prepare(
      `SELECT ${cols} FROM stories
       WHERE status = 'ready' AND summary IS NOT NULL AND published_at >= ?1 AND published_at <= ?2 AND category IN ('markets', 'stocks', 'global')
         ${REGION_FILTER.global}
       ORDER BY published_at DESC LIMIT 8`,
    )
    .bind(openAt, now)
    .all<DigestStory>();
  return results;
}


export interface DevicePrefs { token: string; platform: string; region: string; quietHours: boolean; morning: boolean; marketOpen: boolean; breaking: boolean }

export async function upsertDevice(db: D1Database, d: DevicePrefs, now: number) {
  await db
    .prepare(
      `INSERT INTO devices (token, platform, region, quiet_hours, morning, market_open, breaking, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
       ON CONFLICT(token) DO UPDATE SET platform = ?2, region = ?3, quiet_hours = ?4, morning = ?5, market_open = ?6, breaking = ?7, updated_at = ?8
       -- Phones re-register on every app start: only write when something changed (or once a week, to mark the phone as active).
       WHERE devices.platform IS NOT ?2 OR devices.region IS NOT ?3 OR devices.quiet_hours IS NOT ?4 OR devices.morning IS NOT ?5
          OR devices.market_open IS NOT ?6 OR devices.breaking IS NOT ?7 OR devices.updated_at < ?8 - 604800000`,
    )
    .bind(d.token, d.platform, d.region, d.quietHours ? 1 : 0, d.morning ? 1 : 0, d.marketOpen ? 1 : 0, d.breaking ? 1 : 0, now)
    .run();
}

export async function deleteDevice(db: D1Database, token: string) {
  await db.prepare('DELETE FROM devices WHERE token = ?1').bind(token).run();
}
