import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickPhoto, searchPhotos, type Photo } from '../src/enrich/pexels';
import { CATEGORY_DEFAULT_TOPIC, IMAGE_TOPICS } from '../src/data/imageTopics';
import { CATEGORIES } from '../src/types';

const photo = (n: number): Photo => ({ url: `https://images.pexels.com/photos/${n}/p.jpeg`, photographer: `P${n}`, photographerUrl: 'https://www.pexels.com/@p', pexelsUrl: `https://www.pexels.com/photo/${n}/`, avgColor: '#333333' });

afterEach(() => vi.unstubAllGlobals());

describe('pexels', () => {
  it('maps API results and keeps only Pexels-hosted images', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toContain('query=gold%20bars');
      expect((init.headers as Record<string, string>).authorization).toBe('KEY');
      return new Response(JSON.stringify({ photos: [
        { url: 'https://www.pexels.com/photo/1/', photographer: 'Asha', photographer_url: 'https://www.pexels.com/@asha', avg_color: '#AA9900', src: { landscape: 'https://images.pexels.com/photos/1/a.jpeg?w=1200' } },
        { url: 'x', photographer: 'Bad', photographer_url: 'x', src: { landscape: 'https://evil.example/a.jpg' } },
      ] }));
    }));
    const r = await searchPhotos('KEY', 'gold bars');
    expect(r).toEqual([{ url: 'https://images.pexels.com/photos/1/a.jpeg?w=1200', photographer: 'Asha', photographerUrl: 'https://www.pexels.com/@asha', pexelsUrl: 'https://www.pexels.com/photo/1/', avgColor: '#AA9900' }]);
  });
  it('throws on API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    await expect(searchPhotos('BAD', 'x')).rejects.toThrow('Pexels HTTP 401');
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
