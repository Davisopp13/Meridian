-- ============================================================
-- 022_unified_start_rpc_user_id.sql
-- Replace bulk_reclassify_cases and undo_mass_reclass_batch
-- to accept explicit p_user_id instead of relying on auth.uid().
-- Needed because the widget invokes these via the relay using the
-- anon key — auth.uid() would be null.
-- The widget passes state.userId (baked in at bookmarklet install
-- via MERIDIAN_PAYLOAD), same trust model as pending_triggers inserts.
-- ============================================================

DROP FUNCTION IF EXISTS public.bulk_reclassify_cases(jsonb);
DROP FUNCTION IF EXISTS public.undo_mass_reclass_batch(uuid);

CREATE OR REPLACE FUNCTION public.bulk_reclassify_cases(
  p_user_id uuid,
  p_case_refs jsonb
)
RETURNS TABLE (batch_id uuid, case_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'bulk_reclassify_cases: p_user_id is required';
  END IF;
  -- Sanity: user_id must exist in platform_users to prevent spoofing
  IF NOT EXISTS (SELECT 1 FROM platform_users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'bulk_reclassify_cases: unknown user_id %', p_user_id;
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
      p_user_id, v_case_number, v_sf_case_id,
      v_now, v_now, NULL,
      'closed', 'reclassified', false, 'bulk',
      v_today, v_reopen_count, v_batch_id
    )
    RETURNING id INTO v_new_case_id;

    INSERT INTO public.case_events (
      session_id, user_id, type, excluded, rfc, sf_case_id, batch_id
    ) VALUES (
      v_new_case_id, p_user_id, 'reclassified', false, false, v_sf_case_id, v_batch_id
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN QUERY SELECT v_batch_id, v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_mass_reclass_batch(
  p_user_id uuid,
  p_batch_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF p_user_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'undo_mass_reclass_batch: p_user_id and p_batch_id required';
  END IF;

  DELETE FROM public.case_events
  WHERE batch_id = p_batch_id AND user_id = p_user_id;

  DELETE FROM public.ct_cases
  WHERE batch_id = p_batch_id AND user_id = p_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_reclassify_cases(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_mass_reclass_batch(uuid, uuid) TO anon, authenticated;

SELECT proname, pronargs
FROM pg_proc
WHERE proname IN ('bulk_reclassify_cases', 'undo_mass_reclass_batch');
