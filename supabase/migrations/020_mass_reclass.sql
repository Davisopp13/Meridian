-- Migration 020: Mass Reclassify feature
-- Adds 'bulk' source, batch_id columns, and RPC functions for bulk reclassify + undo.
-- Davis must apply this manually via Supabase SQL Editor.

BEGIN;

-- 1. Extend source CHECK constraint on ct_cases to allow 'bulk'
ALTER TABLE public.ct_cases DROP CONSTRAINT IF EXISTS ct_cases_source_check;
ALTER TABLE public.ct_cases ADD CONSTRAINT ct_cases_source_check
  CHECK (source IN ('pip', 'manual', 'bulk'));

-- 2. Add batch_id columns for undo tracking
ALTER TABLE public.ct_cases ADD COLUMN IF NOT EXISTS batch_id uuid;
ALTER TABLE public.case_events ADD COLUMN IF NOT EXISTS batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_ct_cases_batch_id ON public.ct_cases(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_events_batch_id ON public.case_events(batch_id) WHERE batch_id IS NOT NULL;

-- 3. RPC: bulk_reclassify_cases
CREATE OR REPLACE FUNCTION public.bulk_reclassify_cases(p_case_refs jsonb)
RETURNS TABLE (batch_id uuid, case_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_batch_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_today date := (now() AT TIME ZONE 'America/New_York')::date;
  v_ref jsonb;
  v_case_number text;
  v_sf_case_id text;
  v_reopen_count int;
  v_new_case_id uuid;
  v_inserted int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'bulk_reclassify_cases: not authenticated';
  END IF;
  IF jsonb_typeof(p_case_refs) <> 'array' THEN
    RAISE EXCEPTION 'bulk_reclassify_cases: p_case_refs must be a JSON array';
  END IF;

  FOR v_ref IN SELECT * FROM jsonb_array_elements(p_case_refs)
  LOOP
    v_case_number := v_ref->>'case_number';
    v_sf_case_id  := v_ref->>'sf_case_id';
    CONTINUE WHEN v_case_number IS NULL OR v_case_number = '';

    SELECT COUNT(*) INTO v_reopen_count
    FROM public.ct_cases
    WHERE case_number = v_case_number
      AND resolution IN ('resolved', 'reclassified');

    INSERT INTO public.ct_cases (
      user_id, case_number, sf_case_id,
      started_at, ended_at, duration_s,
      status, resolution, is_rfc, source,
      entry_date, reopen_count, batch_id
    ) VALUES (
      v_user_id, v_case_number, v_sf_case_id,
      v_now, v_now, NULL,
      'closed', 'reclassified', false, 'bulk',
      v_today, v_reopen_count, v_batch_id
    )
    RETURNING id INTO v_new_case_id;

    INSERT INTO public.case_events (
      session_id, user_id, type, excluded, rfc, sf_case_id, batch_id
    ) VALUES (
      v_new_case_id, v_user_id, 'reclassified', false, false, v_sf_case_id, v_batch_id
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN QUERY SELECT v_batch_id, v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_reclassify_cases(jsonb) TO authenticated;

-- 4. RPC: undo_mass_reclass_batch
CREATE OR REPLACE FUNCTION public.undo_mass_reclass_batch(p_batch_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_deleted int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'undo_mass_reclass_batch: not authenticated';
  END IF;

  DELETE FROM public.case_events
  WHERE batch_id = p_batch_id AND user_id = v_user_id;

  DELETE FROM public.ct_cases
  WHERE batch_id = p_batch_id AND user_id = v_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.undo_mass_reclass_batch(uuid) TO authenticated;

COMMIT;
