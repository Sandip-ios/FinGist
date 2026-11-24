import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dedupeList, isNearDuplicate, jaccard, titleTokens } from '../src/ingest/dedupe';
import { isFresh, isRoutine } from '../src/ingest/filter';
import { canonicalUrl, decodeEntities, parseDate, stripHtml, toStory } from '../src/ingest/normalize';
import { parseFeed } from '../src/ingest/parse';
import type { Source, Story } from '../src/types';

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const src: Source = { id: 't', name: 'Test', url: 'https://example.com/rss', region: 'india', kind: 'news', pollMinutes: 3, enabled: true };
const NOW = Date.parse('2026-11-24T00:00:00Z');

describe('parseFeed', () => {
  it('parses RSS with CDATA, entities and dc:date; skips items without link', () => {
    const items = parseFeed(fx('rss.xml'));
    expect(items).toHaveLength(2);
    expect(items[0]!.title).toBe('Sensex jumps 500 points as banks rally; Nifty ends above 24,000');
    expect(items[0]!.link).toContain('https://example.com/markets/sensex-jumps');
    expect(items[1]!.published).toBe('2026-11-23T08:00:00Z');
  });
  it('parses Atom and prefers the alternate link', () => {
    const items = parseFeed(fx('atom.xml'));
    expect(items).toHaveLength(1);
    expect(items[0]!.link).toBe('https://example.org/news/fed-holds');
    expect(items[0]!.description).toContain('Federal Reserve');
  });
});

describe('normalize', () => {
  it('cleans HTML and entities', () => {
    expect(stripHtml('<p>A &amp; B</p><img src=x>  C')).toBe('A & B C');
    expect(decodeEntities('Infosys&#8217;s &amp;amp; co')).toBe('Infosys’s & co');
  });
  it('removes tracking params and hash', () => {
    expect(canonicalUrl('http://Example.com/a?utm_source=x&id=1#top')).toBe('https://example.com/a?id=1');
  });
  it('parses dates incl. NSE style as IST', () => {
    expect(parseDate('Mon, 23 Nov 2026 10:30:00 +0530')).toBe(Date.parse('2026-11-23T05:00:00Z'));
    expect(parseDate('24-Nov-2026 14:05:00')).toBe(Date.parse('2026-11-24T08:35:00Z'));
    expect(parseDate('garbage')).toBeUndefined();
  });
  it('builds a story with stable id and clean snippet', async () => {
    const [item] = parseFeed(fx('rss.xml'));
    const a = await toStory(item!, src, NOW);
    const b = await toStory({ ...item!, link: item!.link + '&utm_campaign=z' }, src, NOW);
    expect(a!.id).toBe(b!.id);
    expect(a!.snippet).toBe('Benchmark indices closed higher on Monday, led by HDFC Bank & ICICI Bank.');
    expect(a!.url).toBe('https://example.com/markets/sensex-jumps?id=42');
  });
  it('replaces future timestamps with now', async () => {
    const s = await toStory({ title: 'Future dated story headline', link: 'https://e.com/x', description: '', published: '2030-01-01T00:00:00Z' }, src, NOW);
    expect(s!.publishedAt).toBe(NOW);
  });
});

const story = (title: string, extra: Partial<Story> = {}): Story => ({
  id: title, sourceId: 't', sourceName: 'T', url: 'https://e.com', title, snippet: '', region: 'india', kind: 'news', publishedAt: NOW, fetchedAt: NOW, ...extra,
});

describe('filters', () => {
  it('drops stale stories', () => {
    expect(isFresh(story('x', { publishedAt: NOW - 49 * 3_600_000 }), NOW, 48)).toBe(false);
    expect(isFresh(story('x', { publishedAt: NOW - 2 * 3_600_000 }), NOW, 48)).toBe(true);
  });
  it('drops routine filings but keeps material ones', () => {
    expect(isRoutine(story('ABC Ltd - Closure of Trading Window', { kind: 'filing' }))).toBe(true);
    expect(isRoutine(story('XYZ Ltd - Copy of Newspaper Publication', { kind: 'filing' }))).toBe(true);
    expect(isRoutine(story('XYZ Ltd - Outcome of Board Meeting: Dividend declared', { kind: 'filing' }))).toBe(false);
    expect(isRoutine(story('Your daily horoscope for investors'))).toBe(true);
  });
});

describe('dedupe', () => {
  it('detects the same event worded differently', () => {
    const a = titleTokens('Sensex jumps 500 points as banks rally, Nifty ends above 24,000');
    const b = titleTokens('Sensex jumps 500 points, Nifty ends above 24,000 as bank stocks rally');
    expect(jaccard(a, b)).toBeGreaterThanOrEqual(0.6);
    expect(isNearDuplicate(b, [a])).toBe(true);
  });
  it('keeps different stories apart', () => {
    const a = titleTokens('Infosys Q2 profit rises 6.5% to ₹7,364 crore');
    const b = titleTokens('TCS Q2 profit rises 5% to ₹12,000 crore');
    expect(isNearDuplicate(b, [a])).toBe(false);
  });
  it('dedupeList keeps first occurrence', () => {
    const { kept, dropped } = dedupeList(
      ['RBI keeps repo rate unchanged at 6.5%', 'RBI keeps repo rate unchanged at 6.5 per cent', 'Gold prices fall on strong dollar'],
      (t) => t,
    );
    expect(kept).toEqual(['RBI keeps repo rate unchanged at 6.5%', 'Gold prices fall on strong dollar']);
    expect(dropped).toHaveLength(1);
  });
});
