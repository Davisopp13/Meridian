-- ============================================================
-- 008_expand_case_events_types.sql
-- Expand case_events.type CHECK constraint to include
-- 'awaiting_info' for future Awaiting Information feature and
-- for CT 1.0 historical data backfill.
-- Idempotent via DROP CONSTRAINT IF EXISTS.
-- ============================================================

ALTER TABLE case_events
  DROP CONSTRAINT IF EXISTS case_events_type_check;

ALTER TABLE case_events
  ADD CONSTRAINT case_events_type_check
  CHECK (type = ANY (ARRAY[
    'resolved'::text,
    'reclassified'::text,
    'call'::text,
    'rfc'::text,
    'not_a_case'::text,
    'awaiting_info'::text
  ]));

-- Verify: should return one row with the new constraint definition.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'case_events'::regclass
  AND conname = 'case_events_type_check';
