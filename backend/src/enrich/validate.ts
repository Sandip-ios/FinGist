import { isKnownSymbol } from '../data/tickers';
import {
  CATEGORIES, REGION_IMPACT, RELEVANCE, SENTIMENTS,
  type Category, type Company, type Enrichment, type RegionImpact, type Relevance, type Sentiment, type Story,
} from '../types';

export const MIN_WORDS = 25;
/** Shortest summary kept when the model says the source was thin. */
export const MIN_WORDS_THIN = 15;
export const MAX_WORDS = 60;

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Numbers in a text, normalized ("1,200.50" -> "1200.5"). Single digits are ignored (too noisy: "one"/"1"). */
export function numbersIn(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of s.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = parseFloat(m[0].replace(/,/g, ''));
    if (!Number.isFinite(n) || (Number.isInteger(n) && n < 10)) continue;
    out.add(String(n));
  }
  return out;
}

const ADVICE = /\b(you should|investors should|consider (buying|selling)|good time to (buy|sell)|target price|strong buy|recommend(s|ed)? (buying|selling)|must buy|buy now|sell now)\b/i;

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/**
 * Checks one AI result against its source story. Anything doubtful falls back
 * to the safe option: no summary (headline only), unknown ticker removed.
 */
export function validateEnrichment(story: Story, raw: Record<string, unknown>): Enrichment {
  const flags: string[] = [];
  let summary = typeof raw.summary === 'string' ? raw.summary.replace(/\s+/g, ' ').trim() : '';

  if (summary) {
    const words = wordCount(summary);
    if (raw.insufficient_info === true) flags.push('insufficient_info');
    if (words < MIN_WORDS && raw.insufficient_info !== true) flags.push(`too_short:${words}`);
    if (words > MAX_WORDS) flags.push(`too_long:${words}`);

    const source = numbersIn(`${story.title} ${story.snippet}`);
    const unverified = [...numbersIn(summary)].filter((n) => !source.has(n));
    if (unverified.length) flags.push(`unverified_number:${unverified.join(',')}`);
    if (ADVICE.test(summary)) flags.push('advice_language');

    const reject = unverified.length > 0 || words > MAX_WORDS || flags.includes('advice_language') || words < MIN_WORDS_THIN;
    if (reject) summary = '';
  } else {
    flags.push('empty_summary');
  }

  const companies: Company[] = [];
  if (Array.isArray(raw.companies)) {
    for (const c of raw.companies.slice(0, 4) as Record<string, unknown>[]) {
      const name = typeof c?.name === 'string' ? c.name.trim() : '';
      if (!name) continue;
      let symbol = typeof c.symbol === 'string' && c.symbol.trim() ? c.symbol.trim().toUpperCase() : null;
      const exchange = typeof c.exchange === 'string' && c.exchange.trim() ? c.exchange.trim().toUpperCase() : null;
      if (symbol && !isKnownSymbol(symbol, exchange)) {
        flags.push(`unknown_symbol:${symbol}`);
        symbol = null;
      }
      companies.push({ name, symbol, exchange: symbol ? exchange : null });
    }
  }

  return {
    summary: summary || null,
    category: pick<Category>(raw.category, CATEGORIES, 'other'),
    sentiment: pick<Sentiment>(raw.sentiment, SENTIMENTS, 'neutral'),
    relevance: pick<Relevance>(raw.relevance, RELEVANCE, 'low'),
    regionImpact: pick<RegionImpact>(raw.region_impact, REGION_IMPACT, story.region === 'india' ? 'india' : 'global'),
    marketRelevant: raw.market_relevant !== false,
    companies,
    flags,
  };
}
