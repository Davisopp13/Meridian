-- ============================================================
-- 017_ct_cases_session_id_uuid.sql
-- Migration 016 created ct_cases.session_id as TEXT (via
-- ADD COLUMN IF NOT EXISTS, because the column didn't exist there).
-- However, case_events.session_id already existed as UUID from the
-- initial schema. That mismatch broke the join with:
--   ERROR: 42883: operator does not exist: text = uuid
--
-- This migration drops and re-adds ct_cases.session_id as UUID so
-- the two columns are the same type and the join works without
-- casting at query time.
--
-- Safe to run: no production rows in ct_cases.session_id are usable
-- yet — they only started being written after migration 016 ran
-- earlier this session, and the type mismatch prevented any of them
-- from joining correctly. Dropping loses nothing that works.
-- ============================================================

-- Drop the TEXT-typed column added by migration 016
ALTER TABLE public.ct_cases
  DROP COLUMN IF EXISTS session_id;

-- Re-add as UUID to match case_events.session_id
ALTER TABLE public.ct_cases
  ADD COLUMN session_id UUID;

-- Re-create the partial index dropped along with the column
CREATE INDEX IF NOT EXISTS idx_ct_cases_session_id
  ON public.ct_cases (session_id)
  WHERE session_id IS NOT NULL;

-- Grants preserved (dropping a column doesn't strip grants, but
-- defensive re-grant in case of earlier DROP SCHEMA CASCADE history)
GRANT SELECT, INSERT, UPDATE ON public.ct_cases TO anon, authenticated, service_role;

-- Verify — should return one row showing ct_cases.session_id as uuid
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'session_id'
  AND table_name IN ('ct_cases', 'case_events')
ORDER BY table_name;
