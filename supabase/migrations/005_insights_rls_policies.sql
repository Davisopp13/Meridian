-- Insights RLS Policies
-- Allows supervisors to SELECT rows for the agents on their supervised teams.
-- Apply in Supabase SQL Editor. DO NOT apply via Ralph.

-- 1. case_events: supervisors can read events for agents on their teams
CREATE POLICY "supervisors read supervised team events" ON case_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM supervisor_teams st
      JOIN platform_users pu ON pu.team_id = st.team_id
      WHERE st.supervisor_id = auth.uid()
        AND pu.id = case_events.user_id
    )
  );

-- 2. mpl_entries: supervisors can read MPL entries for agents on their teams
CREATE POLICY "supervisors read supervised team mpl entries" ON mpl_entries
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM supervisor_teams st
      JOIN platform_users pu ON pu.team_id = st.team_id
      WHERE st.supervisor_id = auth.uid()
        AND pu.id = mpl_entries.user_id
    )
  );

-- 3. platform_users: supervisors can read agent profiles for their teams
--    (needed for full_name and email in the Insights UI)
CREATE POLICY "supervisors read supervised team agents" ON platform_users
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM supervisor_teams st
      WHERE st.supervisor_id = auth.uid()
        AND st.team_id = platform_users.team_id
    )
  );
