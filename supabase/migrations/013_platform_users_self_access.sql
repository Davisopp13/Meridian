-- ============================================================
-- 013_platform_users_self_access.sql
--
-- Fixes two issues blocking onboarding on platform_users:
--
--   1. Infinite recursion in the "admins update platform_users" policy.
--      Its USING / WITH CHECK clauses did `SELECT … FROM platform_users`,
--      which re-triggered RLS on platform_users → recursion. Postgres
--      raised: "infinite recursion detected in policy for relation".
--      We replace the subquery with a SECURITY DEFINER helper function
--      `is_admin()` that bypasses RLS when checking the caller's role.
--
--   2. Missing self-access policies. A new user has no way to read or
--      update their own row, so `fetchProfile` returns nothing and the
--      onboarding UPDATE is denied. We add explicit SELECT / UPDATE /
--      INSERT policies scoped to `id = auth.uid()`.
--
-- Idempotent. Safe to re-run.
-- ============================================================

-- 1. is_admin() helper — SECURITY DEFINER so it bypasses RLS on
--    platform_users when checking whether the caller is an admin.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. Rewrite the admin UPDATE policy to use is_admin() — no recursion.
DROP POLICY IF EXISTS "admins update platform_users" ON platform_users;
CREATE POLICY "admins update platform_users" ON platform_users
  FOR UPDATE TO authenticated
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. Self-access policies: every authenticated user can see and
--    update their own row. Needed for profile fetch and onboarding.
DROP POLICY IF EXISTS "users read own platform_users row" ON platform_users;
CREATE POLICY "users read own platform_users row" ON platform_users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "users update own platform_users row" ON platform_users;
CREATE POLICY "users update own platform_users row" ON platform_users
  FOR UPDATE TO authenticated
  USING      (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 4. INSERT fallback for the client-side INSERT in Onboarding.handleComplete.
--    The auth trigger (012) should create the row, but this covers the edge
--    case where the trigger is missing or failed. Anyone who authenticates
--    may only insert a row keyed to their own auth.uid().
DROP POLICY IF EXISTS "users insert own platform_users row" ON platform_users;
CREATE POLICY "users insert own platform_users row" ON platform_users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 5. Grant the privileges RLS sits on top of.
GRANT SELECT, INSERT, UPDATE ON platform_users TO authenticated;

-- 6. Also apply the same recursion fix to the admin policies on the
--    other tables that reference platform_users in their subqueries.
--    These aren't strictly recursive (they read platform_users from
--    policies attached to teams/departments/etc., not to platform_users
--    itself), but swapping them over to is_admin() is cleaner and makes
--    the whole admin surface consistent.

DROP POLICY IF EXISTS "admins insert teams" ON teams;
CREATE POLICY "admins insert teams" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins update teams" ON teams;
CREATE POLICY "admins update teams" ON teams
  FOR UPDATE TO authenticated
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins delete teams" ON teams;
CREATE POLICY "admins delete teams" ON teams
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins insert departments" ON departments;
CREATE POLICY "admins insert departments" ON departments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins update departments" ON departments;
CREATE POLICY "admins update departments" ON departments
  FOR UPDATE TO authenticated
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins delete departments" ON departments;
CREATE POLICY "admins delete departments" ON departments
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins insert mpl_categories" ON mpl_categories;
CREATE POLICY "admins insert mpl_categories" ON mpl_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins update mpl_categories" ON mpl_categories;
CREATE POLICY "admins update mpl_categories" ON mpl_categories
  FOR UPDATE TO authenticated
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins delete mpl_categories" ON mpl_categories;
CREATE POLICY "admins delete mpl_categories" ON mpl_categories
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins insert mpl_subcategories" ON mpl_subcategories;
CREATE POLICY "admins insert mpl_subcategories" ON mpl_subcategories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins update mpl_subcategories" ON mpl_subcategories;
CREATE POLICY "admins update mpl_subcategories" ON mpl_subcategories
  FOR UPDATE TO authenticated
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins delete mpl_subcategories" ON mpl_subcategories;
CREATE POLICY "admins delete mpl_subcategories" ON mpl_subcategories
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins insert supervisor_teams" ON supervisor_teams;
CREATE POLICY "admins insert supervisor_teams" ON supervisor_teams
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins delete supervisor_teams" ON supervisor_teams;
CREATE POLICY "admins delete supervisor_teams" ON supervisor_teams
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 7. Verification: list every policy on platform_users after the migration.
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'platform_users'
ORDER BY policyname;
