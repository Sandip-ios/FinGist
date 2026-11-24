# FinGist

Indian (NSE/BSE) and global market news as short swipeable cards: the original headline first,
then a 30–50 word AI summary in simple English, with category, companies/tickers, source, time,
sentiment and relevance. "Read more" opens the original article.

| Folder | What | Status |
|---|---|---|
| `backend/` | News pipeline + API (Cloudflare Workers + D1, Gemini) | Phase 1 |
| `app/` | React Native (Expo) app for iOS and Android | Phase 2 |
| `website/` | Landing page, privacy policy, terms, support (BigRock hosting) | Phase 4 |

## Roadmap
1. **Pipeline**: sources, dedupe, AI summaries, quality report on real stories ← *current*
2. API + app core: card feed, filters, Read More, labels, disclaimer
3. Watchlist, bookmarks, push notifications, report button
4. Store readiness: website, privacy, store declarations, icons, screenshots
5. Release: Play closed test + TestFlight, then store submission

## Content and compliance rules (apply everywhere)
- Show only the headline, our own short summary, the source name and a link. Never copy full articles.
- Summaries use only facts from the source; numbers are checked automatically. Doubtful summaries are dropped (headline only).
- No investment advice: no buy/sell/hold, no target prices. Sentiment and relevance labels only, plus a "Not investment advice" disclaimer.
- Every summary is labelled as AI-generated, and users can report a card.
