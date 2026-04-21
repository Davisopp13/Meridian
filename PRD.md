# Meridian Admin Panel — Phase 1 PRD

## Project Overview

The current "Admin" button in Meridian opens a single-view suggestions-review screen. This PRD expands it into a proper **four-tab Admin Panel**: **Users**, **Teams**, **Suggestions**, and **Categories**. It also reconciles a quiet schema/code drift where migration `003_teams_and_roles.sql` declares `role IN ('agent', 'supervisor', 'director')` but production actually has `('agent', 'supervisor', 'admin')` and the codebase references all four.

The outcome is that Davis (admin) can do everything he currently does via SQL through a real UI — promote James to agent when he finally gets an account, move an agent between Export Rail: SGP and Export Rail: NEM, add a new team without writing a migration, review suggestions, and edit MPL categories/subcategories that were either seeded originally or promoted from user suggestions.

Scope is additive on top of the existing `AdminTab.jsx` — the current suggestion-review UI becomes one tab of the new shell. Nothing in Insights, Feedback, Dashboard, or the MPL/CT widgets is touched.

Success looks like: Davis opens the Admin Panel, sees four tabs, clicks Users, sees every platform user with their role and team, changes an agent's team via a dropdown (write succeeds, RLS allows it), clicks Teams, adds a new Export Rail team under IDT, clicks Categories, flips an MPL subcategory's `is_active` to false, clicks Suggestions, sees the existing suggestion list unchanged. Build passes. Non-admins continue to have no access to the Admin route.

## Architecture & Key Decisions

These are locked. Ralph must not renegotiate them.

- **Framework:** Vite + React 18, existing Meridian codebase at `/Users/davis/Meridian 1.0`. No TypeScript.
- **Styling:** Inline styles only. Reuse CSS variables already defined (`--text-pri`, `--text-sec`, `--text-dim`, `--bg-card`, `--border`, `--card-bg-subtle`, `--color-mmark`). Hapag Blue `#003087`, Hapag Orange `#E8540A`, Segoe UI. Match the existing `AdminTab.jsx` aesthetic for form elements.
- **Data layer:** All Supabase access goes through `src/lib/api.js` wrappers. No direct `supabase.from(...)` calls in new components. Add new wrappers to `api.js` when needed. New wrappers return the standard `{ data, error }` shape.
- **State:** Local React state only. Tab state lives on the new `AdminTab.jsx` shell and is passed to sub-tabs as props. No URL routing or query params in this PRD.
- **Role gating:** The Admin route is admin-only. The existing `Navbar.jsx` check `profile?.role === 'admin'` for the Admin button stays. Every new sub-tab additionally guards inside itself by re-checking `profile?.role === 'admin'` and rendering "Not authorized" if false, mirroring the existing pattern in `AdminTab.jsx`.
- **Role enum:** Canonical set going forward is `('agent', 'supervisor', 'admin')`. `'director'` is dropped from the codebase. A migration reconciles the drift between migration 003's file and production.
- **RLS for admin writes:** Admins can `UPDATE` rows on `platform_users`, `teams`, `departments`, `mpl_categories`, `mpl_subcategories`. A new migration adds these policies. Non-admin writes on these tables remain blocked.
- **No teardown of existing code.** The current `AdminTab.jsx` content becomes the new `SuggestionsPanel.jsx` sub-tab, rendered inside the new tabbed shell. Do not delete `useAllSuggestions`, `SuggestionList`, `SuggestionDetailPanel`, or the "Copy all for Claude" button.
- **Migrations:** New migrations are created as files under `supabase/migrations/`. Apply is manual by Davis via the Supabase SQL Editor — Ralph does NOT run them against a live database. Ralph's only responsibility is authoring the SQL file and confirming it parses.
- **Destructive actions require confirm.** Deleting a team, deleting a department, or deactivating a category requires a `window.confirm` dialog with explicit wording of consequences. No soft-delete UI magic — destructive means destructive.
- **No new npm packages.** If a new package seems needed, stop and leave the task unchecked with a note in `progress.txt`.

## File Structure

```
src/
  components/
    AdminTab.jsx                       (modify — becomes the tabbed shell)
    admin/
      AdminTabs.jsx                    (new — 4-tab strip: Users/Teams/Suggestions/Categories)
      UsersPanel.jsx                   (new — list + inline role/team edit)
      UserRow.jsx                      (new — a single row in UsersPanel)
      TeamsPanel.jsx                   (new — department + team CRUD)
      DepartmentCard.jsx               (new — one department with its teams inside)
      TeamRow.jsx                      (new — a single team row within a department)
      AddTeamForm.jsx                  (new — inline form to add a team to a department)
      AddDepartmentForm.jsx            (new — inline form to add a new department)
      CategoriesPanel.jsx              (new — MH/CH category + subcategory edit)
      CategoryGroup.jsx                (new — one category with its subcategories)
      SubcategoryRow.jsx               (new — a single subcategory row)
      AddCategoryForm.jsx              (new — inline add)
      AddSubcategoryForm.jsx           (new — inline add, scoped to a parent category)
      SuggestionsPanel.jsx             (new — wraps the current AdminTab body as-is)
  hooks/
    useAdminUsers.js                   (new — fetch + mutate platform_users, teams, departments for admin tab)
    useAdminTeams.js                   (new — fetch + mutate teams + departments)
    useAdminCategories.js              (new — fetch + mutate mpl_categories + mpl_subcategories)
  lib/
    api.js                             (modify — add admin-facing wrappers)
supabase/
  migrations/
    010_reconcile_role_constraint.sql  (new — fixes the agent/supervisor/director → agent/supervisor/admin drift)
    011_admin_panel_rls.sql            (new — admin UPDATE/INSERT/DELETE policies for the tables above)
```

## Environment & Setup

- Ralph is working against the existing repo. All dependencies are installed.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env.local`.
- The Supabase project ref is `wluynppocsoqjdbmwass`. Live URL is `https://wluynppocsoqjdbmwass.supabase.co`. Ralph does not need to connect to it directly — all DB work is schema-authoring.
- Primary test command: `npm run build`. Must complete with zero errors. Warnings that exist in `main` today are acceptable; do not introduce new ones.
- If a task requires running migrations to verify, skip that verification — Ralph cannot apply migrations. Instead, verify the SQL file is syntactically sound by visual inspection (balanced DO blocks, no stray commas, each statement ends with `;`) and note in `progress.txt` that Davis must apply the migration manually before the UI-side tasks that depend on it can be end-to-end tested.

## Tasks

### Phase 1: Role reconciliation (migration only)

- [x] **Task 1: Create migration 010 reconciling the role CHECK constraint**
  - **What to build:** A new file `supabase/migrations/010_reconcile_role_constraint.sql` that drops the existing `platform_users_role_check` constraint and re-adds it with the canonical list `('agent', 'supervisor', 'admin')`. The migration must be idempotent — running it against production (which already has the correct constraint) should be a no-op, and running it against a fresh DB created from migrations 001–009 should end in the same state as production.
  - The migration must NOT touch migration 003's file. That file stays as historical record.
  - Include a `DO $$ ... $$` block that warns (not errors) if any `platform_users` row has a role outside `('agent', 'supervisor', 'admin')`, so Davis can see the count if there's any stray data.
  - At the end, `SELECT` a summary: count of users per role, and the current `pg_get_constraintdef` output for the constraint.
  - **Files to create:** `supabase/migrations/010_reconcile_role_constraint.sql`
  - **Acceptance:** File exists. SQL parses (no obvious syntax errors). Starts with `-- 010_reconcile_role_constraint.sql` comment header. Is idempotent (safe to run multiple times). Does not reference `'director'` anywhere except in the idempotency cleanup section (see next sentence). If the constraint currently includes `'director'`, the migration migrates any `role = 'director'` rows to `role = 'supervisor'` before swapping the constraint, then drops and re-adds. This handles both the production case (no director rows) and a hypothetical fresh-DB case (the drift has never been applied).
  - **Test:** `npm run build` (no-op — this is SQL). Manually inspect the file for the checklist in Acceptance.

- [ ] **Task 2: Purge `'director'` references from the codebase**
  - **What to build:** Remove every mention of the `'director'` role from JSX and hooks. Specifically:
    - `src/components/InsightsTab.jsx` line ~35: `profile?.role === 'supervisor' || profile?.role === 'director' || profile?.role === 'admin'` → `profile?.role === 'supervisor' || profile?.role === 'admin'`.
    - `src/components/Navbar.jsx` line ~271: same substitution.
    - Any other grep hit for the literal string `'director'`.
  - Do NOT remove `'director'` from comments explaining migration history. Only remove from active role checks.
  - **Files to modify:** `src/components/InsightsTab.jsx`, `src/components/Navbar.jsx`, and anything else `grep -rn "'director'" src/` returns.
  - **Acceptance:** `grep -rn "'director'" src/` returns zero hits. Build passes.
  - **Test:** `npm run build` + `grep -rn "'director'" src/ | wc -l` returns `0`.

### Phase 2: RLS migration for admin writes

- [ ] **Task 3: Create migration 011 adding admin write RLS policies**
  - **What to build:** A new file `supabase/migrations/011_admin_panel_rls.sql` that adds INSERT / UPDATE / DELETE policies for admins on the following tables. The policies must `USING` and `WITH CHECK` that the caller's row in `platform_users` has `role = 'admin'`, matching the pattern already used in migration `006_suggestion_box.sql` (`EXISTS (SELECT 1 FROM platform_users pu WHERE pu.id = auth.uid() AND pu.role = 'admin')`).
  - Tables and required policies:
    - `platform_users` — UPDATE (for changing role, team_id, full_name). No INSERT (users are created via auth trigger) and no DELETE. Name the policy `"admins update platform_users"`.
    - `teams` — INSERT, UPDATE, DELETE. Policies named `"admins insert teams"`, `"admins update teams"`, `"admins delete teams"`.
    - `departments` — INSERT, UPDATE, DELETE. Same naming pattern.
    - `mpl_categories` — INSERT, UPDATE (for `name`, `is_active`, `display_order`), DELETE. Same naming pattern.
    - `mpl_subcategories` — INSERT, UPDATE, DELETE. Same naming pattern.
    - `supervisor_teams` — INSERT, DELETE. For assigning/unassigning supervisors to teams. Same naming pattern.
  - Add `GRANT INSERT, UPDATE, DELETE` on each of those tables to `authenticated`, because the RLS policies gate by role on top of the grant.
  - All policies must be `CREATE POLICY IF NOT EXISTS` OR wrapped in `DROP POLICY IF EXISTS ... ; CREATE POLICY ...` so the migration is re-runnable.
  - **Files to create:** `supabase/migrations/011_admin_panel_rls.sql`
  - **Acceptance:** File exists. Every policy is scoped to `auth.uid()` having `role = 'admin'`. No policy allows non-admin writes. The file ends with a `SELECT` that lists all policies on the affected tables so Davis can visually confirm after applying.
  - **Test:** Visual inspection. `npm run build` (no-op).

### Phase 3: API wrappers

- [ ] **Task 4: Add admin user-management wrappers to `api.js`**
  - **What to build:** Add these async wrappers, all returning the Supabase `{ data, error }` shape. Each goes at the bottom of `src/lib/api.js` in a section commented `// ===== Admin Panel: users, teams, departments, categories =====`.
    - `fetchAllPlatformUsers()` — selects `id, email, full_name, role, team_id, department_id, onboarding_complete, created_at` from `platform_users` ordered by `full_name asc nulls last`. Also LEFT JOINs to get `teams!left(id, name)` so the UI can show the team name inline without a second fetch.
    - `updatePlatformUserRole({ userId, role })` — asserts `role in ['agent', 'supervisor', 'admin']` client-side (throws if not) and `UPDATE`s that row. The RLS policy from Task 3 gates the write.
    - `updatePlatformUserTeam({ userId, teamId })` — `UPDATE` the `team_id`. `teamId` of `null` is allowed and means "unassigned."
    - `updatePlatformUserName({ userId, fullName })` — for admins to fix typos in agents' `full_name`.
  - **Files to modify:** `src/lib/api.js`
  - **Acceptance:** All four wrappers exist, exported. Build passes.
  - **Test:** `npm run build`.

- [ ] **Task 5: Add admin team/department wrappers to `api.js`**
  - **What to build:** Add:
    - `fetchAllDepartmentsWithTeams()` — returns departments with their teams nested: `departments.select('id, name, teams(id, name, haulage_type, active)').order('name')`. The UI will render this hierarchically.
    - `createDepartment({ name })` — inserts a department, returns the new row.
    - `updateDepartment({ id, name })` — renames a department.
    - `deleteDepartment({ id })` — deletes. The FK on `teams.department_id` is `ON DELETE RESTRICT`, so the DB will reject deleting a department with teams. That's intentional — the UI must catch the error and show a friendly message.
    - `createTeam({ name, departmentId, haulageType })` — inserts. `haulageType` must be `'CH'` or `'MH'`.
    - `updateTeam({ id, name, active })` — toggles active or renames. The form of this call allows partial updates: if `name` is undefined, only `active` is sent, and vice versa.
    - `deleteTeam({ id })` — deletes. FK on `platform_users.team_id` is `ON DELETE SET NULL`, so users get unassigned, not deleted.
  - **Files to modify:** `src/lib/api.js`
  - **Acceptance:** All wrappers exist, exported, documented with a one-line comment describing the RLS implications where relevant. Build passes.
  - **Test:** `npm run build`.

- [ ] **Task 6: Add admin category/subcategory wrappers to `api.js`**
  - **What to build:** Add:
    - `fetchAllCategoriesForAdmin()` — returns every row in `mpl_categories` (both CH and MH, both active and inactive) with their `mpl_subcategories` nested. Ordered by `team` then `display_order`. Unlike `fetchCategoriesForTeam`, this does NOT filter by `is_active` — admins need to see deactivated ones too.
    - `createCategory({ name, team, displayOrder })` — inserts. `team` must be `'CH'` or `'MH'`. Default `displayOrder` to the next integer after the max existing one for that team.
    - `updateCategory({ id, name, isActive, displayOrder })` — partial update.
    - `deleteCategory({ id })` — deletes. The `mpl_subcategories` FK should cascade; if not, the DB will error and the UI shows the message.
    - `createSubcategory({ name, categoryId, displayOrder })` — inserts.
    - `updateSubcategory({ id, name, isActive, displayOrder })` — partial update.
    - `deleteSubcategory({ id })` — deletes.
  - **Files to modify:** `src/lib/api.js`
  - **Acceptance:** All wrappers exist, exported. Build passes.
  - **Test:** `npm run build`.

### Phase 4: Tab shell on AdminTab

- [ ] **Task 7: Create `AdminTabs.jsx` — the 4-tab strip**
  - **What to build:** A stateless presentational component that renders four pill tabs — "Users", "Teams", "Suggestions", "Categories" — matching the `tabStyle()` pattern from `src/components/InsightsTab.jsx`. Props: `{ activeTab, onTabChange }` where `activeTab` is `'users' | 'teams' | 'suggestions' | 'categories'`.
  - Active pill uses `var(--color-mmark)` (Hapag Orange). Inactive uses the muted background from the Insights tabs.
  - Count badges are optional for now. Do not add them.
  - **Files to create:** `src/components/admin/AdminTabs.jsx`
  - **Acceptance:** Component renders. Clicking a tab fires `onTabChange` with the key. Build passes.
  - **Test:** `npm run build`.

- [ ] **Task 8: Create `SuggestionsPanel.jsx` by relocating existing AdminTab body**
  - **What to build:** Create `src/components/admin/SuggestionsPanel.jsx`. Move the entire current body of `src/components/AdminTab.jsx` — the filters, counts summary, suggestion list rendering, "Copy all for Claude" button, and all associated state — into this new file.
  - Props: `{ user, profile }`.
  - Drop the top `<h2>Admin</h2>` heading — the tab shell will provide a panel heading.
  - Keep all imports intact (`useAllSuggestions`, `formatSuggestionListForClaude`, `SuggestionList`, `SuggestionDetailPanel`).
  - Keep the `if (profile?.role !== 'admin')` guard at the top.
  - **Files to create:** `src/components/admin/SuggestionsPanel.jsx`
  - **Acceptance:** File compiles on its own. The file is essentially `AdminTab.jsx`'s current logic, minus the outer `<h2>`, exported as `SuggestionsPanel`.
  - **Test:** `npm run build`.

- [ ] **Task 9: Restructure `AdminTab.jsx` to host the tabbed shell**
  - **What to build:** Rewrite `src/components/AdminTab.jsx` to be the tabbed shell. Structure:
    - `if (profile?.role !== 'admin') return <NotAuthorized />` block (reuse the existing "Not authorized. Admin access only." markup — move to a small inline helper or keep as literal JSX).
    - `const [activeTab, setActiveTab] = useState('users')` — default landing tab is Users.
    - Render a heading row: `<h2>Admin</h2>` (centered/left-aligned matching current style).
    - Render `<AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />`.
    - Below tabs, conditionally render one of four panels based on `activeTab`:
      - `'users'` → `<UsersPanel user={user} profile={profile} />`
      - `'teams'` → `<TeamsPanel user={user} profile={profile} />`
      - `'suggestions'` → `<SuggestionsPanel user={user} profile={profile} />`
      - `'categories'` → `<CategoriesPanel user={user} profile={profile} />`
    - For this task, `UsersPanel`, `TeamsPanel`, `CategoriesPanel` don't exist yet — stub them as `function UsersPanel() { return <div style={{ color: 'var(--text-sec)' }}>Coming in Task 11</div>; }` etc., imported from their files which also don't exist yet. To keep this task atomic, create placeholder files for all three panels that export a stub component.
  - **Files to modify:** `src/components/AdminTab.jsx`
  - **Files to create (stubs):** `src/components/admin/UsersPanel.jsx`, `src/components/admin/TeamsPanel.jsx`, `src/components/admin/CategoriesPanel.jsx`
  - **Acceptance:** Admin page renders with four tabs. Suggestions tab shows the existing suggestion list exactly as before (functionally unchanged). Other three tabs render "Coming in Task N" placeholders. Build passes.
  - **Test:** `npm run build`. Run `npm run dev`, log in as admin, navigate to Admin — confirm tabs render and Suggestions tab is fully functional.

### Phase 5: Users panel

- [ ] **Task 10: Build `useAdminUsers` hook**
  - **What to build:** A hook `useAdminUsers()` at `src/hooks/useAdminUsers.js` that:
    - Calls `fetchAllPlatformUsers()` on mount.
    - Returns `{ users, loading, error, refetch, updateRole, updateTeam, updateName }`.
    - `updateRole(userId, role)` calls `updatePlatformUserRole`, then optimistically updates local state on success. On error, shows the previous state and returns the error.
    - `updateTeam(userId, teamId)` likewise calls `updatePlatformUserTeam` with optimistic update.
    - `updateName(userId, fullName)` likewise calls `updatePlatformUserName`.
    - Do NOT subscribe to realtime on `platform_users` — the admin is the only writer, so local state + refetch is enough.
  - **Files to create:** `src/hooks/useAdminUsers.js`
  - **Acceptance:** Hook exists. Has the returned signature. Uses `api.js` wrappers only. Build passes.
  - **Test:** `npm run build`.

- [ ] **Task 11: Build `UsersPanel.jsx` — full implementation**
  - **What to build:** Replace the stub `src/components/admin/UsersPanel.jsx` with the real implementation:
    - Uses `useAdminUsers()` for data.
    - Loading state: centered spinner matching the Insights spinner.
    - Error state: red-tinted error message with a "Retry" button that calls `refetch`.
    - Header row: total count of users. Inline search box (client-side filter on `full_name` and `email`, case-insensitive).
    - Table/list of users. Each row is a `<UserRow>` component (Task 12). Columns visible: full_name, email, role (dropdown), team (dropdown), and a "pending onboarding" badge if `onboarding_complete === false`.
    - The current admin (`user.id`) is rendered but the role dropdown is disabled with a tooltip "You cannot change your own role." This prevents Davis from accidentally locking himself out.
  - Filters for the search box: 200ms debounce, plain `includes()` match on lowercased `full_name` and `email`.
  - **Files to modify:** `src/components/admin/UsersPanel.jsx`
  - **Acceptance:** Admin → Users renders every user. Search works. Role and team dropdowns render (changes don't have to fully write yet — that's Task 12). Self-row role dropdown is disabled. Build passes.
  - **Test:** `npm run build` + manual smoke via `npm run dev`.

- [ ] **Task 12: Build `UserRow.jsx` with inline role/team edit**
  - **What to build:** `src/components/admin/UserRow.jsx`. Props: `{ user, teams, isSelf, onUpdateRole, onUpdateTeam, onUpdateName }`.
  - Renders a row with `full_name` (clickable to edit inline), `email` (read-only), role `<select>` (values: `agent`, `supervisor`, `admin`), team `<select>` (populated from the `teams` prop — options are "Unassigned" + each team's name, value is team id or empty string for unassigned).
  - Changes write through via the `onUpdate*` callbacks from the parent, which are wired to the hook's mutators.
  - On a failed write, flash a brief red toast at the top of the row ("Failed to update role — RLS rejected.") for 3 seconds, then revert. Parent hook is responsible for the revert.
  - Role change confirm: if changing someone TO admin or FROM admin, show a `window.confirm` first ("Promote Wanda to admin? They will be able to edit all users, teams, and categories."). Other role changes don't prompt.
  - If `isSelf` is true, the role dropdown is disabled and shows a tooltip via `title` attribute.
  - Inline name edit: clicking `full_name` turns it into a small `<input>` with Enter-to-save, Escape-to-cancel.
  - **Files to create:** `src/components/admin/UserRow.jsx`
  - **Acceptance:** Row renders. Role change fires confirm for admin toggles. Team change is silent. Self-row role is locked. Build passes.
  - **Test:** `npm run build`.

### Phase 6: Teams panel

- [ ] **Task 13: Build `useAdminTeams` hook**
  - **What to build:** Hook at `src/hooks/useAdminTeams.js`:
    - Calls `fetchAllDepartmentsWithTeams()` on mount.
    - Returns `{ departments, loading, error, refetch, createDept, updateDept, deleteDept, createTeam, updateTeam, deleteTeam }`.
    - All mutators call the corresponding `api.js` wrapper and trigger a refetch on success.
    - No optimistic updates for this hook — the structure is nested enough that refetch is simpler than patching nested state.
  - **Files to create:** `src/hooks/useAdminTeams.js`
  - **Acceptance:** Hook exists with the returned signature. Build passes.
  - **Test:** `npm run build`.

- [ ] **Task 14: Build `TeamsPanel.jsx` + `DepartmentCard.jsx`**
  - **What to build:**
    - Replace stub `src/components/admin/TeamsPanel.jsx` with real implementation.
    - Renders a vertical list of `<DepartmentCard>` components, one per department.
    - Below the list, renders `<AddDepartmentForm>` (Task 16).
    - Empty state if no departments: "No departments yet. Add one below to get started."
  - `DepartmentCard.jsx` at `src/components/admin/DepartmentCard.jsx`:
    - Header: department name (inline-editable by clicking) + a delete button (trash icon).
    - Body: list of `<TeamRow>` for each team in this department.
    - Footer: `<AddTeamForm departmentId={dept.id}>` for adding a new team.
    - Delete department: `window.confirm("Delete department 'X'? This will only succeed if no teams reference it.")` — the DB will reject if teams exist, and the UI surfaces that.
  - **Files to modify:** `src/components/admin/TeamsPanel.jsx`
  - **Files to create:** `src/components/admin/DepartmentCard.jsx`
  - **Acceptance:** Teams tab shows IDT and Customer Service with their teams nested. Delete and rename controls render. Build passes.
  - **Test:** `npm run build`.

- [ ] **Task 15: Build `TeamRow.jsx` and `AddTeamForm.jsx`**
  - **What to build:**
    - `TeamRow.jsx` at `src/components/admin/TeamRow.jsx`. Shows team `name`, `haulage_type` (CH/MH), `active` toggle, delete button. Inline-editable name. Haulage type is read-only after creation (changing would scramble category fetch logic — defer to a future PRD). `active` toggle flips `active` on the team; inactive teams still exist but shouldn't be selectable in the Users panel's team dropdown (UsersPanel must filter `teams.active === true` for its dropdown, minus any team the user is currently on — edit UsersPanel to do this filter).
    - Delete: `window.confirm("Delete team 'X'? Any users currently on this team will become unassigned.")`.
    - `AddTeamForm.jsx` at `src/components/admin/AddTeamForm.jsx`. Props: `{ departmentId, onCreated }`. Inline form with `name` text input, `haulage_type` radio (CH / MH), "Add team" button. Validates name length > 2 before submit.
  - Update `UsersPanel.jsx` (and `UserRow.jsx` if needed) so its team dropdown filters out `active === false` teams EXCEPT the user's currently-assigned team (so a user assigned to a now-inactive team can still be reassigned off it).
  - **Files to create:** `src/components/admin/TeamRow.jsx`, `src/components/admin/AddTeamForm.jsx`
  - **Files to modify:** `src/components/admin/UsersPanel.jsx` and/or `src/components/admin/UserRow.jsx`
  - **Acceptance:** Can add, rename, deactivate, and delete teams via UI. Users panel correctly filters inactive teams. Build passes.
  - **Test:** `npm run build`.

- [ ] **Task 16: Build `AddDepartmentForm.jsx`**
  - **What to build:** `src/components/admin/AddDepartmentForm.jsx`. Small inline form with a `name` text input + "Add department" button. Validates length > 2. On success, fires `onCreated` from parent (which calls `refetch`).
  - **Files to create:** `src/components/admin/AddDepartmentForm.jsx`
  - **Acceptance:** Can add a new department. Appears immediately in the list. Build passes.
  - **Test:** `npm run build`.

### Phase 7: Categories panel

- [ ] **Task 17: Build `useAdminCategories` hook**
  - **What to build:** Hook at `src/hooks/useAdminCategories.js`:
    - Calls `fetchAllCategoriesForAdmin()` on mount.
    - Returns `{ categories, loading, error, refetch, createCat, updateCat, deleteCat, createSub, updateSub, deleteSub }`.
    - Categories are grouped by `team` ('CH' vs 'MH') in the returned shape, for easier rendering. The hook can compute `{ mh: [], ch: [] }` from the flat list returned by the API wrapper.
    - All mutators call the corresponding `api.js` wrapper and trigger a refetch on success.
  - **Files to create:** `src/hooks/useAdminCategories.js`
  - **Acceptance:** Hook exists. Build passes.
  - **Test:** `npm run build`.

- [ ] **Task 18: Build `CategoriesPanel.jsx` + `CategoryGroup.jsx`**
  - **What to build:**
    - Replace stub `src/components/admin/CategoriesPanel.jsx` with real implementation.
    - Two sections side-by-side on wide viewports (stacked on narrow): "Merchant Haulage (MH)" and "Carrier Haulage (CH)".
    - Each section renders a list of `<CategoryGroup>` components for its team's categories, plus an `<AddCategoryForm team="MH" />` / `<AddCategoryForm team="CH" />` at the bottom.
    - Inactive categories render with `opacity: 0.5` and a small "Inactive" label.
  - `CategoryGroup.jsx` at `src/components/admin/CategoryGroup.jsx`:
    - Header: category name (inline-editable), `display_order` (numeric input, small), `is_active` toggle, delete button.
    - Body: list of `<SubcategoryRow>` components (Task 19) + an `<AddSubcategoryForm categoryId={cat.id}>` at the bottom.
    - Delete: `window.confirm("Delete category 'X'? All subcategories under it will also be deleted.")`.
  - **Files to modify:** `src/components/admin/CategoriesPanel.jsx`
  - **Files to create:** `src/components/admin/CategoryGroup.jsx`
  - **Acceptance:** Categories tab shows both MH and CH trees. Can rename a category, reorder, toggle active, delete. Build passes.
  - **Test:** `npm run build`.

- [ ] **Task 19: Build `SubcategoryRow.jsx`, `AddCategoryForm.jsx`, `AddSubcategoryForm.jsx`**
  - **What to build:**
    - `SubcategoryRow.jsx` — one subcategory with inline-editable name, `display_order` input, `is_active` toggle, delete button. Delete confirm: `"Delete subcategory 'X'? MPL entries historically logged against this subcategory will retain their foreign-key reference and continue to appear in reports."` (Only true if the FK is `ON DELETE SET NULL` or similar — check the actual FK in 001_initial_schema before finalizing the confirm message. If the FK is `ON DELETE CASCADE`, change the message to reflect that.)
    - `AddCategoryForm.jsx` — props `{ team, onCreated }`. Form: `name` input, "Add category" button. `display_order` auto-assigned (max + 1) by the hook.
    - `AddSubcategoryForm.jsx` — props `{ categoryId, onCreated }`. Form: `name` input, "Add subcategory" button. `display_order` auto-assigned.
  - **Files to create:** `src/components/admin/SubcategoryRow.jsx`, `src/components/admin/AddCategoryForm.jsx`, `src/components/admin/AddSubcategoryForm.jsx`
  - **Acceptance:** Full CRUD on categories and subcategories works end-to-end through the UI (assuming migrations 010 and 011 are applied). Build passes.
  - **Test:** `npm run build`.

### Phase 8: Polish & verification

- [ ] **Task 20: Verify the Suggestions tab is unchanged functionally**
  - **What to build:** A verification pass. Run `npm run dev`, sign in as admin, navigate to Admin → Suggestions, confirm: the filters dropdown works, the list populates, clicking a row opens the detail panel, the "Copy all for Claude" button copies text to clipboard, status changes write successfully.
  - If anything is broken, fix it now. The most likely bug is a missed import path after the move.
  - **Files to modify:** As needed.
  - **Acceptance:** Manual smoke test passes.
  - **Test:** `npm run build` + `npm run dev` manual verification logged in `progress.txt`.

- [ ] **Task 21: Add progress.txt entries documenting manual-apply migrations**
  - **What to build:** Append to `progress.txt`:
    ```
    Admin Panel Phase 1 — manual steps for Davis after Ralph completes:

    1. Apply migration 010_reconcile_role_constraint.sql in Supabase SQL Editor.
       Expected: no-op in production (constraint already matches), summary shows
       role counts (agent, supervisor, admin).

    2. Apply migration 011_admin_panel_rls.sql in Supabase SQL Editor.
       Expected: policies created on platform_users, teams, departments,
       mpl_categories, mpl_subcategories, supervisor_teams. Summary lists them.

    3. Smoke test: sign in as Davis (admin), open Admin panel. Confirm:
       - Users tab lists all ~16 alpha users.
       - Teams tab shows IDT and Customer Service with Export Rail SGP + NEM
         under IDT.
       - Categories tab shows MH categories (CH currently empty — expected).
       - Suggestions tab works identically to before.

    4. Smoke test: sign in as Wanda or Carlos (non-admin). Confirm the Admin
       button is NOT visible in the navbar.

    Known limitation: no audit log of admin writes. Added to backlog.
    ```
  - **Files to modify:** `progress.txt`
  - **Acceptance:** Entries present at end of file.
  - **Test:** `cat progress.txt | tail -30`.

- [ ] **Task 22: Final build + commit summary**
  - **What to build:** Run `npm run build`. Ensure zero errors. Append a final section to `progress.txt` listing every file created/modified with a one-line summary of what changed.
  - **Acceptance:** `npm run build` clean. Summary present.
  - **Test:** `npm run build`.

## Testing Strategy

- Primary: `npm run build` after every task. If a task's test command says "`npm run build`", that is the single criterion for passing.
- Secondary: `npm run dev` manual smoke tests for Tasks 9, 11, 14, 18, 20. Log results in `progress.txt`.
- Migrations are NOT applied by Ralph. They are authored, syntax-checked via visual inspection, and flagged in `progress.txt` for Davis to apply manually.
- No automated test framework is currently set up for this project. If one is added later, revisit.

## Out of Scope

Ralph must NOT do any of the following. They are intentionally excluded and will be handled in future PRDs:

- **No audit log.** Admin writes are not recorded to a log table in this phase.
- **No supervisor-teams junction editing UI.** Assigning supervisors to teams is done via SQL for now. The RLS policy from Task 3 allows it, and a UI will come in a later PRD.
- **No bulk operations.** No "promote all users from this team to supervisor" kind of batch. One row at a time.
- **No CSV import/export.** No "upload a CSV to add 30 users."
- **No email invites / new account creation.** Users still sign up via the existing auth flow. Admins cannot create accounts.
- **No password resets or MFA management.** Auth administration stays in Supabase Auth UI.
- **No deletion of platform_users.** If someone leaves the company, their row stays for historical attribution.
- **No RFC configuration UI.** That surface is deferred. `case_events.excluded` remains dormant dead code for now.
- **No feature flags table or UI.** Deferred.
- **No changes to the Insights tab, Feedback tab, Dashboard, MPL widget, or CT widget.** This PRD is Admin-only.
- **No new npm packages.** If a task seems to need one, stop and leave it unchecked.
- **No TypeScript conversion.** The project is plain JSX; stay there.
- **No changes to the bookmarklet, relay iframe, or PiP windows.**
- **No React Router or URL-based tab state.** In-memory tab state only.

## Notes for Ralph

Patterns already in this codebase that you should follow:

- **Guard at the top of admin-only components.** Every admin sub-panel begins with:
  ```jsx
  if (profile?.role !== 'admin') {
    return <NotAuthorized />;
  }
  ```
  This mirrors the existing `src/components/AdminTab.jsx`. Don't skip it in sub-panels — RLS is the real guard, but UI-level guards prevent wasted fetches and surface errors clearly.

- **`full_name` not `display_name`.** The column is `full_name`. Patched across the codebase in a prior track. Don't re-introduce `display_name`.

- **API wrappers return `{ data, error }`.** Every wrapper in `src/lib/api.js` returns the Supabase shape. New wrappers must match. Components check `if (error) { ... }` and never rely on try/catch for Supabase errors.

- **Theme tokens.** Use CSS variables. Available: `--text-pri`, `--text-sec`, `--text-dim`, `--bg-card`, `--bg-deep`, `--border`, `--card-bg-subtle`, `--dash-bg`, `--dash-card`, `--dash-border`, `--color-mbtn` (blue), `--color-mmark` (orange), `--divider`.

- **Inline styles only.** No CSS files, no style props imported from elsewhere. Follow the pattern in `AdminTab.jsx` where styles are declared at the top of the component as constants.

- **Error surfacing.** Supabase errors (RLS rejections, constraint violations) should show user-friendly text, not raw `error.message`. A pattern: `error.message?.includes('row-level security') ? 'You do not have permission.' : error.message || 'Unknown error.'`. Don't swallow errors silently.

- **Confirms for destructive actions.** Use plain `window.confirm`. No custom modal library. Phrasing should state the consequence explicitly ("Delete team 'X'? Users on this team will become unassigned.").

- **PiP / widget context.** Admin Panel is a host-page-only feature. It never renders inside the PiP window. No PiP-specific gotchas apply. Use React hooks and inline styles normally.

- **Migration re-applicability.** Both new migrations must be idempotent. Wrap constraint adds in `DROP CONSTRAINT IF EXISTS`. Wrap policies in `DROP POLICY IF EXISTS ... ; CREATE POLICY ...`. Wrap seed data in `ON CONFLICT DO NOTHING`. The file should be safe to run twice.

- **When uncertain, stop.** If a task is ambiguous, leave it unchecked and log the ambiguity in `progress.txt`. Do not invent behavior. Davis will clarify in the morning.
