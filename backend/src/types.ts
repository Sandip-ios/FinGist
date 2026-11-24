export type Region = 'india' | 'global';
export type SourceKind = 'news' | 'filing' | 'regulator';

export interface Source {
  id: string;
  name: string;
  url: string;
  region: Region;
  kind: SourceKind;
  /** Minimum minutes between polls of this feed. */
  pollMinutes: number;
  enabled: boolean;
  /** Extra request headers some official sites require. */
  headers?: Record<string, string>;
  note?: string;
}

/** One entry as parsed from an RSS/Atom feed, before cleaning. */
export interface FeedItem {
  title: string;
  link: string;
  description: string;
  published?: string;
  guid?: string;
}

/** A cleaned, normalized story ready to store / enrich. */
export interface Story {
  id: string;
  sourceId: string;
  sourceName: string;
  url: string;
  title: string;
  snippet: string;
  region: Region;
  kind: SourceKind;
  publishedAt: number;
  fetchedAt: number;
}

export const CATEGORIES = [
  'markets',
  'stocks',
  'earnings',
  'ipo',
  'economy',
  'policy',
  'banking',
  'global',
  'commodities',
  'currency',
  'corporate_action',
  'mutual_funds',
  'crypto',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SENTIMENTS = ['positive', 'negative', 'neutral', 'mixed'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const RELEVANCE = ['high', 'medium', 'low'] as const;
export type Relevance = (typeof RELEVANCE)[number];

export const REGION_IMPACT = ['india', 'global', 'both'] as const;
export type RegionImpact = (typeof REGION_IMPACT)[number];

export interface Company {
  name: string;
  symbol: string | null;
  exchange: string | null;
}

export interface Enrichment {
  /** null => card shows the original headline only. */
  summary: string | null;
  category: Category;
  sentiment: Sentiment;
  relevance: Relevance;
  regionImpact: RegionImpact;
  marketRelevant: boolean;
  companies: Company[];
  /** Validation notes, e.g. "unverified_number:12.5". */
  flags: string[];
}
