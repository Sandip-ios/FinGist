# FinGist website

Static pages for the store listings and the app's More screen:

| File | URL used by the app (`app/app.json` → `extra`) |
|---|---|
| `index.html` | `websiteUrl` (Share FinGist link) |
| `privacy.html` | `privacyUrl` (also required in App Store Connect and Play Console) |
| `terms.html` | `termsUrl` |

Before uploading, replace every `SUPPORT_EMAIL` with your support email address (all three pages), and the two `#` store links in `index.html` once the app is live.

Upload all files (including `style.css` and `icon-256.png`) to the document root of the site in Plesk → File Manager.

These pages describe how the app actually handles data today (no accounts, push token only when alerts are on, no analytics/ads). If you add features that collect more data, update `privacy.html`. Have them reviewed by a lawyer if possible.
