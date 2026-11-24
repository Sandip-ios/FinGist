import type { FeedItem } from '../types';

/**
 * Small, dependency-free RSS 2.0 / Atom parser.
 * Feeds are simple and we only need five fields, so regex extraction is fast
 * enough to stay inside the Workers free-plan CPU limit.
 */
const ITEM_RE = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;

export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const m of xml.matchAll(ITEM_RE)) {
    const block = m[2] ?? '';
    const title = text(block, ['title']);
    const link = linkOf(block);
    if (!title || !link) continue;
    items.push({
      title,
      link,
      description: text(block, ['description', 'summary', 'content:encoded', 'content']) ?? '',
      published: text(block, ['pubDate', 'published', 'updated', 'dc:date', 'a10:updated']),
      guid: text(block, ['guid', 'id']),
    });
  }
  return items;
}

function text(block: string, names: string[]): string | undefined {
  for (const n of names) {
    const re = new RegExp(`<${escape(n)}\\b[^>]*?(?:/>|>([\\s\\S]*?)</${escape(n)}>)`, 'i');
    const m = block.match(re);
    if (m && m[1] !== undefined) {
      const v = unwrapCdata(m[1]).trim();
      if (v) return v;
    }
  }
  return undefined;
}

function linkOf(block: string): string | undefined {
  // RSS: <link>https://...</link>
  const rss = block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
  if (rss?.[1]) {
    const v = unwrapCdata(rss[1]).trim();
    if (/^https?:\/\//i.test(v)) return v;
  }
  // Atom: <link rel="alternate" href="..."/>  (prefer alternate, else first href)
  const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((x) => x[1] ?? '');
  const alt = links.find((a) => /rel\s*=\s*["']alternate["']/i.test(a)) ?? links.find((a) => !/rel\s*=/i.test(a)) ?? links[0];
  const href = alt?.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
  if (href && /^https?:\/\//i.test(href)) return href;
  // Some feeds only put the URL in <guid isPermaLink="true">
  const guid = text(block, ['guid']);
  if (guid && /^https?:\/\//i.test(guid)) return guid;
  return undefined;
}

function unwrapCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
