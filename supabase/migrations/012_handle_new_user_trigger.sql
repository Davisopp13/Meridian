-- ============================================================
-- 012_handle_new_user_trigger.sql
--
-- Ensures every auth.users row has a matching platform_users row.
-- Without this, signup creates an auth identity but no profile row,
-- so the onboarding UPDATE in Onboarding.handleComplete() hits zero
-- rows and the "All done — Launch Meridian →" button appears broken.
--
-- Idempotent. Safe to re-run.
-- ============================================================

-- 1. Function: on auth.users insert, create a matching platform_users row.
--    SECURITY DEFINER so it can write into a table the anon role cannot.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.platform_users (id, email, onboarding_complete, created_at, updated_at)
  VALUES (NEW.id, NEW.email, false, now(), now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Trigger: fire after a new auth.users row is committed.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill: any existing auth.users without a platform_users row.
--    Covers anyone who signed up before the trigger existed.
INSERT INTO public.platform_users (id, email, onboarding_complete, created_at, updated_at)
SELECT u.id, u.email, false, now(), now()
FROM auth.users u
LEFT JOIN public.platform_users p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
