import { describe, expect, it } from 'vitest';
import { numbersIn, validateEnrichment, wordCount } from '../src/enrich/validate';
import type { Story } from '../src/types';

const story: Story = {
  id: 's1', sourceId: 't', sourceName: 'T', url: 'https://e.com', region: 'india', kind: 'news', publishedAt: 0, fetchedAt: 0,
  title: 'Infosys Q2 profit rises 6.5% to ₹7,364 crore',
  snippet: 'Infosys net profit rose 6.5% year-on-year to ₹7,364 crore on strong deal wins; revenue grew 8.7%.',
};
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${String.fromCharCode(97 + (i % 26))}`).join(' ');
const base = { id: 's1', category: 'earnings', sentiment: 'positive', relevance: 'high', market_relevant: true, region_impact: 'india', companies: [] };

describe('validateEnrichment', () => {
  it('accepts a grounded 30-50 word summary', () => {
    const summary = `Infosys reported a 6.5% rise in quarterly net profit to ₹7,364 crore, helped by strong deal wins, while revenue grew 8.7%. ${words(20)}`;
    const e = validateEnrichment(story, { ...base, summary });
    expect(e.summary).toBe(summary);
    expect(e.flags).toEqual([]);
    expect(e.category).toBe('earnings');
  });
  it('rejects summaries with numbers not present in the source', () => {
    const e = validateEnrichment(story, { ...base, summary: `Infosys profit rose 12% to ₹9,000 crore. ${words(30)}` });
    expect(e.summary).toBeNull();
    expect(e.flags.some((f) => f.startsWith('unverified_number'))).toBe(true);
  });
  it('rejects advice language', () => {
    const e = validateEnrichment(story, { ...base, summary: `Infosys profit rose 6.5%. Investors should buy the stock now. ${words(30)}` });
    expect(e.summary).toBeNull();
    expect(e.flags).toContain('advice_language');
  });
  it('rejects overly long summaries', () => {
    expect(validateEnrichment(story, { ...base, summary: words(80) }).summary).toBeNull();
  });
  it('drops unknown tickers but keeps the company name', () => {
    const e = validateEnrichment(story, { ...base, summary: words(35), companies: [{ name: 'Infosys', symbol: 'infy', exchange: 'NSE' }, { name: 'Foo Corp', symbol: 'FOOX', exchange: 'NSE' }] });
    expect(e.companies).toEqual([{ name: 'Infosys', symbol: 'INFY', exchange: 'NSE' }, { name: 'Foo Corp', symbol: null, exchange: null }]);
    expect(e.flags).toContain('unknown_symbol:FOOX');
  });
  it('coerces invalid enums to safe defaults', () => {
    const e = validateEnrichment(story, { ...base, summary: words(35), category: 'gossip', sentiment: 'bullish', relevance: 'huge' });
    expect([e.category, e.sentiment, e.relevance]).toEqual(['other', 'neutral', 'low']);
  });
  it('marks non-market stories', () => {
    expect(validateEnrichment(story, { ...base, summary: words(35), market_relevant: false }).marketRelevant).toBe(false);
  });
});

describe('helpers', () => {
  it('normalizes numbers', () => {
    expect([...numbersIn('₹7,364.50 crore, 6.5%, 3 days, 2026')]).toEqual(['7364.5', '6.5', '2026']);
    expect(wordCount('  a b  c ')).toBe(3);
  });
});

describe('image topic', () => {
  it('keeps a valid topic and drops an unknown one', () => {
    const ok = validateEnrichment(story, { ...base, summary: words(35), image_topic: 'gold' });
    const bad = validateEnrichment(story, { ...base, summary: words(35), image_topic: 'unicorns' });
    expect(ok.imageTopic).toBe('gold');
    expect(bad.imageTopic).toBeNull();
  });
});
