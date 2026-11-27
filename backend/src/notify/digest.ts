import { numbersIn, wordCount } from '../enrich/validate';

export type DigestKind = 'morning' | 'market_open' | 'us_open';
/** Which markets a phone follows (its region setting). */
export type Audience = 'india' | 'global' | 'all';

export interface DigestStory { title: string; summary: string; source: string; region: string }

export const DIGEST_TITLES: Record<DigestKind, string> = {
  morning: '☀️ Morning market mood',
  market_open: '📈 Indian market open',
  us_open: '🇺🇸 Wall Street open',
};

/** Which phones get each note: the Indian open goes to India/All, the Wall Street open to Global/All. */
export const DIGEST_AUDIENCES: Record<DigestKind, Audience[]> = {
  morning: ['india', 'global', 'all'],
  market_open: ['india', 'all'],
  us_open: ['global', 'all'],
};

export const DIGEST_SYSTEM = `You write one short push notification for FinGist, a market news app for Indian investors.
Use ONLY the facts in the stories given. Write 2 short sentences, at most 30 words in total, plain English.
Never predict where markets will go, never give advice (no buy/sell/hold, no "investors should").
Every number you use must appear in the stories, written the same way. If the stories are thin, describe what they say without guessing.
Return JSON {"body": "..."}.`;

export function digestPrompt(kind: DigestKind, stories: DigestStory[], audience: Audience = 'all'): string {
  const tasks: Record<string, string> = {
    'morning:india': 'Task: a "morning market mood" note for Indian investors before NSE/BSE open: the key Indian market news and the overnight global cues that matter for India.',
    'morning:global': 'Task: a "morning market mood" note on world markets: how US and European markets closed overnight and the main global market news.',
    'morning:all': 'Task: a "morning market mood" note before the Indian market opens: the main overnight global cues and the key Indian market news.',
    market_open: 'Task: a "market open" note: how Indian markets (Sensex/Nifty) opened today and the main reason, based on the stories.',
    us_open: 'Task: a "Wall Street open" note: how US stocks (Dow, S&P 500, Nasdaq) opened today and the main reason, based on the stories.',
  };
  const task = kind === 'morning' ? tasks[`morning:${audience}`] : tasks[kind];
  return `${task}\n\nStories:\n${JSON.stringify(stories.map((s) => ({ headline: s.title, summary: s.summary, source: s.source, region: s.region })), null, 1)}`;
}

export const DIGEST_SCHEMA = { type: 'OBJECT', properties: { body: { type: 'STRING' } }, required: ['body'] } as const;

const ADVICE = /\b(you should|investors should|buy now|sell now|target price|will (rise|fall|rally|crash)|expected to (rise|fall))\b/i;

/** Checks the AI note against its source stories; returns null if it should not be sent. */
export function validateDigest(body: unknown, stories: DigestStory[]): string | null {
  if (typeof body !== 'string') return null;
  const text = body.replace(/\s+/g, ' ').trim();
  const words = wordCount(text);
  if (words < 8 || words > 40 || text.length > 200) return null;
  if (ADVICE.test(text)) return null;
  const source = numbersIn(stories.map((s) => `${s.title} ${s.summary}`).join(' '));
  if ([...numbersIn(text)].some((n) => !source.has(n))) return null;
  return text;
}

/** IST minutes since midnight and weekday (0 = Sunday). */
export function istClock(now: number): { minutes: number; weekday: number; day: string } {
  const d = new Date(now + 5.5 * 3_600_000);
  return { minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), weekday: d.getUTCDay(), day: d.toISOString().slice(0, 10) };
}

/** New York local time (handles US daylight saving automatically). */
export function nyClock(now: number): { minutes: number; weekday: number; day: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' })
      .formatToParts(new Date(now))
      .map((p) => [p.type, p.value]),
  );
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hour = Number(parts.hour) % 24;
  return { minutes: hour * 60 + Number(parts.minute), weekday: days.indexOf(parts.weekday ?? ''), day: `${parts.year}-${parts.month}-${parts.day}` };
}

/**
 * Scheduled notes due now (weekdays only). Windows let a missed cron run catch up.
 * - morning: 8:40–9:10 IST, before NSE/BSE open (9:15)
 * - market_open: 9:30–10:00 IST, after the Indian open
 * - us_open: 9:50–10:20 New York time, after the NYSE open (9:30)
 */
export function dueDigests(now: number): DigestKind[] {
  const due: DigestKind[] = [];
  const ist = istClock(now);
  if (ist.weekday >= 1 && ist.weekday <= 5) {
    if (ist.minutes >= 8 * 60 + 40 && ist.minutes < 9 * 60 + 10) due.push('morning');
    if (ist.minutes >= 9 * 60 + 30 && ist.minutes < 10 * 60) due.push('market_open');
  }
  const ny = nyClock(now);
  if (ny.weekday >= 1 && ny.weekday <= 5 && ny.minutes >= 9 * 60 + 50 && ny.minutes < 10 * 60 + 20) due.push('us_open');
  return due;
}

/** The calendar day a note belongs to (each note is sent once per day). */
export function digestDay(kind: DigestKind, now: number): string {
  return kind === 'us_open' ? nyClock(now).day : istClock(now).day;
}
