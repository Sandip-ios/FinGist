import { fetchFeed, type FetchResult } from './ingest/fetchFeed';
import { isFresh, isRoutine } from './ingest/filter';
import { toStory } from './ingest/normalize';
import { parseFeed } from './ingest/parse';
import type { Source, Story } from './types';

export interface CollectResult {
  fetch: FetchResult;
  parsed: number;
  stories: Story[];
  stale: number;
  routine: number;
}

/** Fetch + parse + clean + filter one source. Platform-independent (Workers and Node). */
export async function collectSource(
  source: Source,
  now: number,
  maxAgeHours: number,
  prev?: { etag?: string | null; lastModified?: string | null },
): Promise<CollectResult> {
  const fetch = await fetchFeed(source, prev);
  if (fetch.status !== 'ok' || !fetch.body) return { fetch, parsed: 0, stories: [], stale: 0, routine: 0 };
  const items = parseFeed(fetch.body);
  let stale = 0;
  let routine = 0;
  const stories: Story[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const s = await toStory(item, source, now);
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    if (!isFresh(s, now, maxAgeHours)) { stale++; continue; }
    if (isRoutine(s)) { routine++; continue; }
    stories.push(s);
  }
  return { fetch, parsed: items.length, stories, stale, routine };
}
