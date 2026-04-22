-- ============================================================
-- 016_session_id_fk.sql
-- Ensures session_id exists as a TEXT column on both ct_cases
-- and case_events so the widget can use it as a join key between
-- independent inserts describing the same case session.
-- Idempotent.
-- ============================================================

-- Add session_id if missing. TEXT (not UUID) because we want the
-- widget to generate it client-side via crypto.randomUUID() without
-- requiring a uuid-ossp cast round-trip.
ALTER TABLE public.ct_cases
  ADD COLUMN IF NOT EXISTS session_id TEXT;

ALTER TABLE public.case_events
  ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Indexes for the join. Partial (WHERE NOT NULL) keeps them lean —
-- historical rows with session_id = NULL are not linkable anyway.
CREATE INDEX IF NOT EXISTS idx_ct_cases_session_id
  ON public.ct_cases (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_events_session_id
  ON public.case_events (session_id)
  WHERE session_id IS NOT NULL;

-- Grants, in case a DROP SCHEMA CASCADE has stripped them historically.
GRANT SELECT, INSERT, UPDATE ON public.ct_cases TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.case_events TO anon, authenticated, service_role;
