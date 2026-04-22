-- ============================================================
-- 019_drop_phantom_ct_cases_session_id.sql
-- Undoes migrations 016 + 017, which created ct_cases.session_id
-- as a bare UUID column. This column was redundant from day one:
-- the real parent-child link has always been
--   case_events.session_id (FK) → ct_cases.id
-- We just didn't realize that until diagnosing tonight.
--
-- Dropping ct_cases.session_id makes the schema honest: the only
-- "session_id" column anywhere is on case_events, and it's
-- semantically a case_id (misnamed, but structurally correct).
--
-- Safe to run: nothing downstream actually uses ct_cases.session_id.
-- The widget will soon stop writing to it (see CC prompt for widget
-- rework). No existing rows are referenced by any FK or join.
-- ============================================================

-- Drop the partial index first (index on a column that's about to go)
DROP INDEX IF EXISTS public.idx_ct_cases_session_id;

-- Drop the column
ALTER TABLE public.ct_cases
  DROP COLUMN IF EXISTS session_id;

-- Verify — should return zero rows if the column is gone
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ct_cases'
  AND column_name = 'session_id';

-- Confirm case_events.session_id is still intact (it's the real one)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'case_events'
  AND column_name = 'session_id';
