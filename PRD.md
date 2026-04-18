# Meridian Insights Tab PRD

## Project Overview

Ship the Meridian Insights tab — a supervisor-facing dashboard inside the existing Meridian web app that surfaces team-level productivity stats aggregated from `case_events` and `mpl_entries`. The tab is gated on `profile.role = &#x27;supervisor&#x27;` and scopes data to only the teams the supervisor is assigned in `supervisor_teams`. Tech stack: Vite + React 18, Supabase, inline styles, same patterns as `src/components/Dashboard.jsx`.

Success = Steven or Davis (acting as supervisor) can open the Meridian dashboard, click an &quot;Insights&quot; tab in the navbar, and see four panels showing team case volume, handle time per agent, MPL minutes by category, and a trend comparison against the prior period — all for the teams they&#x27;re assigned to, with no other team&#x27;s data leaking through.

Test command: `npx vite build 2&gt;&amp;1 | tail -8` — must show `✓ built in` with zero errors. Manual smoke test: log in as Davis (supervisor), confirm the Insights tab renders with non-empty data.

## Architecture &amp; Key Decisions

- **Schema is fixed.** `departments`, `teams`, `supervisor_teams`, `platform_users.role`, and `platform_users.team_id` already exist (Track 2 migration `003_teams_and_roles.sql` has been applied). Do not propose schema changes; if data is missing, assume it&#x27;s an alpha-data gap, not a schema problem.
- **Routing pattern: tab, not route.** Insights is a new `view` value inside the existing `Dashboard.jsx` component&#x27;s view state (alongside `&#x27;dashboard&#x27;`, `&#x27;activity&#x27;`, `&#x27;settings&#x27;`). No react-router, no new URL scheme.
- **Role gating happens in `Navbar.jsx`** — the Insights tab is not rendered at all for users whose `profile.role !== &#x27;supervisor&#x27;` and whose `profile.role !== &#x27;director&#x27;`. Defense-in-depth: `InsightsTab.jsx` also checks and renders an empty state if a non-supervisor somehow reaches it (e.g. stale cached state).
- **Data access path.** A new hook `useTeamInsights` takes `{ supervisorId, period }` and internally: (1) fetches supervised team IDs via `fetchSupervisedTeams(supervisorId)`, (2) fetches all agents in those teams from `platform_users`, (3) fetches `case_events` and `mpl_entries` for those agent IDs in the period window. All aggregation happens client-side for now — no new Supabase views, no RPCs. The alpha scale (&lt; 20 agents, &lt; 30 days of history) is well within what client-side JS can chew through.
- **Aggregation function is shared.** Extract the existing `useDashboardStats` aggregation into a pure function `aggregateStats(events, procs, period)` in a new file `src/lib/stats.js`. Both the existing `useDashboardStats` (single user) and the new `useTeamInsights` (team, per-agent) call it. Do not duplicate the math.
- **Period controls match `Dashboard.jsx`.** Same five periods (this_week, last_week, this_month, last_month, ytd), same tab styling. The period state lives on `InsightsTab` locally, not in the parent.
- **Chart library is `recharts` if already installed, else inline SVG.** Check `package.json`. Do not add a new dependency in this task.
- **Styling: inline styles using CSS custom properties (`var(--bg-card)` etc.)**, matching the existing Dashboard. Do not introduce Tailwind, CSS modules, or styled-components.
- **RLS: read-only `SELECT` policies on `case_events` and `mpl_entries` may need to be relaxed** so supervisors can read their team&#x27;s rows. If a query returns empty while data is clearly present for a team member, the fix is an RLS policy update — NOT a client-side workaround. A new migration file for the policy change is acceptable, but write the SQL in a new file and flag it in progress.txt for Davis to apply manually; do not attempt to apply it from Ralph.

## File Structure

```
src/
  components/
    InsightsTab.jsx                   NEW
    insights/
      TeamCaseVolumePanel.jsx         NEW
      AgentHandleTimePanel.jsx        NEW
      MplByCategoryPanel.jsx          NEW
      TrendComparisonPanel.jsx        NEW
      AgentRow.jsx                    NEW  (shared row component)
      InsightsEmptyState.jsx          NEW  (non-supervisor or no data)
  hooks/
    useTeamInsights.js                NEW
  lib/
    stats.js                          NEW  (extracted aggregation)
    api.js                            EDIT (add fetchTeamAgents, fetchTeamEvents)
  components/
    Dashboard.jsx                     EDIT (add &#x27;insights&#x27; view branch)
    Navbar.jsx                        EDIT (add Insights tab, role-gated)

supabase/
  migrations/
    004_insights_rls_policies.sql     NEW — written, NOT applied by Ralph
```

## Environment &amp; Setup

- Supabase URL and anon key are already wired via `src/lib/supabase.js`.
- `supabase_anon` key: reads are RLS-gated (will need policy update — see above).
- The dev app runs on `localhost:5173` via `npm run dev`; build with `npx vite build`.
- Assume Track 1 (App.jsx retirement + data layer) and Track 2 (schema migration) are merged. `src/lib/api.js` exists with `fetchProfile`, `logCaseEvent`, `logMplEntry`, `fetchCategoriesForTeam`, `fetchCategoriesForTeamId`, `fetchSupervisedTeams`. The main dashboard entry is `src/DashboardApp.jsx`, not `src/App.jsx`.

## Tasks

### Phase 1 — Shared aggregation + data layer

- [x] **Task 1: Extract pure aggregation function into `src/lib/stats.js`**
  - Create `src/lib/stats.js` exporting `aggregateStats(events, procs)` — pure function, no Supabase calls, no React.
  - Move the body of `useDashboardStats.js` that runs after the `Promise.all` fetch (lines roughly 104–150, the `events.filter(...)` block through the `dayMap` construction) into this function.
  - Input shape: `events` is an array of `{ type, excluded, timestamp, user_id? }`, `procs` is an array of `{ created_at, minutes, category_id, user_id? }`. Output: same shape as what `useDashboardStats` currently returns (`{ resolved, reclass, calls, notACase, processes, casesAndCalls, totalActivity, byDay: [...] }`), plus a new optional `byUser` map when `user_id` is present on input rows.
  - Update `useDashboardStats.js` to call `aggregateStats(events, procs)` instead of duplicating the logic.
  - Acceptance: `npx vite build` passes. Dashboard still shows the same numbers for the current user.

- [x] **Task 2: Add insights-scoped helpers to `src/lib/api.js`**
  - Add `fetchTeamAgents(teamIds)` — returns `platform_users` rows where `team_id IN teamIds` AND `role = &#x27;agent&#x27;` AND `onboarding_complete = true`. Select `id, email, full_name, team_id`.
  - Add `fetchTeamCaseEvents({ userIds, from, to })` — returns `case_events` rows matching the user set and timestamp range. Same field selection as `useDashboardStats` plus `user_id`.
  - Add `fetchTeamMplEntries({ userIds, from, to })` — same pattern for `mpl_entries`.
  - All three are thin Supabase wrappers; no aggregation, no business logic.
  - Acceptance: `grep -n &quot;fetchTeamAgents\\|fetchTeamCaseEvents\\|fetchTeamMplEntries&quot; src/lib/api.js` returns three matches.

### Phase 2 — Insights hook + RLS migration file

- [x] **Task 3: Write `src/hooks/useTeamInsights.js`**
  - Signature: `useTeamInsights({ supervisorId, period })` → `{ loading, error, teams, agents, perAgentStats, teamTotals, byCategory, byDayByTeam }`.
  - Internally: call `fetchSupervisedTeams` → extract team_ids → `fetchTeamAgents(team_ids)` → collect agent user_ids → `fetchTeamCaseEvents` and `fetchTeamMplEntries` with the period range → group events/procs by `user_id` → run `aggregateStats` for each agent and for the whole team.
  - Reuse `getDateRange(period)` from `useDashboardStats.js` — extract it into `src/lib/stats.js` if needed and export it.
  - Cancellation semantics: match `useDashboardStats` (cancelled flag on effect cleanup).
  - Acceptance: `npx vite build` passes. Hook can be imported; does not need to be wired into UI yet.

- [x] **Task 4: Write `supabase/migrations/004_insights_rls_policies.sql`**
  - Add a SELECT policy on `case_events` named `supervisors read supervised team events` that allows a user to SELECT a row IF they have a `supervisor_teams` entry where the row&#x27;s `user_id`&#x27;s `team_id` matches. Structurally:
    ```sql
    CREATE POLICY &quot;supervisors read supervised team events&quot; ON case_events
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1
          FROM supervisor_teams st
          JOIN platform_users pu ON pu.team_id = st.team_id
          WHERE st.supervisor_id = auth.uid()
            AND pu.id = case_events.user_id
        )
      );
    ```
  - Do the same for `mpl_entries`.
  - Also allow supervisors to SELECT `platform_users` rows for their supervised teams (needed for agent names in the UI).
  - DO NOT APPLY the migration. Write the file, log in `progress.txt` that Davis must run it in the Supabase SQL editor before the Insights tab will show any team data.
  - Acceptance: file exists and parses (a `grep -c &#x27;CREATE POLICY&#x27; supabase/migrations/004_insights_rls_policies.sql` returns at least 3).

### Phase 3 — Four panels

- [x] **Task 5: Build `InsightsEmptyState.jsx`**
  - Two states: (1) &quot;Insights is available to supervisors only&quot; when `profile.role !== &#x27;supervisor&#x27;`, (2) &quot;No team data in this period&quot; when the query returns empty arrays.
  - Match the visual style of `Dashboard.jsx`&#x27;s existing empty states (check the component for the pattern).
  - Acceptance: builds, component is self-contained.

- [x] **Task 6: Build `AgentRow.jsx`**
  - Props: `{ agent: { id, full_name, email }, stats: { resolved, reclass, calls, notACase, processes, totalActivity } }`.
  - Renders a single table row with columns: Agent name, Resolved, Reclassified, Calls, Processes, Total activity. Use the same colors as the `METRICS` array in `Dashboard.jsx` for the numbers.
  - Reusable across panels that show per-agent breakdowns.
  - Acceptance: component builds, no unused props.

- [x] **Task 7: Build `TeamCaseVolumePanel.jsx`**
  - Props: `{ perAgentStats, teamTotals }` from `useTeamInsights`.
  - Renders: a card with the team&#x27;s total cases at the top (resolved + reclass + calls + not_a_case), and below it a stacked horizontal bar per agent showing the split. Use inline SVG rects if recharts is not present. Width 100%, height auto.
  - Styling matches `DashboardStatCard.jsx` container.
  - Acceptance: component builds. Sample rendering with mock data (can be a hardcoded snippet commented out at the bottom of the file) looks reasonable.

- [x] **Task 8: Build `AgentHandleTimePanel.jsx`**
  - Props: `{ perAgentStats }`.
  - Computes average handle time per agent from `bar_sessions` + `case_events` — BUT for this task, use a placeholder: `cases_per_hour = (resolved + reclass) / hours_active`, where `hours_active` = rough fixed assumption (8h per active day). Mark this with a TODO comment saying real handle time needs session-level duration data from `bar_sessions`.
  - Renders a sortable table using `AgentRow` plus an extra &quot;Cases/hour&quot; column.
  - Acceptance: builds; TODO comment is present so Davis knows the number is provisional.

- [ ] **Task 9: Build `MplByCategoryPanel.jsx`**
  - Props: `{ byCategory }` — a map of `{ categoryName: totalMinutes }` for the team.
  - Renders horizontal bars, longest at the top. Use the same horizontal-bar pattern from Task 7.
  - If there are more than 10 categories, show top 8 + &quot;Other&quot; bucket.
  - Acceptance: builds, category names and minutes render.

- [ ] **Task 10: Build `TrendComparisonPanel.jsx`**
  - Props: `{ period, perAgentStats, previousPerAgentStats }`.
  - For this task, `previousPerAgentStats` is computed inside `useTeamInsights` by calling it a second time with the shifted period (`this_week` → `last_week`, etc.). The hook returns both.
  - Renders: total activity this period, total last period, percentage change, and a small sparkline if recharts is available.
  - Acceptance: builds, percentage math handles divide-by-zero (show &quot;—&quot; when previous is zero).

### Phase 4 — Wiring and gating

- [ ] **Task 11: Create `InsightsTab.jsx`**
  - Props: `{ user, profile, period, onPeriodChange }`.
  - If `profile.role !== &#x27;supervisor&#x27; &amp;&amp; profile.role !== &#x27;director&#x27;` → render `InsightsEmptyState` with the &quot;supervisors only&quot; message.
  - Otherwise: call `useTeamInsights({ supervisorId: user.id, period })`. Render period tabs (copy from `Dashboard.jsx`) at the top, then a 2x2 grid of the four panels (Task 7–10). On mobile (&lt; 768px), stack vertically.
  - Loading state: show the same spinner `Dashboard.jsx` uses.
  - Error state: render the error message inside the card container.
  - Acceptance: builds, renders when accessed by Davis.

- [ ] **Task 12: Wire Insights into `Dashboard.jsx`**
  - Add `&#x27;insights&#x27;` as a valid `view` value. When `view === &#x27;insights&#x27;`, render `&lt;InsightsTab&gt;` in place of the current dashboard body.
  - Pass a callback up from `Navbar.jsx` to set the view.
  - Acceptance: clicking the Insights tab (next task) switches the body to InsightsTab.

- [ ] **Task 13: Add Insights tab to `Navbar.jsx` with role gating**
  - Next to the existing Dashboard / Activity / Settings buttons, add an Insights button.
  - Only render the button when `profile?.role === &#x27;supervisor&#x27; || profile?.role === &#x27;director&#x27;`.
  - Click handler: set `view = &#x27;insights&#x27;` via the callback from Task 12.
  - Highlight state when `view === &#x27;insights&#x27;`, matching the existing tab highlight pattern.
  - Acceptance: Davis (supervisor) sees the tab. A fake agent profile does not.

### Phase 5 — Verification

- [ ] **Task 14: Build and sanity-grep**
  - `npx vite build 2&gt;&amp;1 | tail -8` passes.
  - `grep -rn &quot;useTeamInsights&quot; src/` returns at least 2 matches (the hook file + InsightsTab).
  - `grep -rn &quot;aggregateStats&quot; src/` returns matches in both `useDashboardStats.js` AND `useTeamInsights.js` (confirming reuse).
  - `grep -rn &quot;profile?.role&quot; src/components/Navbar.jsx` returns at least 1 match (confirming role gate).
  - Bundle size check: `npx vite build` output — Insights code should be lazy-loadable. If total bundle jumped more than 80KB, wrap InsightsTab import in `React.lazy()` inside Dashboard.jsx the same way `DashboardChart` is lazy-loaded.
  - Log findings in progress.txt.

## Testing Strategy

- Primary: `npx vite build 2&gt;&amp;1 | tail -8` after every task.
- Secondary: `grep` checks noted in each task&#x27;s Acceptance line.
- There is no automated test suite. Do not add one in this task.

## Out of Scope

- Schema changes (all required schema is already in `003_teams_and_roles.sql`).
- Applying the RLS migration — write the file, Davis runs it manually.
- Team picker or supervisor-assignment UI. Team/supervisor assignments stay manual-via-SQL for now.
- Export-to-CSV, PDF, or PowerBI integration from Insights.
- Real handle time calculation from `bar_sessions` — placeholder only with TODO.
- Any change to `src/ct/` or `src/mpl/` widgets. Insights is dashboard-side only.
- Any change to `public/ct-widget.js` or the bookmarklet.
- Adding react-router.
- Introducing Tailwind or a CSS framework.
- Touching `useDashboardStats.js` beyond Task 1&#x27;s extraction.
- Deleting `platform_users.team` column. That&#x27;s a future migration after alpha stabilizes.

## Notes for Ralph

### Patterns already in the codebase

1. **Dashboard view switching:** `src/components/Dashboard.jsx` uses a local `view` state that toggles between `&#x27;dashboard&#x27;`, `&#x27;activity&#x27;`, and `&#x27;settings&#x27;`. Reuse this pattern exactly.
2. **Period tabs:** `PERIODS` array at the top of `Dashboard.jsx`. Copy the array and the tab-rendering block into `InsightsTab.jsx`. Do not extract to a shared component in this task — premature.
3. **Chart rendering:** `src/components/DashboardChart.jsx` is lazy-loaded. If you need charts, lazy-load the same way. Do NOT render `DashboardChart` eagerly.
4. **Inline style color tokens:** Every component uses a local `const C = { bg: &#x27;var(--bg-card)&#x27;, ... }` block at the top and spreads it into inline styles. Match this pattern — do not introduce a global tokens object.
5. **Supabase cancellation:** Effects that run Supabase queries use a `let cancelled = false; ... if (cancelled) return; ... return () =&gt; { cancelled = true }` pattern. `useTeamInsights` must do the same.
6. **New York timezone:** All date computation goes through `src/lib/timezone.js` (`getNewYorkDayRange`, `getNewYorkDateKey`). Do not use `Date.now().toLocaleDateString(...)` directly.

### Gotchas

7. **RLS will block supervisor queries until Task 4&#x27;s migration is applied.** If every query returns empty arrays, the issue is not the code — stop and flag it in `progress.txt`.
8. **`supervisor_teams` may be empty for a supervisor.** Handle the case gracefully — render the empty state with &quot;No teams assigned yet. Contact an administrator.&quot; instead of a blank panel.
9. **`perAgentStats` can be large** if the period is YTD and the team is big. Don&#x27;t attempt to render all rows at once if the agent count is over 50 — apply a &quot;Show all&quot; affordance. For alpha this will not trigger; it&#x27;s a safety guard.
10. **Do NOT remove the existing `useDashboardStats` hook.** Agents still need their own single-user dashboard. Task 1 refactors its internals only.
11. **The existing `Dashboard.jsx` is ~200 lines.** Keep `InsightsTab.jsx` under the same size — push panel internals into their own files.
12. **Build verification after each task.** If build breaks and the fix isn&#x27;t obvious in 5 minutes, log the error in `progress.txt` and leave the task as `[ ]` for the next iteration.

### When `perAgentStats` looks wrong

The most likely causes, in order: (1) RLS policy not applied yet (Task 4&#x27;s SQL needs running), (2) event `excluded = true` filter not being respected (RFC events should not count — check `useDashboardStats` for the `!e.excluded` pattern and mirror it), (3) MPL `created_at` vs `entry_date` — always aggregate on `created_at` server timestamps, `entry_date` is for display only.
