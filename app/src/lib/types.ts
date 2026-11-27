export type Region = 'india' | 'global' | 'both';
export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed';
export type Relevance = 'high' | 'medium' | 'low';

export interface Company {
  name: string;
  symbol: string | null;
  exchange: string | null;
}

/** One card, as returned by GET /v1/feed. */
export interface Story {
  id: string;
  title: string;
  summary: string | null;
  /** pending = summary still being prepared; unavailable = headline only. */
  summaryStatus: 'ready' | 'pending' | 'unavailable';
  source: string;
  url: string;
  category: string | null;
  sentiment: Sentiment | null;
  relevance: Relevance | null;
  region: Region;
  kind: 'news' | 'filing' | 'regulator';
  companies: Company[];
  publishedAt: number;
  /** Representative photo (Unsplash/Pexels, free licence) with credit; null = coloured banner. */
  image?: StoryImage | null;
}

export interface StoryImage {
  url: string;
  photographer: string;
  photographerUrl: string;
  pageUrl: string;
  /** "Unsplash" or "Pexels" */
  providerName: string;
  color: string | null;
}

export interface FeedPage {
  items: Story[];
  nextBefore: number | null;
}

export type RegionFilter = 'all' | 'india' | 'global';

export interface TrendingCompany {
  name: string;
  symbol: string | null;
  count: number;
}
