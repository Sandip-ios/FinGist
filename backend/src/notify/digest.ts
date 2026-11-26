import { numbersIn, wordCount } from '../enrich/validate';

export type DigestKind = 'morning' | 'market_open';

export interface DigestStory { title: string; summary: string; source: string; region: string }

export const DIGEST_TITLES: Record<DigestKind, string> = {
  morning: '☀️ Morning market mood',
  market_open: '📈 Market open update',
};

export const DIGEST_SYSTEM = `You write one short push notification for FinGist, a market news app for Indian investors.
Use ONLY the facts in the stories given. Write 2 short sentences, at most 30 words in total, plain English.
Never predict where markets will go, never give advice (no buy/sell/hold, no "investors should").
Every number you use must appear in the stories, written the same way. If the stories are thin, describe what they say without guessing.
Return JSON {"body": "..."}.`;

export function digestPrompt(kind: DigestKind, stories: DigestStory[]): string {
  const task = kind === 'morning'
    ? 'Task: a "morning market mood" note before the Indian market opens: the main overnight global cues and the key Indian market news.'
    : 'Task: a "market open" note: how Indian markets (Sensex/Nifty) opened today and the main reason, based on the stories.';
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

/** Which scheduled note is due now (weekdays only). Windows let a missed cron run catch up. */
export function dueDigest(now: number): DigestKind | null {
  const { minutes, weekday } = istClock(now);
  if (weekday === 0 || weekday === 6) return null;
  if (minutes >= 8 * 60 + 40 && minutes < 9 * 60 + 10) return 'morning';
  if (minutes >= 9 * 60 + 30 && minutes < 10 * 60) return 'market_open';
  return null;
}
