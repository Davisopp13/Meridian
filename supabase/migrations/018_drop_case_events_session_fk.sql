-- ============================================================
-- 018_drop_case_events_session_fk.sql
-- Drops the foreign-key constraint that ties
-- case_events.session_id → bar_sessions(id).
--
-- Why: migrations 016 and 017 established session_id as a loose
-- join key between two independent widget inserts (ct_cases +
-- case_events), generated client-side via crypto.randomUUID().
-- The widget does NOT create a matching bar_sessions row, so the
-- FK rejects every new insert with a foreign-key violation and
-- case_events writes silently fail (the widget catches them as
-- "non-blocking" and shows a success toast to the agent regardless).
--
-- Dropping the FK aligns case_events.session_id with
-- ct_cases.session_id — both are now bare UUID join keys, not
-- referential constraints. This matches the architecture we
-- designed for this feature.
--
-- Note: bar_sessions itself is untouched. Its other uses (widget
-- heartbeat upsert via migration 009) continue to work.
-- ============================================================

-- Defensively drop by name first. If Supabase/Postgres auto-generated
-- a different name, fall through to the dynamic drop below.
ALTER TABLE public.case_events
  DROP CONSTRAINT IF EXISTS case_events_session_id_fkey;

-- Belt-and-suspenders: find any remaining FK on case_events.session_id
-- and drop it. This survives whatever the original constraint was named.
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  FOR fk_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.case_events'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.case_events'::regclass
           AND attname = 'session_id')
      ]
  LOOP
    EXECUTE format('ALTER TABLE public.case_events DROP CONSTRAINT %I', fk_name);
    RAISE NOTICE 'Dropped FK: %', fk_name;
  END LOOP;
END $$;

-- Verify — should return zero rows (no FK remains on session_id)
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.case_events'::regclass
  AND contype = 'f'
  AND conkey = ARRAY[
    (SELECT attnum FROM pg_attribute
     WHERE attrelid = 'public.case_events'::regclass
       AND attname = 'session_id')
  ];

-- Second verification: column is still UUID, still present, just no FK now
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'case_events'
  AND column_name = 'session_id';
