import { CATEGORIES, REGION_IMPACT, RELEVANCE, SENTIMENTS, type Story } from '../types';

export const SYSTEM_PROMPT = `You write news cards for FinGist, a financial news app for Indian and global retail investors.

For EACH story you receive (headline + short feed description), return:
- summary: 30 to 50 words of plain, simple English that explains what happened and why it matters to markets.
  * Use ONLY facts in the headline/description. Never invent numbers, dates, names, reasons or quotes.
  * Every number you write must appear in the input. Keep units and currency as given (₹, crore, $, bn, %).
  * Neutral, factual tone. No opinions, no predictions, no hype, no clickbait.
  * Never pad. Do not add generic filler such as "this reflects the company's performance",
    "provides insights into", "investors will watch closely" or "this is significant for the market".
    Instead, add useful context that IS in the input (who, what changed, by how much, why).
  * NEVER give investment advice: no buy/sell/hold, no target prices, no "investors should".
  * If the input is too thin to write 30 words without guessing or padding, set insufficient_info=true and write a shorter factual summary (15-30 words).
- category: one of ${CATEGORIES.join(', ')}.
- sentiment: likely tone of the news for the companies/market involved: ${SENTIMENTS.join(', ')}. Use neutral when unclear.
- relevance: how much this matters to stock-market investors: ${RELEVANCE.join(', ')}.
  high = market-wide move, major policy/rate decision, big results or deals of large listed companies.
  low = minor, local, routine or only loosely market-related.
- market_relevant: false if the story is not about markets, companies, economy, money or finance at all (e.g. sports, entertainment, lifestyle, horoscope).
- region_impact: ${REGION_IMPACT.join(', ')}.
- companies: listed companies the story is mainly about (max 4). symbol = official exchange ticker if you are confident, else null.
  exchange = NSE, BSE, NYSE, NASDAQ, LSE, etc., or null. Prefer NSE for Indian companies. Do not include unlisted companies' symbols.

Return a JSON array with one object per input story, in any order, each carrying the story's "id".`;

export function buildUserPrompt(stories: Story[]): string {
  const payload = stories.map((s) => ({
    id: s.id,
    source: s.sourceName,
    source_type: s.kind,
    region: s.region,
    published: new Date(s.publishedAt).toISOString(),
    headline: s.title,
    description: s.snippet || '(none)',
  }));
  return `Stories:\n${JSON.stringify(payload, null, 1)}`;
}

/** Gemini responseSchema (OpenAPI subset). */
export const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      id: { type: 'STRING' },
      summary: { type: 'STRING' },
      insufficient_info: { type: 'BOOLEAN' },
      category: { type: 'STRING', enum: [...CATEGORIES] },
      sentiment: { type: 'STRING', enum: [...SENTIMENTS] },
      relevance: { type: 'STRING', enum: [...RELEVANCE] },
      market_relevant: { type: 'BOOLEAN' },
      region_impact: { type: 'STRING', enum: [...REGION_IMPACT] },
      companies: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            symbol: { type: 'STRING', nullable: true },
            exchange: { type: 'STRING', nullable: true },
          },
          required: ['name'],
        },
      },
    },
    required: ['id', 'summary', 'category', 'sentiment', 'relevance', 'market_relevant', 'region_impact', 'companies'],
  },
} as const;
