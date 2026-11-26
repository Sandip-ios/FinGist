-- Per-type alert choices (all on by default)
ALTER TABLE devices ADD COLUMN morning INTEGER NOT NULL DEFAULT 1;   -- ~8:45 am IST market mood
ALTER TABLE devices ADD COLUMN market_open INTEGER NOT NULL DEFAULT 1; -- ~9:30 am IST opening update
ALTER TABLE devices ADD COLUMN breaking INTEGER NOT NULL DEFAULT 1;  -- important stories during the day
