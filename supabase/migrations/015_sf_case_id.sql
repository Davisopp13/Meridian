-- 015_sf_case_id.sql
-- Adds Salesforce Case record Id column to enable deep-linking from Meridian
-- into the live SF case. Nullable because pre-existing rows don't have it,
-- and because non-SF pages (MPL) don't produce case IDs.
-- (Originally spec'd as 007; renumbered to 015 because 007 was already used
--  by 007_migration_source_id.sql added in a prior track.)

ALTER TABLE public.ct_cases
  ADD COLUMN IF NOT EXISTS sf_case_id TEXT;

ALTER TABLE public.case_events
  ADD COLUMN IF NOT EXISTS sf_case_id TEXT;

-- Basic shape check — SF Case IDs start with '500' and are 15 or 18 chars.
-- Enforced as CHECK rather than a type because we want NULLs to pass freely.
ALTER TABLE public.ct_cases
  DROP CONSTRAINT IF EXISTS ct_cases_sf_case_id_shape,
  ADD CONSTRAINT ct_cases_sf_case_id_shape
    CHECK (
      sf_case_id IS NULL
      OR sf_case_id ~ '^500[a-zA-Z0-9]{12,15}$'
    );

ALTER TABLE public.case_events
  DROP CONSTRAINT IF EXISTS case_events_sf_case_id_shape,
  ADD CONSTRAINT case_events_sf_case_id_shape
    CHECK (
      sf_case_id IS NULL
      OR sf_case_id ~ '^500[a-zA-Z0-9]{12,15}$'
    );

-- Index on case_events for the common lookup:
-- "give me this agent's recent activity with SF links resolvable"
CREATE INDEX IF NOT EXISTS idx_case_events_sf_case_id
  ON public.case_events (sf_case_id)
  WHERE sf_case_id IS NOT NULL;

-- Grants, in case a DROP SCHEMA CASCADE has stripped them historically.
GRANT SELECT, INSERT, UPDATE ON public.ct_cases TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.case_events TO anon, authenticated, service_role;
