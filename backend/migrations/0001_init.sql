-- FinGist core schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS stories (
  id              TEXT PRIMARY KEY,          -- sha-256 of canonical URL (hex, 32 chars)
  source_id       TEXT NOT NULL,
  source_name     TEXT NOT NULL,
  url             TEXT NOT NULL,
  title           TEXT NOT NULL,
  snippet         TEXT NOT NULL DEFAULT '',  -- feed description, used only as AI input; never shown as article text
  region          TEXT NOT NULL,             -- india | global  (from source)
  kind            TEXT NOT NULL,             -- news | filing | regulator
  published_at    INTEGER NOT NULL,          -- unix ms
  fetched_at      INTEGER NOT NULL,          -- unix ms

  -- lifecycle: pending -> processing -> ready | failed | rejected (not market relevant)
  status          TEXT NOT NULL DEFAULT 'pending',
  attempts        INTEGER NOT NULL DEFAULT 0,
  lease_until     INTEGER NOT NULL DEFAULT 0,
  error           TEXT,

  -- AI enrichment (null until ready)
  summary         TEXT,                      -- 30-50 words; null => show headline only
  category        TEXT,
  sentiment       TEXT,                      -- positive | negative | neutral | mixed
  relevance       TEXT,                      -- high | medium | low
  region_impact   TEXT,                      -- india | global | both
  companies       TEXT,                      -- JSON [{name, symbol, exchange}]
  flags           TEXT,                      -- JSON [string] validation notes
  enriched_at     INTEGER,
  notified_at     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_stories_published ON stories (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_status_published ON stories (status, published_at DESC);

CREATE TABLE IF NOT EXISTS source_state (
  source_id            TEXT PRIMARY KEY,
  etag                 TEXT,
  last_modified        TEXT,
  last_fetch_at        INTEGER NOT NULL DEFAULT 0,
  last_ok_at           INTEGER NOT NULL DEFAULT 0,
  last_error           TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_new_items       INTEGER NOT NULL DEFAULT 0
);
