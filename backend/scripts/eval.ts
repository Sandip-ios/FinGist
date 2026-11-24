/**
 * Phase 1 quality check: runs the real pipeline on live feeds and writes a report.
 *
 *   GEMINI_API_KEY=... npm run eval            # 100 stories with AI summaries
 *   npm run eval -- --no-ai                    # feeds only (which sources work, dedupe, freshness)
 *   npm run eval -- --limit 40 --model gemini-flash-latest
 *   npm run eval -- --api openai              # send the key as a Bearer token instead
 *
 * Output: eval-output/report.html and eval-output/report.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SOURCES } from '../src/config/sources';
import { enrichBatch, type EnrichOutcome } from '../src/enrich/enrich';
import { RateLimitError, TransientError } from '../src/enrich/gemini';
import { dedupeList } from '../src/ingest/dedupe';
import { collectSource } from '../src/pipeline';
import type { Story } from '../src/types';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d: string) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1]! : d; };

const LIMIT = Number(opt('limit', '100'));
const MODEL = opt('model', process.env.GEMINI_MODEL ?? 'gemini-flash-lite-latest');
const FALLBACK = opt('fallback', 'gemini-flash-latest');
const BATCH = Number(opt('batch', '8'));
const GAP_MS = Number(opt('gap-ms', '4500')); // stay under free-tier requests/minute
const NO_AI = flag('no-ai');
const API = (opt('api', process.env.GEMINI_API_MODE ?? 'native') === 'openai' ? 'openai' : 'native') as 'native' | 'openai';
const MAX_AGE_H = Number(opt('max-age', '48'));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const now = Date.now();
  console.log(`Fetching ${SOURCES.filter((s) => s.enabled).length} sources...`);
  const sourceRows: Record<string, unknown>[] = [];
  const all: Story[] = [];
  const enabled = SOURCES.filter((s) => s.enabled);
  const results = await Promise.all(enabled.map(async (s) => ({ s, r: await collectSource(s, now, MAX_AGE_H) })));
  for (const { s, r } of results) {
    sourceRows.push({ id: s.id, name: s.name, status: r.fetch.status, http: r.fetch.httpStatus, error: r.fetch.error, parsed: r.parsed, kept: r.stories.length, stale: r.stale, routine: r.routine });
    console.log(`  ${r.fetch.status === 'ok' ? '✓' : '✗'} ${s.id.padEnd(20)} parsed=${r.parsed} kept=${r.stories.length} stale=${r.stale} routine=${r.routine} ${r.fetch.error ?? ''}`);
    all.push(...r.stories);
  }

  // Prefer official/fast sources first when deciding which duplicate survives, then newest.
  const rank = { filing: 0, regulator: 1, news: 2 } as const;
  all.sort((a, b) => b.publishedAt - a.publishedAt || rank[a.kind] - rank[b.kind]);
  const unique = new Map<string, Story>();
  for (const s of all) if (!unique.has(s.id)) unique.set(s.id, s);
  const { kept, dropped } = dedupeList([...unique.values()], (s) => s.title);
  console.log(`\nStories: ${all.length} fresh, ${unique.size} unique URLs, ${kept.length} after near-duplicate removal (${dropped.length} dropped)`);

  // Balanced sample: mix India/global and sources rather than only the newest.
  const sample = balancedSample(kept, LIMIT);
  let outcomes: EnrichOutcome[] = sample.map((story) => ({ story }));

  if (!NO_AI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Set GEMINI_API_KEY (or use --no-ai).');
    outcomes = [];
    for (let i = 0; i < sample.length; i += BATCH) {
      const batch = sample.slice(i, i + BATCH);
      for (let attempt = 0; ; attempt++) {
        // After two overloaded/timeout errors, try the fallback model.
        const model = attempt >= 2 && attempt % 2 === 0 ? FALLBACK : MODEL;
        try {
          const t0 = Date.now();
          const res = await enrichBatch({ apiKey, model, api: API }, batch);
          outcomes.push(...res);
          console.log(`  AI batch ${i / BATCH + 1}/${Math.ceil(sample.length / BATCH)} ok in ${Date.now() - t0} ms (${model})`);
          break;
        } catch (e) {
          const retryable = e instanceof RateLimitError || e instanceof TransientError;
          if (retryable && attempt < 5) {
            const wait = Math.min(60_000, 10_000 * 2 ** attempt);
            console.log(`  ${e instanceof RateLimitError ? 'rate limited' : 'Gemini busy'} (${model}), retrying in ${wait / 1000}s`);
            await sleep(wait);
            continue;
          }
          console.log(`  AI batch failed: ${(e as Error).message.slice(0, 160)}`);
          outcomes.push(...batch.map((story) => ({ story, error: (e as Error).message.slice(0, 200) })));
          break;
        }
      }
      await sleep(GAP_MS);
    }
  }

  const stats = summarize(outcomes, now);
  mkdirSync('eval-output', { recursive: true });
  writeFileSync('eval-output/report.json', JSON.stringify({ generatedAt: new Date(now).toISOString(), model: NO_AI ? null : MODEL, stats, sources: sourceRows, dropped: dropped.map((d) => d.title), outcomes }, null, 2));
  writeFileSync('eval-output/report.html', renderHtml(outcomes, sourceRows, stats, now));
  console.log('\n', stats, '\n\nWrote eval-output/report.html and report.json');
}

function balancedSample(stories: Story[], n: number): Story[] {
  const bySource = new Map<string, Story[]>();
  for (const s of stories) bySource.set(s.sourceId, [...(bySource.get(s.sourceId) ?? []), s]);
  const out: Story[] = [];
  while (out.length < n && [...bySource.values()].some((l) => l.length)) {
    for (const list of bySource.values()) { const s = list.shift(); if (s && out.length < n) out.push(s); }
  }
  return out.sort((a, b) => b.publishedAt - a.publishedAt);
}

function summarize(outcomes: EnrichOutcome[], now: number) {
  const e = outcomes.filter((o) => o.enrichment).map((o) => o.enrichment!);
  const count = (f: (x: (typeof e)[number]) => string) => e.reduce<Record<string, number>>((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
  const words = e.filter((x) => x.summary).map((x) => x.summary!.split(/\s+/).length);
  const ages = outcomes.map((o) => (now - o.story.publishedAt) / 60_000).sort((a, b) => a - b);
  return {
    stories: outcomes.length,
    aiErrors: outcomes.filter((o) => o.error).length,
    summariesAccepted: words.length,
    headlineOnly: e.filter((x) => !x.summary).length,
    notMarketRelevant: e.filter((x) => !x.marketRelevant).length,
    avgWords: words.length ? +(words.reduce((a, b) => a + b, 0) / words.length).toFixed(1) : 0,
    flags: e.flatMap((x) => x.flags.map((f) => f.split(':')[0]!)).reduce<Record<string, number>>((m, f) => ((m[f] = (m[f] ?? 0) + 1), m), {}),
    categories: count((x) => x.category),
    sentiment: count((x) => x.sentiment),
    relevance: count((x) => x.relevance),
    medianAgeMinutes: ages.length ? Math.round(ages[Math.floor(ages.length / 2)]!) : null,
  };
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function renderHtml(outcomes: EnrichOutcome[], sources: Record<string, unknown>[], stats: ReturnType<typeof summarize>, now: number) {
  const ago = (t: number) => { const m = Math.round((now - t) / 60_000); return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`; };
  const cards = outcomes.map((o) => {
    const e = o.enrichment;
    const tickers = (e?.companies ?? []).map((c) => `<span class="tk">${esc(c.symbol ?? c.name)}</span>`).join('');
    return `<article class="${e && !e.marketRelevant ? 'dim' : ''}">
      <div class="meta"><b>${esc(e?.category ?? '—')}</b> · ${esc(o.story.sourceName)} · ${ago(o.story.publishedAt)} · ${esc(o.story.region)}
        ${e ? `<span class="s ${e.sentiment}">${esc(e.sentiment)}</span><span class="r">${esc(e.relevance)}</span>` : ''}</div>
      <h3>${esc(o.story.title)}</h3>
      ${e?.summary ? `<p>${esc(e.summary)}</p>` : `<p class="none">${o.error ? 'AI error: ' + esc(o.error) : e ? 'Headline only (summary rejected)' : 'No AI (--no-ai)'}</p>`}
      <div>${tickers}</div>
      ${e?.flags.length ? `<div class="flags">${e.flags.map(esc).join(' · ')}</div>` : ''}
      <details><summary>Source input</summary><p class="src">${esc(o.story.snippet || '(no description)')}</p></details>
      <a href="${esc(o.story.url)}" target="_blank" rel="noopener">Read more →</a>
    </article>`;
  }).join('\n');
  const srcRows = sources.map((s) => `<tr class="${s.status === 'ok' ? '' : 'bad'}"><td>${esc(s.id)}</td><td>${esc(s.status)}</td><td>${esc(s.parsed)}</td><td>${esc(s.kept)}</td><td>${esc(s.stale)}</td><td>${esc(s.routine)}</td><td>${esc(s.error ?? '')}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FinGist Phase 1 report</title>
<style>body{font:15px/1.5 system-ui;margin:0;background:#f3f5f9;color:#111}main{max-width:760px;margin:auto;padding:16px}
article{background:#fff;border-radius:14px;padding:16px;margin:12px 0;box-shadow:0 1px 4px #0001}article.dim{opacity:.5}
h3{margin:6px 0;font-size:17px}.meta{font-size:12px;color:#555}.s,.r{margin-left:6px;padding:1px 7px;border-radius:9px;background:#eee}
.positive{background:#dcfce7}.negative{background:#fee2e2}.mixed{background:#fef9c3}.tk{display:inline-block;font-size:12px;background:#e0e7ff;border-radius:6px;padding:1px 6px;margin:2px 4px 2px 0}
.none{color:#a00}.flags{font-size:12px;color:#b45309}.src{font-size:13px;color:#555}table{border-collapse:collapse;font-size:12px;background:#fff;width:100%}td{border:1px solid #ddd;padding:3px 6px}.bad{background:#fee2e2}
pre{background:#fff;padding:12px;border-radius:10px;overflow:auto;font-size:12px}a{color:#1d4ed8}</style></head>
<body><main><h1>FinGist · Phase 1 report</h1><p>${new Date(now).toLocaleString()} · ${outcomes.length} stories</p>
<pre>${esc(JSON.stringify(stats, null, 2))}</pre><h2>Sources</h2><table><tr><td>source</td><td>status</td><td>parsed</td><td>kept</td><td>stale</td><td>routine</td><td>error</td></tr>${srcRows}</table>
<h2>Cards</h2>${cards}</main></body></html>`;
}

main().catch((e) => { console.error(e); process.exit(1); });
