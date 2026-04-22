-- ============================================================
-- 014_dedupe_platform_users_policies.sql
--
-- Migration 013 added explicitly-named self-access policies on
-- platform_users, but the table already had three snake_case policies
-- from the out-of-band canonical schema (meridian-migration-v2.sql):
--
--   users_select_own       (SELECT — id = auth.uid())
--   users_update_own       (UPDATE — id = auth.uid())
--   supervisors_read_team  (SELECT — supervisor scope)
--
-- These duplicate the policies from 013. RLS OR's them together so the
-- behavior is the same, but carrying two copies of each rule is a source
-- of future confusion. Drop the legacy snake_case versions; keep the
-- descriptive ones from 013.
--
-- Idempotent. Safe to re-run.
-- ============================================================

-- Drop the legacy duplicates. The 013-named policies remain in place.
DROP POLICY IF EXISTS "users_select_own"      ON platform_users;
DROP POLICY IF EXISTS "users_update_own"      ON platform_users;
DROP POLICY IF EXISTS "supervisors_read_team" ON platform_users;

-- Verification: final policy list on platform_users.
-- Expected rows after this migration:
--   admins update platform_users              UPDATE
--   supervisors read supervised team agents   SELECT
--   users insert own platform_users row       INSERT
--   users read own platform_users row         SELECT
--   users update own platform_users row       UPDATE
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'platform_users'
ORDER BY policyname;
