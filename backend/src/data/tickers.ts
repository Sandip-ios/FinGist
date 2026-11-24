/**
 * Ticker master list used to validate symbols suggested by the AI.
 *
 * THIS IS A SMALL SEED (large caps only). Run `npm run update-tickers` to
 * replace the NSE part with the full official equity list from NSE.
 * A symbol not in this list is dropped (the company name is still shown).
 */
export const NSE_SYMBOLS: Record<string, string> = {
  RELIANCE: 'Reliance Industries', TCS: 'Tata Consultancy Services', HDFCBANK: 'HDFC Bank', ICICIBANK: 'ICICI Bank',
  INFY: 'Infosys', SBIN: 'State Bank of India', BHARTIARTL: 'Bharti Airtel', ITC: 'ITC', HINDUNILVR: 'Hindustan Unilever',
  LT: 'Larsen & Toubro', KOTAKBANK: 'Kotak Mahindra Bank', AXISBANK: 'Axis Bank', BAJFINANCE: 'Bajaj Finance',
  BAJAJFINSV: 'Bajaj Finserv', 'BAJAJ-AUTO': 'Bajaj Auto', MARUTI: 'Maruti Suzuki', 'M&M': 'Mahindra & Mahindra',
  SUNPHARMA: 'Sun Pharmaceutical', HCLTECH: 'HCL Technologies', WIPRO: 'Wipro', TECHM: 'Tech Mahindra',
  TITAN: 'Titan Company', ASIANPAINT: 'Asian Paints', ULTRACEMCO: 'UltraTech Cement', NESTLEIND: 'Nestle India',
  NTPC: 'NTPC', POWERGRID: 'Power Grid Corporation', ONGC: 'Oil & Natural Gas Corporation', COALINDIA: 'Coal India',
  TATASTEEL: 'Tata Steel', JSWSTEEL: 'JSW Steel', HINDALCO: 'Hindalco Industries', ADANIENT: 'Adani Enterprises',
  ADANIPORTS: 'Adani Ports and SEZ', GRASIM: 'Grasim Industries', CIPLA: 'Cipla', DRREDDY: "Dr. Reddy's Laboratories",
  APOLLOHOSP: 'Apollo Hospitals', EICHERMOT: 'Eicher Motors', HEROMOTOCO: 'Hero MotoCorp', BEL: 'Bharat Electronics',
  TRENT: 'Trent', SHRIRAMFIN: 'Shriram Finance', SBILIFE: 'SBI Life Insurance', HDFCLIFE: 'HDFC Life Insurance',
  TATACONSUM: 'Tata Consumer Products', JIOFIN: 'Jio Financial Services', ETERNAL: 'Eternal (Zomato)', INDUSINDBK: 'IndusInd Bank',
  INDIGO: 'InterGlobe Aviation', HAL: 'Hindustan Aeronautics', DMART: 'Avenue Supermarts', VEDL: 'Vedanta', IOC: 'Indian Oil Corporation',
  BPCL: 'Bharat Petroleum', GAIL: 'GAIL (India)', BANKBARODA: 'Bank of Baroda', PNB: 'Punjab National Bank', CANBK: 'Canara Bank',
  IRCTC: 'IRCTC', IRFC: 'Indian Railway Finance Corporation', LICI: 'Life Insurance Corporation of India', DLF: 'DLF',
  PIDILITIND: 'Pidilite Industries', DABUR: 'Dabur India', BRITANNIA: 'Britannia Industries', SIEMENS: 'Siemens',
  ABB: 'ABB India', TATAPOWER: 'Tata Power', ADANIGREEN: 'Adani Green Energy', ADANIPOWER: 'Adani Power', PAYTM: 'One 97 Communications (Paytm)',
  NYKAA: 'FSN E-Commerce (Nykaa)', POLICYBZR: 'PB Fintech (Policybazaar)', YESBANK: 'Yes Bank', IDEA: 'Vodafone Idea',
  ZYDUSLIFE: 'Zydus Lifesciences', LUPIN: 'Lupin', DIVISLAB: "Divi's Laboratories", MUTHOOTFIN: 'Muthoot Finance',
  CHOLAFIN: 'Cholamandalam Investment', HAVELLS: 'Havells India', GODREJCP: 'Godrej Consumer Products', BHEL: 'Bharat Heavy Electricals',
  SAIL: 'Steel Authority of India', NMDC: 'NMDC', RECLTD: 'REC', PFC: 'Power Finance Corporation', MAZDOCK: 'Mazagon Dock Shipbuilders',
};

export const GLOBAL_SYMBOLS: Record<string, string> = {
  AAPL: 'Apple', MSFT: 'Microsoft', NVDA: 'Nvidia', GOOGL: 'Alphabet', GOOG: 'Alphabet', AMZN: 'Amazon', META: 'Meta Platforms',
  TSLA: 'Tesla', 'BRK.B': 'Berkshire Hathaway', AVGO: 'Broadcom', JPM: 'JPMorgan Chase', V: 'Visa', MA: 'Mastercard',
  WMT: 'Walmart', XOM: 'Exxon Mobil', UNH: 'UnitedHealth', JNJ: 'Johnson & Johnson', ORCL: 'Oracle', NFLX: 'Netflix',
  AMD: 'Advanced Micro Devices', INTC: 'Intel', COST: 'Costco', BAC: 'Bank of America', GS: 'Goldman Sachs', MS: 'Morgan Stanley',
  WFC: 'Wells Fargo', C: 'Citigroup', DIS: 'Walt Disney', BA: 'Boeing', CVX: 'Chevron', KO: 'Coca-Cola', PEP: 'PepsiCo',
  PFE: 'Pfizer', LLY: 'Eli Lilly', NKE: 'Nike', CRM: 'Salesforce', ADBE: 'Adobe', QCOM: 'Qualcomm', IBM: 'IBM', UBER: 'Uber',
  PLTR: 'Palantir', TSM: 'Taiwan Semiconductor', ASML: 'ASML', BABA: 'Alibaba', SHEL: 'Shell', TM: 'Toyota', SONY: 'Sony',
  INFY: 'Infosys (ADR)', WIT: 'Wipro (ADR)', HDB: 'HDFC Bank (ADR)', IBN: 'ICICI Bank (ADR)', MU: 'Micron', COIN: 'Coinbase',
};

export function isKnownSymbol(symbol: string, exchange: string | null): boolean {
  const s = symbol.toUpperCase();
  const ex = (exchange ?? '').toUpperCase();
  if (ex === 'NSE' || ex === 'BSE') return s in NSE_SYMBOLS;
  if (ex) return s in GLOBAL_SYMBOLS;
  return s in NSE_SYMBOLS || s in GLOBAL_SYMBOLS;
}
