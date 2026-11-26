-- Representative photos (Pexels) per illustration topic
ALTER TABLE stories ADD COLUMN image_topic TEXT;

CREATE TABLE IF NOT EXISTS image_cache (
  topic       TEXT PRIMARY KEY,
  photos      TEXT NOT NULL,          -- JSON [Photo]
  fetched_at  INTEGER NOT NULL,
  last_error  TEXT
);
