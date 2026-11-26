export interface Photo {
  url: string; // landscape, ~1200px wide
  photographer: string;
  photographerUrl: string;
  pexelsUrl: string;
  avgColor: string | null;
}

/** Searches Pexels (free licence, commercial use allowed). Requires a free API key. */
export async function searchPhotos(apiKey: string, query: string, perPage = 15): Promise<Photo[]> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&size=medium`;
  const res = await fetch(url, { headers: { authorization: apiKey } });
  if (!res.ok) throw new Error(`Pexels HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    photos?: { url: string; photographer: string; photographer_url: string; avg_color?: string; src?: { landscape?: string; large?: string } }[];
  };
  return (data.photos ?? [])
    .map((p) => ({
      url: p.src?.landscape ?? p.src?.large ?? '',
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      pexelsUrl: p.url,
      avgColor: p.avg_color ?? null,
    }))
    .filter((p) => p.url.startsWith('https://images.pexels.com/'));
}

/** Deterministic choice so a story always shows the same photo. */
export function pickPhoto(photos: Photo[], storyId: string): Photo | null {
  if (!photos.length) return null;
  let h = 0;
  for (let i = 0; i < storyId.length; i++) h = (h * 31 + storyId.charCodeAt(i)) >>> 0;
  return photos[h % photos.length] ?? null;
}
