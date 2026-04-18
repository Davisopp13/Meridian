-- ============================================================
-- 003_teams_and_roles.sql
-- Introduces departments, teams, supervisor_teams, role column.
-- Keeps platform_users.team as a deprecated fallback column.
-- ============================================================

-- 1. Departments
CREATE TABLE IF NOT EXISTS departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Teams
CREATE TABLE IF NOT EXISTS teams (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL UNIQUE,
  department_id  uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  haulage_type   text NOT NULL CHECK (haulage_type IN ('CH', 'MH')),
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teams_department_id_idx ON teams(department_id);

-- 3. platform_users: add role and team_id. Keep old team column.
ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'agent'
    CHECK (role IN ('agent', 'supervisor', 'director')),
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE SET NULL;

COMMENT ON COLUMN platform_users.team IS
  'DEPRECATED — use team_id instead. Slated for removal after Track 2 stabilizes.';

CREATE INDEX IF NOT EXISTS platform_users_team_id_idx ON platform_users(team_id);
CREATE INDEX IF NOT EXISTS platform_users_role_idx    ON platform_users(role);

-- 4. supervisor_teams junction
CREATE TABLE IF NOT EXISTS supervisor_teams (
  supervisor_id  uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  team_id        uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supervisor_id, team_id)
);

CREATE INDEX IF NOT EXISTS supervisor_teams_team_id_idx ON supervisor_teams(team_id);

-- 5. RLS — open to authenticated reads on the new tables.
--    Writes stay service-role only for now.
ALTER TABLE departments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments readable to authenticated" ON departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "teams readable to authenticated" ON teams
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "supervisor_teams readable to authenticated" ON supervisor_teams
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON departments      TO authenticated;
GRANT SELECT ON teams            TO authenticated;
GRANT SELECT ON supervisor_teams TO authenticated;

-- 6. Seed departments
INSERT INTO departments (name) VALUES
  ('IDT'),
  ('Customer Service')
ON CONFLICT (name) DO NOTHING;

-- 7. Seed teams (under IDT)
INSERT INTO teams (name, department_id, haulage_type)
SELECT 'Export Rail: Southeast Gulf Pacific', d.id, 'MH'
FROM departments d WHERE d.name = 'IDT'
ON CONFLICT (name) DO NOTHING;

INSERT INTO teams (name, department_id, haulage_type)
SELECT 'Export Rail: Northeast Midwest', d.id, 'MH'
FROM departments d WHERE d.name = 'IDT'
ON CONFLICT (name) DO NOTHING;

-- 8. Backfill platform_users.team_id for existing MH users.
--    Default assignment: Southeast Gulf Pacific. Can be
--    reassigned individually later.
UPDATE platform_users
SET team_id = (
  SELECT id FROM teams WHERE name = 'Export Rail: Southeast Gulf Pacific'
)
WHERE team = 'MH' AND team_id IS NULL;

-- 9. CH users: no team exists yet. Log how many we're leaving stranded
--    so Davis can eyeball the count and confirm.
DO $$
DECLARE
  ch_count int;
BEGIN
  SELECT COUNT(*) INTO ch_count
  FROM platform_users
  WHERE team = 'CH' AND team_id IS NULL;
  RAISE NOTICE 'Users with team=CH and no team_id (expected, no CH team seeded): %', ch_count;
END $$;

-- 10. Fail loudly if any user has an unexpected team value.
DO $$
DECLARE
  bad_count int;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM platform_users
  WHERE team IS NOT NULL AND team NOT IN ('CH', 'MH');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Found % users with team value outside (CH, MH). Fix data before migrating.', bad_count;
  END IF;
END $$;

-- 11. Promote Davis to supervisor and assign both Export Rail teams.
--     NOTE: replace the email below with the real production email
--     before running. The DO block fails silently if the user isn't
--     found, which is what we want in staging.
DO $$
DECLARE
  davis_id uuid;
  sgp_id   uuid;
  nem_id   uuid;
BEGIN
  SELECT id INTO davis_id FROM platform_users
  WHERE email ILIKE 'davis%@hlag.com' OR email ILIKE 'davis%hapag%' LIMIT 1;

  IF davis_id IS NULL THEN
    RAISE NOTICE 'Davis account not found — skipping supervisor assignment. Edit email pattern and re-run if needed.';
    RETURN;
  END IF;

  UPDATE platform_users SET role = 'supervisor' WHERE id = davis_id;

  SELECT id INTO sgp_id FROM teams WHERE name = 'Export Rail: Southeast Gulf Pacific';
  SELECT id INTO nem_id FROM teams WHERE name = 'Export Rail: Northeast Midwest';

  INSERT INTO supervisor_teams (supervisor_id, team_id) VALUES
    (davis_id, sgp_id),
    (davis_id, nem_id)
  ON CONFLICT DO NOTHING;

  -- Also give Davis a team_id so agent-scope queries continue to work for him.
  UPDATE platform_users SET team_id = sgp_id WHERE id = davis_id AND team_id IS NULL;
END $$;

-- 12. Summary output — review this before continuing.
SELECT
  (SELECT COUNT(*) FROM departments)                                     AS dept_count,
  (SELECT COUNT(*) FROM teams)                                           AS team_count,
  (SELECT COUNT(*) FROM platform_users WHERE team_id IS NOT NULL)        AS users_with_team_id,
  (SELECT COUNT(*) FROM platform_users WHERE team_id IS NULL)            AS users_without_team_id,
  (SELECT COUNT(*) FROM platform_users WHERE role = 'supervisor')        AS supervisors,
  (SELECT COUNT(*) FROM supervisor_teams)                                AS supervisor_assignments;
