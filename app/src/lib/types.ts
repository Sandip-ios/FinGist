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
  /** pending = AI summary still being written; unavailable = headline only. */
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
}

export interface FeedPage {
  items: Story[];
  nextBefore: number | null;
}

export type RegionFilter = 'all' | 'india' | 'global';
