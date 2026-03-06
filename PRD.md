# Meridian Schema Alignment PRD

## Project Overview
Align the existing Meridian PiP Bar codebase with the canonical Supabase schema (meridian-migration-v2.sql + meridian-supplement.sql). The app is a Vite + React 18 project using `@supabase/supabase-js`. Every Supabase query in the codebase references old table/column names that no longer exist. This PRD maps every mismatch and provides atomic tasks to fix them without changing any UI behavior or visual design.

## Architecture & Key Decisions
- **Framework:** Vite + React 18 (no router — single-page app)
- **Database:** Supabase (Postgres) with RLS
- **Styling:** Inline styles only — no Tailwind, no CSS modules. DO NOT change any styles.
- **Auth:** Supabase email/password auth (not magic link)
- **PiP:** Document Picture-in-Picture API (Chrome/Edge 116+)
- **State:** React useState/useRef only — no Redux, no Zustand
- **Key pattern:** App.jsx manages all state and passes props/callbacks to PipBar and child components. PipBar is rendered into the PiP window via ReactDOM.createRoot.

## Environment & Setup
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env.local`
- `VITE_APP_URL` is set for bookmarklet host resolution
- Node 18+, npm
- The canonical schema is already deployed to Supabase — DO NOT run any migrations

## Complete Table Name Mapping

Old table → New table:
| Old (in code) | New (canonical) | Notes |
|---|---|---|
| `case_sessions` | `ct_cases` | Same concept, different name + new columns |
| `case_events` | `case_events` | **KEPT** — added via supplement migration, references `ct_cases` |
| `process_sessions` | `mpl_entries` | Fundamentally different columns |
| `process_categories` | `mpl_categories` | Different columns, normalized subcategories |
| `bar_sessions` | `bar_sessions` | **KEPT** — added via supplement migration, same structure |
| `profiles` | `platform_users` | Different column names |
| `teams` | *(removed)* | Team is a column on `platform_users`, not a separate table |
| `pending_triggers` | `pending_triggers` | Already correct in code |

## Complete Column Mapping

### ct_cases (was case_sessions)
| Old column | New column | Notes |
|---|---|---|
| `id` | `id` | Same |
| `user_id` | `user_id` | Same, but now FK → platform_users (not auth.users) |
| `case_number` | `case_number` | Same |
| *(missing)* | `case_type` | New — text, nullable |
| *(missing)* | `case_subtype` | New — text, nullable |
| `started_at` | `started_at` | Same |
| `ended_at` | `ended_at` | Same |
| `duration_s` | `duration_s` | Same |
| `status` | `status` | Same — 'active' / 'awaiting' / 'closed' |
| `awaiting_since` | `awaiting_since` | Same |
| *(missing)* | `resolution` | New — 'resolved' / 'reclassified' / 'abandoned' — nullable |
| *(missing)* | `is_rfc` | New — boolean default false |
| *(missing)* | `notes` | New — text nullable |
| *(missing)* | `source` | New — 'pip' / 'manual' default 'pip' |
| *(missing)* | `entry_date` | New — date default CURRENT_DATE |
| *(missing)* | `created_at` | New — timestamptz |
| *(missing)* | `updated_at` | New — timestamptz, auto-updated |
| `account_id` | *(dropped)* | Was on case_sessions in some versions, now on pending_triggers only |

### case_events (KEPT — same structure)
| Column | Notes |
|---|---|
| `id` | Same |
| `session_id` | FK → `ct_cases.id` (was → case_sessions.id) |
| `user_id` | FK → `platform_users.id` |
| `type` | Same — 'resolved' / 'reclassified' / 'call' / 'rfc' / 'not_a_case' |
| `excluded` | Same — boolean |
| `rfc` | Same — boolean |
| `timestamp` | Same — timestamptz |

### mpl_entries (was process_sessions)
| Old column | New column | Notes |
|---|---|---|
| `id` | `id` | Same |
| `user_id` | `user_id` | Same |
| `category` (text) | `category_id` (uuid FK) | **BREAKING** — now FK to mpl_categories |
| `subcategory` (text) | `subcategory_id` (uuid FK) | **BREAKING** — now FK to mpl_subcategories, NOT NULL |
| `duration_s` | *(dropped)* | Use `minutes` (integer) instead |
| `logged_at` | *(dropped)* | Use `created_at` instead |
| `entry_mode` | *(dropped)* | Use `source` ('main_app' / 'quick_log' / 'pip') instead |
| *(missing)* | `minutes` | New — integer NOT NULL, CHECK > 0 |
| *(missing)* | `entry_date` | New — date default CURRENT_DATE |
| *(missing)* | `notes` | New — text nullable |
| *(missing)* | `source` | New — 'main_app' / 'quick_log' / 'pip' |
| *(missing)* | `created_at` | New — timestamptz |
| *(missing)* | `updated_at` | New — auto |

### mpl_categories (was process_categories)
| Old column | New column | Notes |
|---|---|---|
| `id` | `id` | Same |
| `name` | `name` | Same |
| `team` | `team` | Same — 'CH' / 'MH' |
| `sort_order` | `display_order` | Renamed |
| `active` | `is_active` | Renamed |

### mpl_subcategories (NEW — did not exist before)
| Column | Notes |
|---|---|
| `id` | uuid PK |
| `category_id` | FK → mpl_categories |
| `name` | text |
| `display_order` | integer |
| `is_active` | boolean |

### platform_users (was profiles / user_profiles)
| Old column | New column | Notes |
|---|---|---|
| `id` | `id` | Same |
| `email` | `email` | Same |
| `full_name` | `full_name` | Same |
| `team_id` (FK→teams) | `team` (text 'CH'/'MH') | **BREAKING** — no more teams table |
| `onboarded` | `onboarding_complete` | Renamed |
| *(missing)* | `preferred_mode` | New — 'ct' / 'mpl' |
| *(missing)* | `invite_code_used` | New |
| *(missing)* | `role` | New — 'agent' / 'supervisor' / 'admin' |
| *(missing)* | `supervisor_id` | New — FK self-reference |
| *(missing)* | `is_active` | New |
| *(missing)* | `last_active_at` | New |
| *(missing)* | `created_at` | New |
| *(missing)* | `updated_at` | New |

### bar_sessions (KEPT — same structure)
No changes needed. Already matches.

### pending_triggers (already correct)
No changes needed. Code already uses correct table/column names.

## Tasks

### Phase 1: Supabase Query Layer — Rename All Table References

- [x] **Task 1: Rename case_sessions → ct_cases in App.jsx**
  - What: Find every `supabase.from('case_sessions')` call in `src/App.jsx` and replace with `supabase.from('ct_cases')`
  - Also update insert payloads to include new columns: `case_type`, `case_subtype`, `source: 'pip'`, `entry_date` (use `new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })` for YYYY-MM-DD)
  - The `handleCaseStart` function already receives `caseType` and `caseSubtype` from the bookmarklet — pass them through to the insert
  - When closing a case (handleCloseCase, handleRFCYes, handleRFCNo, handleNotACase), also set `resolution` on `ct_cases`:
    - handleRFCYes: set `resolution: 'resolved'` and `is_rfc: true`
    - handleRFCNo: set `resolution: 'resolved'` and `is_rfc: false`
    - handleNotACase: set `resolution: 'abandoned'`
    - handleCloseCase: set `resolution: null` (no resolution — closed manually)
  - DO NOT change any state management, timer logic, or UI rendering
  - Files: `src/App.jsx`
  - Test: `npm run build` completes without errors

- [x] **Task 2: Rename case_sessions → ct_cases in case_events references**
  - What: The `case_events` table's `session_id` column still references `ct_cases.id`. No code change needed for the FK itself (Supabase handles it), but verify that every `case_events` insert in App.jsx uses the correct session ID from the `ct_cases` insert response
  - This is a verification task — read through all `case_events` inserts and confirm `session_id` is set from the `ct_cases` row ID. If it already is, mark done.
  - Files: `src/App.jsx` (read-only verification, fix if needed)
  - Test: `npm run build`

- [ ] **Task 3: Rename process_sessions → mpl_entries in useStats.js**
  - What: In `src/hooks/useStats.js`, replace `supabase.from('process_sessions')` with `supabase.from('mpl_entries')`
  - Change the select from `.select('id', { count: 'exact', head: true })` to `.select('id', { count: 'exact', head: true })`
  - Change filter column from `logged_at` to `created_at`
  - Files: `src/hooks/useStats.js`
  - Test: `npm run build`

- [ ] **Task 4: Rename process_sessions → mpl_entries in useDashboardStats.js**
  - What: In `src/hooks/useDashboardStats.js`, replace `supabase.from('process_sessions')` with `supabase.from('mpl_entries')`
  - Change `.select('logged_at, duration_s, category')` to `.select('created_at, minutes, category_id')`
  - Change filter column from `logged_at` to `created_at`
  - In the grouping loop, change `p.logged_at` to `p.created_at` for the `getNYDateStr()` call
  - Files: `src/hooks/useDashboardStats.js`
  - Test: `npm run build`

- [ ] **Task 5: Update mpl_entries insert in App.jsx (handlePickerConfirm and handleConfirmProcess)**
  - What: The two functions that write process data currently don't exist as `mpl_entries` inserts — they already write to `mpl_entries`. Verify these inserts match the schema:
    - Required columns: `user_id`, `category_id`, `subcategory_id` (NOT NULL), `minutes`, `source`
    - `minutes` should be `Math.round(durationSeconds / 60) || 1` (already done)
    - `source` should be `'pip'` (already done)
    - Verify `subcategory_id` is always passed and never null
  - Files: `src/App.jsx`
  - Test: `npm run build`

- [ ] **Task 6: Rename profiles → platform_users in App.jsx auth flow**
  - What: In the `useEffect` that fetches the user profile on auth, replace:
    - `supabase.from('platform_users')` — this may already be correct. Check and verify.
    - The `.select('*')` call should work since `platform_users` has all needed columns
  - Also check: `profile.onboarding_complete` — the old schema used `profile.onboarded`. Verify the code uses `onboarding_complete` (matches canonical schema)
  - Also check: `profile.team` — old schema used `profile.team_id` (FK to teams table). New schema has `profile.team` as text ('CH'/'MH'). Verify the code accesses `profile.team` not `profile.team_id`
  - Files: `src/App.jsx`
  - Test: `npm run build`

### Phase 2: Onboarding Flow — Remove teams Table Dependency

- [ ] **Task 7: Rewrite Onboarding.jsx to use platform_users directly**
  - What: The current `handleComplete()` in `src/components/Onboarding.jsx`:
    1. Queries `supabase.from('teams')` to find team ID — **DELETE THIS**, teams table doesn't exist
    2. Updates `supabase.from('profiles')` with `team_id` — **CHANGE** to `supabase.from('platform_users')` with `team` (text value directly)
    3. Sets `onboarded: true` — **CHANGE** to `onboarding_complete: true`
  - New handleComplete should be:
    ```js
    const { data: updatedProfile } = await supabase
      .from('platform_users')
      .update({
        full_name: formData.full_name,
        team: formData.team,  // 'CH' or 'MH' directly
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('*')
      .single()
    onComplete(updatedProfile)
    ```
  - Files: `src/components/Onboarding.jsx`
  - Test: `npm run build`

- [ ] **Task 8: Update SignUp.jsx — remove profiles reference**
  - What: In `src/components/auth/SignUp.jsx`, after signup the code does:
    ```js
    await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', data.user.id)
    ```
    Change to:
    ```js
    await supabase.from('platform_users').update({ full_name: fullName.trim() }).eq('id', data.user.id)
    ```
    Note: The `handle_new_user()` trigger auto-creates the `platform_users` row on signup, so this update will find the row.
  - Files: `src/components/auth/SignUp.jsx`
  - Test: `npm run build`

### Phase 3: Category Fetch — Verify Normalized Model

- [ ] **Task 9: Verify mpl_categories fetch uses normalized join**
  - What: In `src/App.jsx`, the category fetch already does:
    ```js
    supabase
      .from('mpl_categories')
      .select('id, name, team, display_order, mpl_subcategories(id, name, display_order)')
    ```
    Verify this is correct — it should work because `mpl_subcategories` has a FK `category_id` to `mpl_categories`, and PostgREST auto-detects the relation.
  - Also verify: the `.eq('is_active', true)` filter is present (matches canonical column name)
  - Also verify: the `.order('display_order')` calls are present for both tables
  - **Auto-select logic**: When a category has exactly 1 subcategory, the UI should auto-select it. This is a UI concern handled by ProcessPicker and ProcessLaneRow — verify those components check `(selectedCategory.mpl_subcategories || []).length === 1` and auto-select if so. If they don't, add the auto-select:
    - In `ProcessPicker.jsx`: after `handleSelectCat(cat)`, check if `cat.mpl_subcategories.length === 1` and if so, immediately call `setSelectedSub(cat.mpl_subcategories[0])`
    - In `ProcessLaneRow.jsx`: after `handleSelectCategory(cat)`, check if `(cat.mpl_subcategories || []).length === 1` and if so, immediately call `setSelectedSubcategory(cat.mpl_subcategories[0])`
  - Files: `src/App.jsx`, `src/components/overlays/ProcessPicker.jsx`, `src/components/ProcessLaneRow.jsx`
  - Test: `npm run build`

### Phase 4: Remove Stale Migration File

- [ ] **Task 10: Replace old migration with schema reference comment**
  - What: Delete the contents of `supabase/migrations/001_initial_schema.sql` and replace with:
    ```sql
    -- ============================================================
    -- STALE — DO NOT RUN
    -- The canonical schema is deployed via meridian-migration-v2.sql
    -- + meridian-supplement.sql (case_events, bar_sessions)
    -- This file is kept for git history only.
    -- ============================================================
    ```
  - Files: `supabase/migrations/001_initial_schema.sql`
  - Test: `npm run build`

### Phase 5: Dashboard Stats — Fix Remaining Query Issues

- [ ] **Task 11: Fix useDashboardStats category display**
  - What: The dashboard `dailyRows` grouping currently tracks process count but doesn't show category names. This is fine for now — processes are just counted. But verify that the `procs` query works with the new schema:
    - Old: `.select('logged_at, duration_s, category')` from `process_sessions`
    - New: `.select('created_at, minutes, category_id')` from `mpl_entries`
    - The grouping by date uses `getNYDateStr(p.created_at)` — verify this works
  - If the old code references `p.logged_at` anywhere else in the file, change to `p.created_at`
  - Files: `src/hooks/useDashboardStats.js`
  - Test: `npm run build`

### Phase 6: Smoke Test — Full Build Verification

- [ ] **Task 12: Full build and import verification**
  - What: Run `npm run build` and verify zero errors. Then do a grep across `src/` for any remaining references to old table names:
    ```bash
    grep -rn "from('case_sessions')" src/
    grep -rn "from('process_sessions')" src/
    grep -rn "from('process_categories')" src/
    grep -rn "from('profiles')" src/
    grep -rn "from('teams')" src/
    grep -rn "\.onboarded" src/
    grep -rn "team_id" src/
    grep -rn "logged_at" src/
    ```
    If any of these return results, fix them according to the mapping table above.
  - Files: All `src/` files
  - Test: `npm run build` + all grep commands return empty

## Testing Strategy
- Primary: `npm run build` (Vite production build — catches import errors, syntax errors, undefined references)
- Secondary: grep for stale table/column names (see Task 12)
- Note: There are no unit tests in this project. Build passing is the verification gate.

## Out of Scope
- **DO NOT** change any UI components, styles, colors, layouts, or visual behavior
- **DO NOT** modify the bookmarklet, relay, or trigger files (`public/meridian-relay.html`, `public/meridian-trigger.js`, `BOOKMARKLET.md`)
- **DO NOT** run any SQL migrations — the schema is already deployed
- **DO NOT** add new features, new components, or new hooks
- **DO NOT** refactor state management patterns or component structure
- **DO NOT** change auth flow (sign in, sign up, magic link) — only fix table references
- **DO NOT** modify `src/lib/supabase.js`, `src/lib/constants.js`, `src/index.css`, `vite.config.js`
- **DO NOT** add TypeScript, ESLint, or any new dev dependencies
- **DO NOT** touch `package.json` or `package-lock.json`

## Notes for Ralph
- This codebase uses **inline styles everywhere** — no CSS classes, no Tailwind. Don't add any.
- `App.jsx` is the god component — all state lives there, all Supabase calls happen there (or in hooks). Components are pure UI.
- The PiP bar is rendered into a separate browser window via `window.documentPictureInPicture`. The `pipRootRef` holds a React root that re-renders on every state change. Don't try to optimize this — it works.
- `case_events` is deliberately kept as a separate table (not flattened into `ct_cases`) because a single case session can have multiple events: resolve, then RFC check, plus calls logged during the session.
- When closing a case, the code should BOTH insert a `case_events` row AND update the `ct_cases` row's `resolution`/`is_rfc` fields. The events table is the audit trail; the case row's resolution is the summary.
- The `pending_triggers` Realtime subscription in `usePendingTriggers.js` is already correct — it references the right table and columns. Don't touch it.
- `mpl_entries.subcategory_id` is NOT NULL in the schema. Every process log MUST include a subcategory. The UI should auto-select when a category has exactly one subcategory.
- The relay iframe in `public/meridian-relay.html` contains hardcoded Supabase credentials (anon key). These are for the NEW Supabase project. DO NOT change them.
- `entry_date` on `ct_cases` and `mpl_entries` should use America/New_York timezone for the date boundary: `new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })` gives YYYY-MM-DD format.
