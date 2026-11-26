const LABELS: Record<string, string> = {
  markets: 'Markets', stocks: 'Stocks', earnings: 'Earnings', ipo: 'IPO', economy: 'Economy', policy: 'Policy & RBI',
  banking: 'Banking', global: 'Global', commodities: 'Commodities', currency: 'Currency', corporate_action: 'Corporate',
  mutual_funds: 'Mutual Funds', crypto: 'Crypto', other: 'Business',
};
export const categoryLabel = (c: string | null) => (c && LABELS[c]) || 'News';
