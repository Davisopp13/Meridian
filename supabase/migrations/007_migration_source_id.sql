-- ============================================================
-- 007_migration_source_id.sql
-- Adds source + source_event_id to case_events for CT 1.0 backfill.
-- Idempotent — safe to run multiple times.
-- ============================================================

-- 1. Add source column (tracks which system produced the event).
ALTER TABLE case_events
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN case_events.source IS
  'Origin of the event: NULL for live Meridian events, ''ct_1_migration'' for CT 1.0 backfill rows.';

-- 2. Add source_event_id column (the CT 1.0 activity_log.id, stored for dedup).
ALTER TABLE case_events
  ADD COLUMN IF NOT EXISTS source_event_id uuid;

COMMENT ON COLUMN case_events.source_event_id IS
  'ID of the originating row in the source system (e.g. CT 1.0 activity_log.id). NULL for live events.';

-- 3. Unique index — prevents duplicate backfill inserts across re-runs.
--    Partial index: only applies where both columns are non-null, so normal
--    live events (source IS NULL) are never affected.
CREATE UNIQUE INDEX IF NOT EXISTS case_events_source_event_uq
  ON case_events (source, source_event_id)
  WHERE source IS NOT NULL AND source_event_id IS NOT NULL;
