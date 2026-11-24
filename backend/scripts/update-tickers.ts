/**
 * Replaces the NSE seed in src/data/tickers.ts with the full official NSE equity list.
 * Run from a machine that can reach nsearchives.nseindia.com:  npm run update-tickers
 */
import { readFileSync, writeFileSync } from 'node:fs';

const URL_EQ = 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv';
const FILE = new URL('../src/data/tickers.ts', import.meta.url);

const res = await fetch(URL_EQ, { headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/csv,*/*' } });
if (!res.ok) throw new Error(`NSE list download failed: HTTP ${res.status}`);
const lines = (await res.text()).trim().split(/\r?\n/).slice(1);
const map: Record<string, string> = {};
for (const line of lines) {
  // SYMBOL,NAME OF COMPANY, SERIES, ...  (names may contain commas inside quotes)
  const cols = line.match(/("([^"]*)"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').trim()) ?? [];
  const [symbol, name] = cols;
  if (symbol && name) map[symbol] = name;
}
if (Object.keys(map).length < 1000) throw new Error(`Only ${Object.keys(map).length} symbols parsed; refusing to overwrite.`);
const src = readFileSync(FILE, 'utf8');
const start = src.indexOf('export const NSE_SYMBOLS');
const end = src.indexOf('};', start) + 2;
const body = `export const NSE_SYMBOLS: Record<string, string> = ${JSON.stringify(map, null, 0).replace(/","/g, '",\n  "')};`;
writeFileSync(FILE, src.slice(0, start) + body + src.slice(end));
console.log(`Updated NSE_SYMBOLS with ${Object.keys(map).length} symbols.`);
