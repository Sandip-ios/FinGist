import type { FeedItem, Source, Story } from '../types';

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', rupee: '₹', euro: '€', pound: '£',
};

export function decodeEntities(s: string): string {
  // Run twice: some feeds double-encode (&amp;amp;).
  let out = s;
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&#(\d+);/g, (_, d: string) => safeChar(parseInt(d, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => safeChar(parseInt(h, 16)))
      .replace(/&([a-z]+);/gi, (m, n: string) => NAMED[n.toLowerCase()] ?? m);
  }
  return out;
}

function safeChar(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

export function stripHtml(s: string): string {
  return decodeEntities(
    decodeEntities(s)
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

const TRACKING = /^(utm_|fbclid$|gclid$|ref$|ref_src$|cmpid$|mod$|src$|from$|yptr$|ncid$|__source$)/i;

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.protocol = 'https:';
    return u.toString();
  } catch {
    return raw.trim();
  }
}

export async function storyId(url: string): Promise<string> {
  const data = new TextEncoder().encode(url);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function parseDate(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const v = s.trim();
  // NSE style "24-Nov-2026 14:05:00" has no zone: it is IST. (Checked first because
  // Date.parse would silently read it in the server's local zone.)
  const m = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  const t = m ? Date.parse(`${m[2]} ${m[1]} ${m[3]} ${m[4]}:${m[5]}:${m[6] ?? '00'} GMT+0530`) : Date.parse(v);
  return Number.isNaN(t) ? undefined : t;
}

export const SNIPPET_MAX = 700;

export async function toStory(item: FeedItem, source: Source, now: number): Promise<Story | undefined> {
  const title = stripHtml(item.title);
  if (title.length < 8) return undefined;
  const url = canonicalUrl(decodeEntities(item.link));
  // Only web links: never javascript:, data: or app links from a feed.
  if (!/^https:\/\/[^/]/i.test(url)) return undefined;
  let snippet = stripHtml(item.description);
  if (snippet.toLowerCase() === title.toLowerCase()) snippet = '';
  if (snippet.length > SNIPPET_MAX) snippet = snippet.slice(0, SNIPPET_MAX).replace(/\s\S*$/, '') + '…';
  const published = parseDate(item.published);
  return {
    id: await storyId(url),
    sourceId: source.id,
    sourceName: source.name,
    url,
    title,
    snippet,
    region: source.region,
    kind: source.kind,
    // Missing or future-dated timestamps fall back to "now".
    publishedAt: published && published <= now + 5 * 60_000 ? published : now,
    fetchedAt: now,
  };
}
