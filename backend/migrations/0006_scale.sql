-- Daily alert counts per audience (india / global / all) instead of one write per phone per alert.
CREATE TABLE IF NOT EXISTS alert_counts (
  day      TEXT NOT NULL,              -- IST date (YYYY-MM-DD)
  audience TEXT NOT NULL,              -- all | india | global
  count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, audience)
);
-- Category tabs read only their own stories instead of scanning the whole feed.
CREATE INDEX IF NOT EXISTS idx_stories_category_published ON stories (category, published_at DESC);
