/**
 * Free-licence stock photos used as representative card images.
 * Providers: Unsplash (UNSPLASH_ACCESS_KEY) or Pexels (PEXELS_API_KEY).
 */
export type PhotoProvider = 'unsplash' | 'pexels';

export interface Photo {
  url: string; // landscape, ~1080-1200px wide, hotlinked from the provider's CDN
  photographer: string;
  photographerUrl: string;
  pageUrl: string; // photo page on the provider's site
  provider: PhotoProvider;
  avgColor: string | null;
  /** @deprecated older cache rows (Pexels) */
  pexelsUrl?: string;
}

export interface PhotoSource {
  provider: PhotoProvider;
  search(query: string): Promise<Photo[]>;
}

// Unsplash asks apps to add these to links back to Unsplash and photographers.
const UTM = 'utm_source=fingist&utm_medium=referral';
const withUtm = (u: string) => `${u}${u.includes('?') ? '&' : '?'}${UTM}`;

export function unsplashSource(accessKey: string, perPage = 8): PhotoSource {
  const headers = { authorization: `Client-ID ${accessKey}`, 'accept-version': 'v1' };
  return {
    provider: 'unsplash',
    async search(query) {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&content_filter=high`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Unsplash HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as {
        results?: {
          color?: string;
          urls?: { raw?: string; regular?: string };
          links?: { html?: string; download_location?: string };
          user?: { name?: string; links?: { html?: string } };
        }[];
      };
      const photos: Photo[] = [];
      for (const r of data.results ?? []) {
        const base = r.urls?.raw ?? r.urls?.regular;
        if (!base || !base.startsWith('https://images.unsplash.com/')) continue;
        photos.push({
          url: `${base}${base.includes('?') ? '&' : '?'}w=1200&q=75&fm=jpg&fit=crop&ar=16:9`,
          photographer: r.user?.name ?? 'Unsplash',
          photographerUrl: withUtm(r.user?.links?.html ?? 'https://unsplash.com'),
          pageUrl: withUtm(r.links?.html ?? 'https://unsplash.com'),
          provider: 'unsplash',
          avgColor: r.color ?? null,
        });
        // Unsplash API guideline: tell Unsplash when a photo is put into use.
        if (r.links?.download_location) {
          await fetch(r.links.download_location, { headers }).catch(() => {});
        }
      }
      return photos;
    },
  };
}

export function pexelsSource(apiKey: string, perPage = 15): PhotoSource {
  return {
    provider: 'pexels',
    async search(query) {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&size=medium`;
      const res = await fetch(url, { headers: { authorization: apiKey } });
      if (!res.ok) throw new Error(`Pexels HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as {
        photos?: { url: string; photographer: string; photographer_url: string; avg_color?: string; src?: { landscape?: string; large?: string } }[];
      };
      return (data.photos ?? [])
        .map((p): Photo => ({
          url: p.src?.landscape ?? p.src?.large ?? '',
          photographer: p.photographer,
          photographerUrl: p.photographer_url,
          pageUrl: p.url,
          provider: 'pexels',
          avgColor: p.avg_color ?? null,
        }))
        .filter((p) => p.url.startsWith('https://images.pexels.com/'));
    },
  };
}

/** Picks the configured provider; Unsplash first. */
export function photoSourceFromEnv(env: { UNSPLASH_ACCESS_KEY?: string; PEXELS_API_KEY?: string }): PhotoSource | null {
  if (env.UNSPLASH_ACCESS_KEY) return unsplashSource(env.UNSPLASH_ACCESS_KEY);
  if (env.PEXELS_API_KEY) return pexelsSource(env.PEXELS_API_KEY);
  return null;
}

/** Deterministic choice so a story always shows the same photo. */
export function pickPhoto(photos: Photo[], storyId: string): Photo | null {
  if (!photos.length) return null;
  let h = 0;
  for (let i = 0; i < storyId.length; i++) h = (h * 31 + storyId.charCodeAt(i)) >>> 0;
  return photos[h % photos.length] ?? null;
}
