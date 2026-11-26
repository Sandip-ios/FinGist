# FinGist backend

Fetches market news feeds every 2 minutes, removes duplicates and routine filings, writes AI
summaries with Gemini, and serves the news feed to the app.

```
Cron (every 2 min) ──► /internal/ingest/<source>  (one invocation per due feed)
                         fetch (ETag/If-Modified-Since) → parse → clean → drop stale/routine
                         → skip known URLs → drop near-duplicate headlines → save as "pending"
                   └──► /internal/enrich  ×3   (one AI call per 8 stories)
                         Gemini JSON → validate (word count, numbers, advice words, tickers)
                         → "ready" (summary) | "ready" without summary (headline only) | "rejected" (not market news)
App ──► GET /v1/feed?region=india|global&category=…&before=<ms>&limit=30
        GET /v1/sources   (feed health)   GET /health
```

New stories appear in the feed with their headline straight away (`summaryStatus: "pending"`); the summary fills in usually within a few minutes.

## Code map
| Path | Purpose |
|---|---|
| `src/config/sources.ts` | Feed list (region, type, poll interval) |
| `src/ingest/` | Fetching, RSS/Atom parsing, cleaning, filters, duplicate detection |
| `src/enrich/` | Prompt, Gemini client, validation of AI output |
| `src/data/tickers.ts` | Ticker list for validating symbols (seed; refresh with `npm run update-tickers`) |
| `src/store/db.ts` | D1 queries |
| `src/worker.ts` | Cloudflare Worker: cron, internal jobs, public API |
| `migrations/` | Database schema |
| `scripts/eval.ts` | Quality report on live news |

## 1. Quality check on real news (run on your Mac)
Needs Node.js 20+ and a Gemini API key from https://aistudio.google.com/apikey.

```bash
cd backend
npm install
npm test
npm run eval -- --no-ai                 # which feeds work, how many fresh stories, duplicates removed
GEMINI_API_KEY=your_key npm run eval     # 100 stories with AI summaries
open eval-output/report.html
```
The report shows each card as it will look (headline, summary, category, sentiment, relevance, tickers),
the source text the AI saw, and any validation flags. Optional: `--limit 40`, `--model gemini-flash-latest`.

## 2. Deploy to Cloudflare (free plan)
```bash
npx wrangler login
npx wrangler d1 create fingist          # copy the database_id into wrangler.toml
npm run db:migrate:remote
npx wrangler secret put GEMINI_API_KEY
openssl rand -hex 32 | npx wrangler secret put INTERNAL_KEY
npx wrangler secret put PEXELS_API_KEY  # optional: free key from https://www.pexels.com/api/ (card photos)
npm run deploy
```
Then open `https://fingist-api.<your-subdomain>.workers.dev/v1/feed`.

## Card photos (Pexels)
The AI picks an illustration topic for each story (`src/data/imageTopics.ts`, e.g. gold, central_bank,
technology_it). With `PEXELS_API_KEY` set, the cron fetches up to 15 free-licence Pexels photos per topic
(3 topics per run, refreshed weekly) into the `image_cache` table, and `/v1/feed` returns one photo per story
with the photographer credit. Without the key, cards show the coloured category banner.

## Free-tier budget (approx.)
- Workers: ~720 cron runs/day, ~15–20k requests/day (limit 100k). Each feed/AI batch runs as its own invocation to stay within per-invocation CPU limits.
- D1: reads stay low because recent headlines are loaded only when a feed has new items; ~1–2k writes/day.
- Gemini: one call per 8 stories ≈ 100–150 calls/day.

## Local development
```bash
printf 'INTERNAL_KEY=devkey\nGEMINI_API_KEY=your_key\n' > .dev.vars
npm run db:migrate:local
npm run dev                                       # http://localhost:8787
curl "http://localhost:8787/__scheduled?cron=*/2+*+*+*+*"   # trigger one cron run
curl http://localhost:8787/v1/feed
```
