# Meridian Insights — 3-Tab Restructure PRD

## Project Overview

Meridian Insights is currently a single-page supervisor dashboard with four stacked panels. This PRD restructures Insights into a **three-tab interface** modeled on the CT 1.0 pattern — **Overview**, **Activity Log**, and **Reports** — and adds a team filter, a clickable-agent-name interaction, and a generalized multi-agent Activity Log that reuses the existing `ActivityLog` component.

The result: one Insights surface, three purpose-built tabs. Each tab answers a different question a supervisor walks up with.

- **Overview** — "how's my team doing?" (the existing four panels, plus a team filter and clickable agent names)
- **Activity Log** — "what has Wanda actually been working on?" (new tab; reuses `ActivityLog.jsx` generalized to multiple users)
- **Reports** — "I need a specific number for the staff meeting" (scaffolded only — renders a clean empty state; real reports ship in a later PRD)

Scope is additive. The personal Activity Log on the home Dashboard is untouched. No existing panels are removed. No schema changes.

Success looks like: Davis (supervisor) opens Insights, sees three tabs, can filter Overview to one team, clicks Wanda's name on Overview, lands on Activity Log pre-filtered to Wanda, scans her last 20 events, tabs to Reports, sees a "Coming soon" empty state. Build passes. Personal Dashboard still works identically for every user.

## Architecture & Key Decisions

These decisions are locked. Ralph must not renegotiate them.

- **Framework:** Vite + React 18, existing Meridian codebase at `/Users/davis/Meridian 1.0`.
- **Data layer:** All Supabase access goes through `src/lib/api.js` wrappers. No direct `supabase.from(...)` calls in new components. Add new wrappers to `api.js` when needed.
- **State:** Local React state only. No new state management library. Tab state + filter state live on `InsightsTab.jsx` and are passed down as props.
- **URL state:** No query params or routing changes in this PRD. Tab and filter state is in-memory only. A future PRD can add `?tab=activity&agent=<id>` deep-linking if needed.
- **Component reuse:** The Insights Activity Log **reuses** `src/components/ActivityLog.jsx`. Do not create a parallel component. Generalize `ActivityLog` and `useActivityData` to accept an array of user IDs in addition to the existing single-user signature. Agents continue to call it the current way with zero visual or behavioral change.
- **Role gating:** Existing logic. Insights tab is only rendered when `profile.role === 'supervisor' || 'director' || 'admin'`. Already enforced in `InsightsTab.jsx` and `Navbar.jsx`. No changes to role logic.
- **Styling:** CSS variables from the existing theme. Hapag Blue `#003087`, Hapag Orange `#E8540A`, Segoe UI. Match the styling patterns in `InsightsTab.jsx` — period tabs, dark cards, existing `tabStyle()` function.
- **No schema changes.** No migrations. No new tables. This is a pure UI + hook generalization PRD.
- **Mutations stay single-user.** The existing `ActivityLog` lets an agent edit or delete their own entries. When rendered in multi-user mode on Insights, those mutation buttons must be hidden or disabled. Supervisors do not edit teammates' logs through the Activity Log.

## File Structure

```
src/
  components/
    InsightsTab.jsx                    (modify — add tab shell, passes filter state)
    ActivityLog.jsx                    (modify — accept userIds, hide mutations in multi-user)
    insights/
      InsightsTabs.jsx                 (new — the 3-tab strip)
      OverviewTab.jsx                  (new — wraps existing 4 panels + team filter)
      ActivityLogTab.jsx               (new — wraps ActivityLog with agent filter)
      ReportsTab.jsx                   (new — empty-state scaffold)
      AgentFilterStrip.jsx             (new — chip row of agent names)
      TeamFilterDropdown.jsx           (new — supervisor's assigned teams)
      AgentHandleTimePanel.jsx         (modify — clickable agent names)
  hooks/
    useActivityData.js                 (modify — accept userIds)
    useTeamInsights.js                 (modify — expose raw events + accept teamId filter)
  lib/
    api.js                             (modify — add wrapper if needed)
```

## Environment & Setup

- Ralph is working against the existing repo. All dependencies are installed.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env.local`.
- No new npm packages required. Do not run `npm install` for new packages. If a new package seems needed, stop and leave the task unchecked with a note in `progress.txt`.
- Primary test command: `npm run build`. Must complete with zero errors. Warnings that exist in `main` today are acceptable; do not introduce new ones.

## Tasks

### Phase 1: Generalize ActivityLog to multi-user

- [x] **Task 1: Generalize `useActivityData` to accept `userIds` array**
  - **What to build:** Change the hook signature from `useActivityData({ userId, rangeDays })` to `useActivityData({ userIds, rangeDays })`. For backward compatibility, also accept `userId` as a string and internally normalize to `userIds = [userId]`. Detect: if `userId` is a non-empty string and `userIds` is missing, use `[userId]`. If both are passed, prefer `userIds`.
  - In the fetch queries at the existing `.eq('user_id', userId)` call sites (two of them), change to `.in('user_id', userIds)`.
  - In the realtime channel subscription, change the filter from `user_id=eq.${userId}` to `user_id=in.(${userIds.join(',')})`. Channel name should become `activity-${userIds.join('-').slice(0, 50)}-${rangeDays}` (slice to cap length).
  - In the mutation paths (`editEntry`, `deleteEntry`, the RFC/exclusion toggles), preserve existing behavior — they still operate on a single row by `id`, and the `.eq('user_id', ...)` guard should use the entry's own `user_id` not the hook's input. If that means reading `entry.user_id` off the entry instead of from the hook scope, do that. These mutations must only succeed when the caller is the entry's owner; keep the existing guard pattern.
  - Update the dependency arrays in the `useEffect` / `useCallback` hooks from `[userId, ...]` to `[userIds.join(','), ...]` so array identity doesn't cause infinite re-fetches. Memoize `userIdsKey = userIds.join(',')` once at the top and use that in deps.
  - **Files to modify:** `src/hooks/useActivityData.js`
  - **Acceptance:** Hook accepts either `{ userId }` or `{ userIds }` and returns correct data. Existing call sites (`<ActivityLog userId={user.id} />`) continue to work. Build passes. `grep -n "useActivityData" src/` shows the existing agent call site still compiles.
  - **Test:** `npm run build` completes with zero errors.

- [x] **Task 2: Add `allowMutations` prop to `ActivityLog`**
  - **What to build:** Add an optional prop `allowMutations` (boolean, default `true`) to `ActivityLog`. When `false`, hide or disable any edit/delete buttons, RFC toggles, and exclusion toggles on rendered rows. The personal Dashboard call site passes nothing and gets the default (mutations allowed). The Insights call site will pass `allowMutations={false}`.
  - Locate all interactive elements in `ActivityLog.jsx` that call `editEntry`, `deleteEntry`, RFC toggle, exclusion toggle, or similar mutations. Wrap them in `{allowMutations && ...}` or set `disabled` + add a muted tooltip "View only".
  - **Files to modify:** `src/components/ActivityLog.jsx`
  - **Acceptance:** `<ActivityLog userId={...} />` renders identically to today. `<ActivityLog userIds={[...]} allowMutations={false} />` renders rows without mutation UI. Build passes.
  - **Test:** `npm run build`.

- [x] **Task 3: Accept `userIds` on `ActivityLog` and forward to hook**
  - **What to build:** Update `ActivityLog`'s signature from `({ userId })` to `({ userId, userIds, allowMutations = true })`. Forward both `userId` and `userIds` to `useActivityData`. The hook (from Task 1) already handles the normalization.
  - **Files to modify:** `src/components/ActivityLog.jsx`
  - **Acceptance:** `<ActivityLog userIds={['uuid-a', 'uuid-b']} allowMutations={false} />` compiles and renders events from both users merged chronologically.
  - **Test:** `npm run build`.

### Phase 2: Tab shell on Insights

- [x] **Task 4: Create `InsightsTabs.jsx` — the 3-tab strip**
  - **What to build:** A stateless presentational component that renders three pill tabs — "Overview", "Activity Log", "Reports" — matching the existing `tabStyle()` pattern from `InsightsTab.jsx`. Props: `{ activeTab, onTabChange }` where `activeTab` is `'overview' | 'activity' | 'reports'`.
  - Use the same `var(--color-mmark)` for the active pill, same `tabStyle` shape. Tabs sit directly under the period selector on Insights.
  - **Files to create:** `src/components/insights/InsightsTabs.jsx`
  - **Acceptance:** Component renders. Clicking a tab fires `onTabChange` with the key. Build passes.
  - **Test:** `npm run build`.

- [x] **Task 5: Restructure `InsightsTab.jsx` to host tabs**
  - **What to build:** Add `const [activeTab, setActiveTab] = useState('overview')` to `InsightsTab`. Render `<InsightsTabs activeTab={activeTab} onTabChange={setActiveTab} />` directly under the period selector row. Below the tabs, conditionally render one of three tab-body components based on `activeTab`:
    - `'overview'` → `<OverviewTab insights={insights} prevInsights={prevInsights} onAgentClick={handleAgentClick} selectedTeamId={selectedTeamId} onTeamChange={setSelectedTeamId} />`
    - `'activity'` → `<ActivityLogTab agents={insights.agents} selectedAgentId={activityAgentFilter} onAgentChange={setActivityAgentFilter} />`
    - `'reports'` → `<ReportsTab />`
  - Add new state: `selectedTeamId` (string or `null` for "all teams"), `activityAgentFilter` (string or `null`).
  - Add handler `handleAgentClick(agentId)` that sets `activityAgentFilter = agentId` and `activeTab = 'activity'`. This is the click-from-Overview-jumps-to-Activity-Log behavior.
  - Move the existing four-panel render block into the new `OverviewTab` component (Task 6); after this task, `InsightsTab.jsx` should no longer render panels directly.
  - **Files to modify:** `src/components/InsightsTab.jsx`
  - **Acceptance:** Insights page renders with three tabs. Overview tab shows the existing 4 panels. Other two tabs render placeholder text (real bodies land in later tasks). Build passes.
  - **Test:** `npm run build`. Run `npm run dev`, log in, navigate to Insights — confirm tabs render and Overview shows the existing 4 panels.

### Phase 3: Overview enhancements

- [x] **Task 6: Create `OverviewTab.jsx` wrapping existing panels**
  - **What to build:** Move the existing panel-render block from `InsightsTab.jsx` into `src/components/insights/OverviewTab.jsx`. Props: `{ insights, prevInsights, onAgentClick, selectedTeamId, onTeamChange }`.
  - At the top of the tab body, render a row with `<TeamFilterDropdown teams={insights.teams} selectedTeamId={selectedTeamId} onChange={onTeamChange} />` on the left.
  - Filter the agents passed to child panels: if `selectedTeamId` is set, filter `insights.agents` and `insights.perAgentStats` to that team before handing to panels. If `null` (All Teams), pass through unchanged.
  - Pass `onAgentClick` down to `AgentHandleTimePanel` for the name-click interaction.
  - **Files to create:** `src/components/insights/OverviewTab.jsx`
  - **Acceptance:** Overview tab renders the 4 panels exactly as before. Team filter dropdown appears at the top. Build passes.
  - **Test:** `npm run build`.

- [x] **Task 7: Create `TeamFilterDropdown.jsx`**
  - **What to build:** A `<select>` styled to match the period selector aesthetic. Props: `{ teams, selectedTeamId, onChange }`. First option is "All teams" with value `''` (empty). Subsequent options are each team's `name` with value `id`. Use inline styles matching the existing Admin filters (`SELECT_STYLE` pattern in `AdminTab.jsx`) adapted for the dark Insights background.
  - **Files to create:** `src/components/insights/TeamFilterDropdown.jsx`
  - **Acceptance:** Dropdown renders. Selecting a team fires `onChange(teamId)`. Selecting "All teams" fires `onChange(null)`. Build passes.
  - **Test:** `npm run build`.

- [x] **Task 8: Make agent names clickable in `AgentHandleTimePanel`**
  - **What to build:** Locate the agent name render at approximately line 133 of `src/components/insights/AgentHandleTimePanel.jsx` (`{agent?.full_name || agent?.email || agentId}`). Wrap it in a `<button>` with link-style appearance — no background, Hapag Orange (`#E8540A`) text on hover, underline on hover, cursor pointer. Accept a new optional prop `onAgentClick(agentId)` and call it on click. If `onAgentClick` is not provided, render as plain text (current behavior).
  - **Files to modify:** `src/components/insights/AgentHandleTimePanel.jsx`
  - **Acceptance:** When `onAgentClick` is passed, agent names are clickable. When it's not, they render as before. Build passes.
  - **Test:** `npm run build`.

### Phase 4: Activity Log tab

- [ ] **Task 9: Create `AgentFilterStrip.jsx`**
  - **What to build:** A horizontal chip row above or at the top of the Activity Log body. First chip is "All agents" (active when `selectedAgentId === null`). Subsequent chips are each agent's first name + last initial (e.g., "Wanda K.") with the agent's full name as the `title` tooltip. Active chip uses Hapag Orange background; inactive chips match the existing dark-theme chip style in `ActivityLog.jsx`.
  - Props: `{ agents, selectedAgentId, onChange }`. `agents` is the array from `insights.agents`.
  - If there are more than ~8 agents, let the row wrap to a second line. Do not add a horizontal scroller in v1.
  - **Files to create:** `src/components/insights/AgentFilterStrip.jsx`
  - **Acceptance:** Strip renders with one chip per agent plus "All agents". Clicking a chip fires `onChange(agentId)`. Clicking "All agents" fires `onChange(null)`. Active state highlights correctly. Build passes.
  - **Test:** `npm run build`.

- [ ] **Task 10: Create `ActivityLogTab.jsx`**
  - **What to build:** Tab body for the Activity Log. Props: `{ agents, selectedAgentId, onAgentChange }`.
  - Renders, top to bottom:
    1. `<AgentFilterStrip agents={agents} selectedAgentId={selectedAgentId} onChange={onAgentChange} />`
    2. `<ActivityLog userIds={userIdsForLog} allowMutations={false} />`
  - `userIdsForLog` is computed: if `selectedAgentId` is null, pass every agent's ID from `agents`. If set, pass `[selectedAgentId]`.
  - If `agents` is empty (e.g., supervisor assigned no teams), render an empty state: "No agents on your teams yet. Add team members via Admin."
  - **Files to create:** `src/components/insights/ActivityLogTab.jsx`
  - **Acceptance:** Tab renders the agent filter strip over the existing `ActivityLog`. Selecting an agent narrows the log. Selecting "All agents" shows the full team feed. Mutation UI is hidden. Build passes.
  - **Test:** `npm run build`. Run `npm run dev`, log in as Davis, navigate to Insights → Activity Log, verify multiple agents' events appear and the filter strip narrows them.

- [ ] **Task 11: Wire click-through from Overview to Activity Log**
  - **What to build:** In `InsightsTab.jsx` (already modified in Task 5), confirm `handleAgentClick(agentId)` is wired. Verify that clicking an agent name in the Overview's `AgentHandleTimePanel` sets `activityAgentFilter = agentId` and `activeTab = 'activity'`.
  - Smoke-check: clicking an agent on Overview should land the user on the Activity Log tab with that agent's chip highlighted in `AgentFilterStrip` and only their events showing.
  - **Files to modify:** `src/components/InsightsTab.jsx` (may already be done in Task 5 — if so, mark complete after verification)
  - **Acceptance:** End-to-end click works. Build passes.
  - **Test:** `npm run build` + manual verification in `npm run dev`.

### Phase 5: Reports scaffold

- [ ] **Task 12: Create `ReportsTab.jsx`**
  - **What to build:** Minimal empty-state tab body. Renders a centered block with:
    - A neutral icon (use a simple inline SVG — a bar chart or document — not an emoji, ~48px, Hapag Blue `#003087` with reduced opacity)
    - Heading: "Reports are coming soon"
    - Subcopy: "Saved reports will let you answer specific questions — handle time by category, re-resolves by agent, MPL time breakdowns — and export to CSV."
    - No interactive elements.
  - **Files to create:** `src/components/insights/ReportsTab.jsx`
  - **Acceptance:** Reports tab renders the empty-state block. Build passes.
  - **Test:** `npm run build`.

### Phase 6: Documentation

- [ ] **Task 13: Update `AGENTS.md`**
  - **What to build:** Add a new subsection under "Insights Tab" titled "Three-tab structure" that documents:
    - The three tabs (Overview / Activity Log / Reports) and what each answers
    - The `ActivityLog` multi-user signature (`userIds` array + `allowMutations` prop)
    - The click-from-Overview-to-Activity-Log pattern (tab switch + filter carryover)
    - That personal Activity Log on the Dashboard is unchanged
    - That Reports is scaffold-only in this iteration
  - **Files to modify:** `AGENTS.md`
  - **Acceptance:** Documentation is accurate and ≤ 30 added lines.
  - **Test:** none required beyond Ralph reading the file back to itself to confirm it was written.

## Testing Strategy

- **Primary:** `npm run build` after every task. Zero new errors. No new warnings beyond what's in `main`.
- **Manual smoke (after Task 11):**
  1. Log in as Davis (supervisor). Navigate to Insights.
  2. Confirm three tabs render: Overview, Activity Log, Reports.
  3. Overview tab: confirm the 4 panels render. Team filter dropdown appears. Selecting a team narrows the panels. "All teams" resets.
  4. Click an agent's name in the Agent Handle Time panel. Confirm the page switches to the Activity Log tab with that agent's chip selected and their events showing.
  5. Agent filter strip: click "All agents" — full team feed returns. Click another agent — feed narrows.
  6. Mutation UI (edit/delete buttons, RFC toggle) should be absent or disabled in the Insights Activity Log. Spot-check one row.
  7. Reports tab: confirm "Coming soon" empty state renders.
  8. Log out. Log in as an agent account (or any non-supervisor). Confirm:
     - Personal Activity Log on the home Dashboard works identically to before
     - Insights tab is not visible in nav

## Out of Scope

Do not do any of the following in this PRD. If something seems to require it, leave the task unchecked and log a note in `progress.txt`.

- No URL/routing changes. No `?tab=...` or `?agent=...` query params.
- No real Reports. Reports tab is a scaffold only.
- No schema migrations, new tables, or new columns.
- No changes to the personal Activity Log on the home Dashboard.
- No changes to role logic or authorization.
- No changes to how `supervisor_teams` or `platform_users` are populated.
- No edit/delete/RFC-toggle functionality for supervisors on teammates' entries.
- No mobile-specific styling beyond existing responsiveness.
- No new npm packages.
- No deprecation of the existing 4 panels. They move into OverviewTab intact.
- No streak badges, no rank indicators, no "vs team average" callouts.
- No changes to `useTeamInsights`'s return shape except what's explicitly called for in tasks.
- Do not "improve" or refactor files not listed in Task's "Files to modify" block.

## Notes for Ralph

- **The personal Activity Log is sacred.** Every agent uses it daily. If a change to `ActivityLog.jsx` or `useActivityData.js` breaks the existing single-user call site, that is a production regression. Test the single-user path after every task that touches these files. The single-user path is: `<ActivityLog userId={user.id} />` — passing `userId` as a string with no `userIds` prop.
- **`MOCK_ENTRIES` in `ActivityLog.jsx`** is a dev fallback. Do not delete it. Do not re-enable it. Leave it alone.
- **Existing warnings in the build are acceptable.** Don't introduce new ones. If a lint rule fires on new code, fix the new code, don't disable the rule.
- **CSS variables are defined at the Dashboard level.** New components inside Insights can assume `var(--text-pri)`, `var(--text-sec)`, `var(--bg-card)`, `var(--border)`, `var(--color-mmark)` are available. No need to redeclare.
- **The `agents` array from `useTeamInsights`** has the shape `[{ id, full_name, email, team_id, team_name }]`. Use `full_name` (not `display_name` — that column does not exist; see prior learnings).
- **Hapag Orange is `#E8540A`. Hapag Blue is `#003087`.** Do not use any other accent colors.
- **Segoe UI is the font stack.** Do not introduce a new font.
- **When in doubt, match the patterns already in `InsightsTab.jsx`.** Period tab styling, card spacing, max-width 1200px, and the dark card backgrounds are all there to copy.
- **Phase order matters.** Phase 1 generalizes `ActivityLog`. Phase 2 installs the tab shell. Phase 3 enhances Overview. Phase 4 builds the Activity Log tab on top of Phase 1. Phase 5 is Reports scaffold. Phase 6 is docs. Do not reorder.
- **If a task fails a test, leave the checkbox empty and log what failed in `progress.txt`.** Do not try to "make it green" by weakening the test.
- **If a task seems ambiguous, do the simpler, smaller version.** Ask forgiveness in `progress.txt` rather than building something elaborate that wasn't asked for.
