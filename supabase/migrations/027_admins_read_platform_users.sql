-- 027_admins_read_platform_users.sql
--
-- Adds the missing admin SELECT policy on platform_users.
--
-- Migration 011 granted admins UPDATE on platform_users. Migration 013
-- rewrote that UPDATE policy to use is_admin() (to avoid infinite
-- recursion) and added self-access policies (users can SELECT + UPDATE
-- their own row) — but neither migration ever added an admin SELECT
-- policy.
--
-- The gap surfaces only when an admin tries to UPDATE another user's
-- row. PostgREST performs a SELECT to locate the target row before the
-- UPDATE runs. With no admin SELECT policy, the target row is invisible
-- to the SELECT phase; the subsequent UPDATE targets zero rows and
-- Postgres returns a misleading "new row violates row-level security
-- policy" error rather than "0 rows updated."
--
-- Admins could still see other users' rows in the UI via the supervisor
-- SELECT policy (when the admin happened to supervise the team) or via
-- out-of-band caching, which hid the problem until the admin team
-- selector fix made empty teams selectable — at which point the
-- long-dormant UPDATE bug became reachable.
--
-- Adding this policy completes the admin read/write surface on
-- platform_users. Idempotent; safe to re-run.

drop policy if exists "admins read platform_users" on platform_users;
create policy "admins read platform_users"
  on platform_users
  for select
  to authenticated
  using (public.is_admin());

-- Verification: final policy list on platform_users.
-- Expected rows after this migration:
--   admins read platform_users                SELECT
--   admins update platform_users              UPDATE
--   supervisors read supervised team agents   SELECT
--   users insert own platform_users row       INSERT
--   users read own platform_users row         SELECT
--   users update own platform_users row       UPDATE
select policyname, cmd, roles
from pg_policies
where tablename = 'platform_users'
order by policyname;
