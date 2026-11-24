import { USER_AGENT } from '../config/sources';
import type { Source } from '../types';

export interface FetchResult {
  status: 'ok' | 'not_modified' | 'error';
  body?: string;
  etag?: string;
  lastModified?: string;
  error?: string;
  httpStatus?: number;
}

export async function fetchFeed(
  source: Source,
  prev: { etag?: string | null; lastModified?: string | null } = {},
  timeoutMs = 12_000,
): Promise<FetchResult> {
  const headers: Record<string, string> = {
    'user-agent': USER_AGENT,
    accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
    ...source.headers,
  };
  if (prev.etag) headers['if-none-match'] = prev.etag;
  if (prev.lastModified) headers['if-modified-since'] = prev.lastModified;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(source.url, { headers, signal: ctrl.signal, redirect: 'follow' });
    if (res.status === 304) return { status: 'not_modified', httpStatus: 304 };
    if (!res.ok) return { status: 'error', httpStatus: res.status, error: `HTTP ${res.status}` };
    const body = await res.text();
    if (!/<(rss|feed|rdf:RDF)\b/i.test(body.slice(0, 2000))) {
      return { status: 'error', httpStatus: res.status, error: 'response is not an RSS/Atom feed' };
    }
    return {
      status: 'ok',
      body,
      etag: res.headers.get('etag') ?? undefined,
      lastModified: res.headers.get('last-modified') ?? undefined,
      httpStatus: res.status,
    };
  } catch (e) {
    return { status: 'error', error: (e as Error).name === 'AbortError' ? 'timeout' : String((e as Error).message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}
