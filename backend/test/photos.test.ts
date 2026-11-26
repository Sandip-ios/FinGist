import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATEGORY_DEFAULT_TOPIC, IMAGE_TOPICS } from '../src/data/imageTopics';
import { pexelsSource, photoSourceFromEnv, pickPhoto, unsplashSource, type Photo } from '../src/enrich/photos';
import { CATEGORIES } from '../src/types';

const photo = (n: number): Photo => ({ url: `https://images.unsplash.com/p${n}`, photographer: `P${n}`, photographerUrl: 'u', pageUrl: 'p', provider: 'unsplash', avgColor: null });

afterEach(() => vi.unstubAllGlobals());

describe('unsplash', () => {
  it('maps results, adds referral links, and pings the download endpoint', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push(url);
      expect((init.headers as Record<string, string>).authorization).toBe('Client-ID KEY');
      if (url.includes('/search/photos')) {
        expect(url).toContain('query=gold%20bars');
        return new Response(JSON.stringify({ results: [
          { color: '#c0a040', urls: { raw: 'https://images.unsplash.com/photo-1?ixid=abc' }, links: { html: 'https://unsplash.com/photos/1', download_location: 'https://api.unsplash.com/photos/1/download' }, user: { name: 'Asha', links: { html: 'https://unsplash.com/@asha' } } },
          { urls: { raw: 'https://evil.example/x.jpg' }, user: { name: 'Bad' } },
        ] }));
      }
      return new Response('{}');
    }));
    const r = await unsplashSource('KEY').search('gold bars');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      url: 'https://images.unsplash.com/photo-1?ixid=abc&w=1200&q=75&fm=jpg&fit=crop&ar=16:9',
      photographer: 'Asha',
      photographerUrl: 'https://unsplash.com/@asha?utm_source=fingist&utm_medium=referral',
      pageUrl: 'https://unsplash.com/photos/1?utm_source=fingist&utm_medium=referral',
      provider: 'unsplash',
      avgColor: '#c0a040',
    });
    expect(calls).toContain('https://api.unsplash.com/photos/1/download');
  });
  it('throws on API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Rate Limit Exceeded', { status: 403 })));
    await expect(unsplashSource('K').search('x')).rejects.toThrow('Unsplash HTTP 403');
  });
});

describe('pexels', () => {
  it('maps results and keeps only Pexels-hosted images', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ photos: [
      { url: 'https://www.pexels.com/photo/1/', photographer: 'Asha', photographer_url: 'https://www.pexels.com/@asha', avg_color: '#AA9900', src: { landscape: 'https://images.pexels.com/photos/1/a.jpeg' } },
      { url: 'x', photographer: 'Bad', photographer_url: 'x', src: { landscape: 'https://evil.example/a.jpg' } },
    ] }))));
    const r = await pexelsSource('KEY').search('gold');
    expect(r).toEqual([{ url: 'https://images.pexels.com/photos/1/a.jpeg', photographer: 'Asha', photographerUrl: 'https://www.pexels.com/@asha', pageUrl: 'https://www.pexels.com/photo/1/', provider: 'pexels', avgColor: '#AA9900' }]);
  });
});

describe('helpers', () => {
  it('chooses provider from env, Unsplash first', () => {
    expect(photoSourceFromEnv({ UNSPLASH_ACCESS_KEY: 'a', PEXELS_API_KEY: 'b' })?.provider).toBe('unsplash');
    expect(photoSourceFromEnv({ PEXELS_API_KEY: 'b' })?.provider).toBe('pexels');
    expect(photoSourceFromEnv({})).toBeNull();
  });
  it('picks the same photo for the same story', () => {
    const list = [photo(1), photo(2), photo(3)];
    expect(pickPhoto(list, 'abc')).toEqual(pickPhoto(list, 'abc'));
    expect(pickPhoto([], 'abc')).toBeNull();
  });
  it('has a default topic for every category', () => {
    for (const c of CATEGORIES) expect(IMAGE_TOPICS[CATEGORY_DEFAULT_TOPIC[c]]).toBeTruthy();
  });
});
