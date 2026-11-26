import Constants from 'expo-constants';
import type { FeedPage, RegionFilter, TrendingCompany } from './types';

const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'https://fingist-api.fingist-sandip.workers.dev';

export async function fetchFeed(opts: {
  region: RegionFilter;
  category: string | null;
  before?: number | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: String(opts.limit ?? 30) });
  if (opts.region !== 'all') params.set('region', opts.region);
  if (opts.category) params.set('category', opts.category);
  if (opts.before) params.set('before', String(opts.before));
  const res = await fetch(`${API_URL}/v1/feed?${params}`, { signal: opts.signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  return (await res.json()) as FeedPage;
}

export async function searchStories(opts: { q: string; before?: number | null; signal?: AbortSignal }): Promise<FeedPage> {
  const params = new URLSearchParams({ q: opts.q, limit: '30' });
  if (opts.before) params.set('before', String(opts.before));
  const res = await fetch(`${API_URL}/v1/search?${params}`, { signal: opts.signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  return (await res.json()) as FeedPage;
}

export async function fetchTrending(signal?: AbortSignal): Promise<TrendingCompany[]> {
  const res = await fetch(`${API_URL}/v1/trending`, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  return ((await res.json()) as { companies: TrendingCompany[] }).companies;
}
