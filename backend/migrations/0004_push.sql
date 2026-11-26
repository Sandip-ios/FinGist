-- Phones that opted in to news alerts (Expo push tokens; no personal data)
CREATE TABLE IF NOT EXISTS devices (
  token        TEXT PRIMARY KEY,          -- ExponentPushToken[...]
  platform     TEXT NOT NULL,             -- ios | android
  region       TEXT NOT NULL DEFAULT 'all', -- all | india | global
  quiet_hours  INTEGER NOT NULL DEFAULT 1,  -- 1 = no alerts 22:00-07:00 IST
  sent_day     TEXT,                      -- IST date of sent_count (YYYY-MM-DD)
  sent_count   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
