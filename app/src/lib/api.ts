import { config } from './config';
import type { FeedPage, RegionFilter, Story, TrendingCompany } from './types';

const API_URL = config.apiUrl;

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

export async function fetchStory(id: string): Promise<Story | null> {
  const res = await fetch(`${API_URL}/v1/story/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  return (await res.json()) as Story;
}

export async function saveDevice(d: { token: string; platform: string; region: RegionFilter; quietHours: boolean; morning: boolean; marketOpen: boolean; breaking: boolean }): Promise<void> {
  const res = await fetch(`${API_URL}/v1/devices`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) });
  if (!res.ok) throw new Error(`Server error (${res.status})`);
}

export async function removeDevice(token: string): Promise<void> {
  await fetch(`${API_URL}/v1/devices`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
}

export interface TestAlertResult { ok: boolean; stage: string; error?: string; message?: string }

export async function sendTestAlert(token: string): Promise<TestAlertResult> {
  const res = await fetch(`${API_URL}/v1/devices/test`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
  if (res.status === 404) return { ok: false, stage: 'server', error: 'OldServer', message: 'The server needs the latest update (npm run deploy).' };
  if (!res.ok) return { ok: false, stage: 'server', error: `HTTP ${res.status}` };
  return (await res.json()) as TestAlertResult;
}
