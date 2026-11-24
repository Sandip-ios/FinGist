import type { Source } from '../types';

/**
 * News sources. Only headline, link and the feed's own short description are used.
 * Full articles are never copied; readers open the original via "Read More".
 *
 * Feed URLs change from time to time: run `npm run eval -- --no-ai` to see which
 * ones respond, and disable or fix any that fail.
 */
export const SOURCES: Source[] = [
  // ---- India: market news ----
  { id: 'et-markets', name: 'Economic Times', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', region: 'india', kind: 'news', pollMinutes: 2, enabled: true },
  { id: 'et-stocks', name: 'Economic Times', url: 'https://economictimes.indiatimes.com/markets/stocks/news/rssfeeds/2146842.cms', region: 'india', kind: 'news', pollMinutes: 2, enabled: true },
  { id: 'mc-markets', name: 'Moneycontrol', url: 'https://www.moneycontrol.com/rss/marketreports.xml', region: 'india', kind: 'news', pollMinutes: 3, enabled: true },
  { id: 'mc-business', name: 'Moneycontrol', url: 'https://www.moneycontrol.com/rss/business.xml', region: 'india', kind: 'news', pollMinutes: 3, enabled: true },
  { id: 'mint-markets', name: 'Mint', url: 'https://www.livemint.com/rss/markets', region: 'india', kind: 'news', pollMinutes: 3, enabled: true },
  { id: 'bs-markets', name: 'Business Standard', url: 'https://www.business-standard.com/rss/markets-106.rss', region: 'india', kind: 'news', pollMinutes: 3, enabled: true },
  { id: 'hbl-markets', name: 'BusinessLine', url: 'https://www.thehindubusinessline.com/markets/feeder/default.rss', region: 'india', kind: 'news', pollMinutes: 5, enabled: true },
  { id: 'fe-market', name: 'Financial Express', url: 'https://www.financialexpress.com/market/feed/', region: 'india', kind: 'news', pollMinutes: 5, enabled: true },
  { id: 'cnbctv18-market', name: 'CNBC-TV18', url: 'https://www.cnbctv18.com/commonfeeds/v1/cne/rss/market.xml', region: 'india', kind: 'news', pollMinutes: 3, enabled: true },

  // ---- India: official exchange filings & regulators ----
  { id: 'nse-announcements', name: 'NSE Announcements', url: 'https://nsearchives.nseindia.com/content/RSS/Online_announcements.xml', region: 'india', kind: 'filing', pollMinutes: 3, enabled: true },
  { id: 'nse-results', name: 'NSE Financial Results', url: 'https://nsearchives.nseindia.com/content/RSS/Financial_Results.xml', region: 'india', kind: 'filing', pollMinutes: 5, enabled: true },
  { id: 'rbi-press', name: 'RBI', url: 'https://www.rbi.org.in/pressreleases_rss.xml', region: 'india', kind: 'regulator', pollMinutes: 10, enabled: true },
  { id: 'sebi', name: 'SEBI', url: 'https://www.sebi.gov.in/sebirss.xml', region: 'india', kind: 'regulator', pollMinutes: 15, enabled: true },

  // ---- Global ----
  { id: 'cnbc-investing', name: 'CNBC', url: 'https://www.cnbc.com/id/15839069/device/rss/rss.html', region: 'global', kind: 'news', pollMinutes: 3, enabled: true },
  { id: 'cnbc-top', name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', region: 'global', kind: 'news', pollMinutes: 3, enabled: true },
  { id: 'mw-top', name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', region: 'global', kind: 'news', pollMinutes: 3, enabled: true },
  { id: 'mw-pulse', name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse', region: 'global', kind: 'news', pollMinutes: 3, enabled: true },
  { id: 'yahoo-finance', name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', region: 'global', kind: 'news', pollMinutes: 3, enabled: true },
  { id: 'fed-press', name: 'US Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml', region: 'global', kind: 'regulator', pollMinutes: 10, enabled: true },

  // BSE has no stable public RSS for corporate announcements; its JSON endpoint
  // needs special headers and parsing. Planned for a later phase.
  { id: 'bse-announcements', name: 'BSE Announcements', url: 'https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w', region: 'india', kind: 'filing', pollMinutes: 3, enabled: false, note: 'JSON API, adapter not built yet' },
];

export const USER_AGENT = 'Mozilla/5.0 (compatible; FinGistBot/0.1; news aggregator that links to the original source)';
