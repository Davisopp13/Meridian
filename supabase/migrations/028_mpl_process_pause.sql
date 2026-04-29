-- Wave 1C: process-pause support for mpl_active_timers
-- paused_at: timestamp when pause began (cleared on resume)
-- pause_seconds_v2: total accumulated pause seconds across all pause/resume cycles

ALTER TABLE mpl_active_timers
  ADD COLUMN IF NOT EXISTS paused_at timestamptz NULL;

ALTER TABLE mpl_active_timers
  ADD COLUMN IF NOT EXISTS pause_seconds_v2 integer NOT NULL DEFAULT 0;
