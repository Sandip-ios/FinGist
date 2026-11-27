/** Server-rendered page for a shared story (/s/<id>), with link-preview tags for WhatsApp, X, etc. */

export interface SharedStory {
  id: string;
  title: string;
  summary: string | null;
  source: string;
  url: string;
  category: string | null;
  publishedAt: number;
  image: { url: string; photographer: string; providerName: string } | null;
}

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Only http(s) links may be used in href/src (no javascript: etc.). */
export const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : '#');

export function storyPage(s: SharedStory, pageUrl: string, origin: string): string {
  const desc = s.summary ?? s.title;
  const date = new Date(s.publishedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const img = s.image ? safeUrl(s.image.url) : `${origin}/icon-256.png`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.title)} · FinGist</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="FinGist">
<meta property="og:title" content="${esc(s.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(s.title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<link rel="icon" href="/icon-256.png"><link rel="stylesheet" href="/style.css">
<style>
.story{background:var(--card);border:1px solid var(--border);border-radius:22px;overflow:hidden}
.photo{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#1e3a8a}
.inner{padding:18px 20px 22px}
.meta{color:var(--muted);font-size:14px;margin-bottom:8px}
.story h1{font-size:24px;line-height:1.25;margin:0 0 10px}
.story p{font-size:17px;line-height:1.6;margin:0 0 16px}
.btn{display:block;text-align:center;background:var(--navy);color:#fff!important;text-decoration:none;font-weight:700;padding:14px;border-radius:26px;margin-top:8px}
.btn2{background:transparent;color:var(--navy)!important;border:2px solid var(--navy)}
@media (prefers-color-scheme: dark){.btn2{color:var(--lime)!important;border-color:var(--lime)}}
.small{color:var(--muted);font-size:12.5px;text-align:center;margin-top:14px}
</style>
</head><body>
<header><div class="wrap"><img src="/icon-256.png" alt=""><a href="/">Fin<span>Gist</span></a></div></header>
<main class="wrap"><article class="story">
${s.image ? `<img class="photo" src="${esc(img)}" alt="">` : ''}
<div class="inner">
<div class="meta">${esc(s.source)} · ${esc(date)} IST</div>
<h1>${esc(s.title)}</h1>
${s.summary ? `<p>${esc(s.summary)}</p>` : ''}
<a class="btn" href="${esc(safeUrl(s.url))}" rel="noopener">Read full story at ${esc(s.source)} →</a>
<a class="btn btn2" href="/">Get the FinGist app</a>
<div class="small">Summary by FinGist · Source: ${esc(s.source)} · Not investment advice${s.image ? ` · Representative image: ${esc(s.image.photographer)} / ${esc(s.image.providerName)}` : ''}</div>
</div></article></main>
<footer><a href="/privacy">Privacy Policy</a><a href="/terms">Terms</a></footer>
</body></html>`;
}
