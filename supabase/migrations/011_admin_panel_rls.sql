-- 011_admin_panel_rls.sql
-- Adds INSERT / UPDATE / DELETE policies for admins on the tables managed
-- through the Admin Panel. All policies gate on the caller having
-- role = 'admin' in platform_users, matching the pattern from 006_suggestion_box.sql.
-- Also grants the necessary privileges to the `authenticated` role so RLS
-- can control access on top of the grant.
-- Safe to re-run (all policies wrapped in DROP IF EXISTS + CREATE).

-- ============================================================
-- platform_users — UPDATE only
-- (INSERT is handled by auth trigger; DELETE is not allowed.)
-- ============================================================

DROP POLICY IF EXISTS "admins update platform_users" ON platform_users;
CREATE POLICY "admins update platform_users" ON platform_users
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

GRANT UPDATE ON platform_users TO authenticated;

-- ============================================================
-- teams — INSERT, UPDATE, DELETE
-- ============================================================

DROP POLICY IF EXISTS "admins insert teams" ON teams;
CREATE POLICY "admins insert teams" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

DROP POLICY IF EXISTS "admins update teams" ON teams;
CREATE POLICY "admins update teams" ON teams
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

DROP POLICY IF EXISTS "admins delete teams" ON teams;
CREATE POLICY "admins delete teams" ON teams
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

GRANT INSERT, UPDATE, DELETE ON teams TO authenticated;

-- ============================================================
-- departments — INSERT, UPDATE, DELETE
-- Note: FK on teams.department_id is ON DELETE RESTRICT, so
-- deleting a department with teams will be rejected by the DB.
-- ============================================================

DROP POLICY IF EXISTS "admins insert departments" ON departments;
CREATE POLICY "admins insert departments" ON departments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

DROP POLICY IF EXISTS "admins update departments" ON departments;
CREATE POLICY "admins update departments" ON departments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

DROP POLICY IF EXISTS "admins delete departments" ON departments;
CREATE POLICY "admins delete departments" ON departments
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

GRANT INSERT, UPDATE, DELETE ON departments TO authenticated;

-- ============================================================
-- mpl_categories — INSERT, UPDATE, DELETE
-- ============================================================

DROP POLICY IF EXISTS "admins insert mpl_categories" ON mpl_categories;
CREATE POLICY "admins insert mpl_categories" ON mpl_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

DROP POLICY IF EXISTS "admins update mpl_categories" ON mpl_categories;
CREATE POLICY "admins update mpl_categories" ON mpl_categories
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

DROP POLICY IF EXISTS "admins delete mpl_categories" ON mpl_categories;
CREATE POLICY "admins delete mpl_categories" ON mpl_categories
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

GRANT INSERT, UPDATE, DELETE ON mpl_categories TO authenticated;

-- ============================================================
-- mpl_subcategories — INSERT, UPDATE, DELETE
-- ============================================================

DROP POLICY IF EXISTS "admins insert mpl_subcategories" ON mpl_subcategories;
CREATE POLICY "admins insert mpl_subcategories" ON mpl_subcategories
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

DROP POLICY IF EXISTS "admins update mpl_subcategories" ON mpl_subcategories;
CREATE POLICY "admins update mpl_subcategories" ON mpl_subcategories
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

DROP POLICY IF EXISTS "admins delete mpl_subcategories" ON mpl_subcategories;
CREATE POLICY "admins delete mpl_subcategories" ON mpl_subcategories
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

GRANT INSERT, UPDATE, DELETE ON mpl_subcategories TO authenticated;

-- ============================================================
-- supervisor_teams — INSERT, DELETE
-- (UPDATE not needed — the junction row is replaced by DELETE + INSERT.)
-- ============================================================

DROP POLICY IF EXISTS "admins insert supervisor_teams" ON supervisor_teams;
CREATE POLICY "admins insert supervisor_teams" ON supervisor_teams
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

DROP POLICY IF EXISTS "admins delete supervisor_teams" ON supervisor_teams;
CREATE POLICY "admins delete supervisor_teams" ON supervisor_teams
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

GRANT INSERT, DELETE ON supervisor_teams TO authenticated;

-- ============================================================
-- Summary — list all policies on the affected tables so Davis
-- can visually confirm after applying.
-- ============================================================
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename IN (
  'platform_users',
  'teams',
  'departments',
  'mpl_categories',
  'mpl_subcategories',
  'supervisor_teams'
)
ORDER BY tablename, policyname;
