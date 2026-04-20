-- MPL Crash Recovery: add missing columns to mpl_active_timers and bar_sessions
-- Applied manually via Supabase SQL Editor by Davis

-- mpl_active_timers: process_id (text) for matching on restore
ALTER TABLE mpl_active_timers
  ADD COLUMN IF NOT EXISTS process_id text;

-- mpl_active_timers: unique constraint on process_id so upsert onConflict:'process_id' works
CREATE UNIQUE INDEX IF NOT EXISTS idx_mpl_active_timers_process_id
  ON mpl_active_timers(process_id);

-- mpl_active_timers: subcategory_id (nullable uuid)
ALTER TABLE mpl_active_timers
  ADD COLUMN IF NOT EXISTS subcategory_id uuid;

-- mpl_active_timers: accumulated_seconds (authoritative seconds count, written on every sync)
ALTER TABLE mpl_active_timers
  ADD COLUMN IF NOT EXISTS accumulated_seconds integer DEFAULT 0;

-- mpl_active_timers: updated_at for ordering and staleness detection
ALTER TABLE mpl_active_timers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- mpl_active_timers: index for efficient per-user lookups ordered by recency
CREATE INDEX IF NOT EXISTS idx_mpl_active_timers_user
  ON mpl_active_timers(user_id, updated_at DESC);

-- bar_sessions: last_seen_at for heartbeat / stale-session detection
ALTER TABLE bar_sessions
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

-- bar_sessions: widget_mode to distinguish mpl-widget from ct-widget sessions
ALTER TABLE bar_sessions
  ADD COLUMN IF NOT EXISTS widget_mode text;

-- bar_sessions: composite unique index so upsert onConflict:'user_id,widget_mode' works
CREATE UNIQUE INDEX IF NOT EXISTS idx_bar_sessions_user_mode
  ON bar_sessions(user_id, widget_mode);
