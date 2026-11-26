import type { Category } from '../types';

/**
 * Illustration topics. The AI picks one per story; the server keeps a small set of
 * free-licence Pexels photos per topic (refreshed weekly) and shows one of them.
 * Photos are representative, not photos of the actual event.
 */
export const IMAGE_TOPICS = {
  stock_market: 'stock market chart screen',
  stock_exchange_india: 'mumbai stock exchange',
  trading_screen: 'stock trading monitor',
  wall_street: 'wall street new york',
  central_bank: 'bank building columns',
  indian_rupee: 'indian rupee currency notes',
  us_dollar: 'us dollar bills',
  currency_exchange: 'foreign currency exchange',
  gold: 'gold bars',
  silver: 'silver bullion',
  crude_oil: 'oil refinery',
  natural_gas: 'gas pipeline industry',
  banking: 'bank interior',
  credit_cards: 'credit card payment',
  digital_payments: 'mobile payment phone',
  insurance: 'insurance family protection',
  mutual_funds: 'investment savings coins growth',
  personal_finance: 'personal finance budget calculator',
  ipo: 'business celebration launch',
  earnings: 'financial report documents',
  merger_deal: 'business handshake deal',
  startup: 'startup office team',
  technology_it: 'software developers office',
  semiconductors: 'computer chip semiconductor',
  artificial_intelligence: 'artificial intelligence technology',
  telecom: 'telecom tower',
  pharma: 'pharmaceutical laboratory',
  healthcare: 'hospital healthcare',
  automobile: 'car factory assembly line',
  electric_vehicles: 'electric car charging',
  aviation: 'airplane airport',
  railways: 'train railway india',
  shipping_ports: 'container port ship',
  real_estate: 'apartment buildings construction',
  infrastructure: 'highway bridge construction',
  cement_steel: 'steel factory',
  metals_mining: 'mining excavator',
  power_energy: 'power plant electricity',
  renewable_energy: 'solar panels wind',
  fmcg_retail: 'supermarket shopping',
  ecommerce: 'online shopping delivery boxes',
  agriculture: 'farm field india',
  food_prices: 'vegetable market',
  inflation: 'grocery prices shopping cart',
  jobs_employment: 'office workers',
  government_policy: 'government building',
  parliament_india: 'india parliament',
  budget_tax: 'tax forms calculator',
  courts_legal: 'court gavel law',
  global_trade: 'cargo containers trade',
  china_economy: 'shanghai skyline',
  us_economy: 'us capitol washington',
  europe_economy: 'european union flags',
  crypto: 'bitcoin cryptocurrency',
  defence: 'military defence',
  media_entertainment: 'cinema film production',
  hotels_tourism: 'hotel resort travel',
  economy_growth: 'city skyline business district',
  business_meeting: 'business meeting boardroom',
} as const;

export type ImageTopic = keyof typeof IMAGE_TOPICS;
export const IMAGE_TOPIC_IDS = Object.keys(IMAGE_TOPICS) as ImageTopic[];

/** Used when the AI did not choose a topic (older stories, headline-only cards). */
export const CATEGORY_DEFAULT_TOPIC: Record<Category, ImageTopic> = {
  markets: 'stock_market',
  stocks: 'trading_screen',
  earnings: 'earnings',
  ipo: 'ipo',
  economy: 'economy_growth',
  policy: 'government_policy',
  banking: 'banking',
  global: 'global_trade',
  commodities: 'gold',
  currency: 'currency_exchange',
  corporate_action: 'business_meeting',
  mutual_funds: 'mutual_funds',
  crypto: 'crypto',
  other: 'business_meeting',
};

export function isImageTopic(v: unknown): v is ImageTopic {
  return typeof v === 'string' && v in IMAGE_TOPICS;
}
