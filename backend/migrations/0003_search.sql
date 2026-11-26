-- Full-text search over published cards (headline, summary, companies)
CREATE VIRTUAL TABLE IF NOT EXISTS stories_fts USING fts5(
  title, summary, companies,
  content='stories', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- Keep the index in sync with the stories table
CREATE TRIGGER IF NOT EXISTS stories_fts_ai AFTER INSERT ON stories BEGIN
  INSERT INTO stories_fts(rowid, title, summary, companies) VALUES (new.rowid, new.title, new.summary, new.companies);
END;
CREATE TRIGGER IF NOT EXISTS stories_fts_ad AFTER DELETE ON stories BEGIN
  INSERT INTO stories_fts(stories_fts, rowid, title, summary, companies) VALUES ('delete', old.rowid, old.title, old.summary, old.companies);
END;
CREATE TRIGGER IF NOT EXISTS stories_fts_au AFTER UPDATE OF title, summary, companies ON stories BEGIN
  INSERT INTO stories_fts(stories_fts, rowid, title, summary, companies) VALUES ('delete', old.rowid, old.title, old.summary, old.companies);
  INSERT INTO stories_fts(rowid, title, summary, companies) VALUES (new.rowid, new.title, new.summary, new.companies);
END;

-- Index the stories that already exist
INSERT INTO stories_fts(stories_fts) VALUES ('rebuild');
