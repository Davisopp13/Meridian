# Meridian — Tree 5: Settings Dashboard PRD

## Project Overview

Add a Settings page to the Meridian Dashboard (host tab) that lets users configure their PiP widget behavior. Settings are stored as a JSONB column on `platform_users` and read by the PiP widget on launch. This is a Vite + React 18 app with Supabase backend. Success = users can configure stat buttons, Total formula, PiP position, team assignment, theme, and notification preferences from the Dashboard, and the PiP widget respects those settings.

## Architecture & Key Decisions

- **Framework:** Vite + React 18, no TypeScript, inline styles for PiP components, CSS-in-JS for Dashboard components
- **Data model:** Single `settings` JSONB column added to `platform_users` table. No new tables.
- **Default values:** App provides sensible defaults when `settings` is null (new users or pre-existing users who haven't visited Settings yet). Defaults are defined in a single `DEFAULT_SETTINGS` constant.
- **Settings flow:** Dashboard Settings page reads/writes `platform_users.settings`. PiP widget reads `profile.settings` from the profile state already loaded in App.jsx. No realtime subscription needed — settings only take effect on next PiP launch or page refresh.
- **Design:** Dark theme matching the existing Dashboard. Segoe UI font. Grouped sections with clear labels. Save button per section or a single global Save.

## Environment & Setup

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in `.env.local`
- Supabase SQL Editor access needed for the migration (Task 1)
- No new npm dependencies

## Settings Schema

```js
// DEFAULT_SETTINGS — defined in src/lib/constants.js
export const DEFAULT_SETTINGS = {
  stat_buttons: ['resolved', 'reclass', 'calls', 'processes', 'total'],
  total_includes: ['resolved', 'reclass', 'calls'],
  pip_position: 'bottom-right',   // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  team: null,                      // 'CH' | 'MH' — null means use profile.team
  theme: 'dark',                   // 'dark' only for now (future: 'light' | 'auto')
  notifications: {
    toast_on_log: true,            // show confirmation toast after logging
    sound: false,                  // play sound on bookmarklet trigger
  },
}
```

### Available stat button keys:
| Key | Label | Color token | Stat source |
|-----|-------|-------------|-------------|
| `resolved` | `✓ N Resolved` | `C.resolved` | `stats.resolved` |
| `reclass` | `↩ N Reclass` | `C.reclass` | `stats.reclass` |
| `calls` | `☎ N Calls` | `C.calls` | `stats.calls` |
| `processes` | `📋 N Processes` | `C.processNavy` | `stats.processes` |
| `total` | `N Total` | `C.process` | computed from `total_includes` |

## Tasks

### Phase 1: Database Migration

- [x] **Task 1: Add settings column to platform_users**
  - What to build: Write a SQL migration that adds a `settings` JSONB column to `platform_users` with a default value of `null`. Do NOT set a default JSON value in the column — the app handles defaults in code.
  - SQL:
    ```sql
    ALTER TABLE platform_users
    ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT NULL;
    ```
  - Files to create: `supabase/migrations/002_user_settings.sql`
  - Acceptance criteria: Migration file exists and SQL is valid. Column is nullable JSONB.
  - Test command: `npm run build` (no JS changes)
  - **NOTE:** This migration must be run manually in Supabase SQL Editor before testing Tasks 3+.

### Phase 2: Settings Constants & Helper

- [x] **Task 2: Add DEFAULT_SETTINGS and helper to constants.js**
  - What to build: Add the `DEFAULT_SETTINGS` export and a `getUserSettings(profile)` helper function to `src/lib/constants.js`. The helper merges the user's stored settings with defaults so any missing keys get filled in. This prevents crashes when new settings are added in the future.
  - Code:
    ```js
    export const DEFAULT_SETTINGS = {
      stat_buttons: ['resolved', 'reclass', 'calls', 'processes', 'total'],
      total_includes: ['resolved', 'reclass', 'calls'],
      pip_position: 'bottom-right',
      team: null,
      theme: 'dark',
      notifications: {
        toast_on_log: true,
        sound: false,
      },
    }

    export function getUserSettings(profile) {
      const stored = profile?.settings || {}
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        notifications: {
          ...DEFAULT_SETTINGS.notifications,
          ...(stored.notifications || {}),
        },
      }
    }
    ```
  - Files to modify: `src/lib/constants.js`
  - Acceptance criteria: `DEFAULT_SETTINGS` and `getUserSettings` are exported. Existing `C`, `SIZES`, and `formatElapsed` exports are untouched.
  - Test command: `npm run build` completes with 0 errors

### Phase 3: Settings Page UI

- [x] **Task 3: Create SettingsPage component**
  - What to build: Create `src/components/SettingsPage.jsx`. This is a full-page settings form rendered in the Dashboard host tab. It reads the current user's settings from the `profile` prop, shows controls for each setting group, and writes updates back to `platform_users.settings` via Supabase.
  - **Layout:** Single column, dark background (`#0f1117`), sections separated by subtle dividers. Each section has a heading, description, and controls.
  - **Section 1 — Stat Buttons:** Checkbox list of the 5 available stat buttons. User can toggle each on/off. Minimum 1 must remain selected. Order matches the order in the `stat_buttons` array.
  - **Section 2 — Total Formula:** Only shown if `total` is in the selected stat buttons. Checkbox list of which stats contribute to Total. At least 1 must be checked.
  - **Section 3 — PiP Position:** 4-option radio group with a visual mini-diagram showing screen corners. Options: bottom-right (default), bottom-left, top-right, top-left.
  - **Section 4 — Team Assignment:** Radio group: CH or MH. Pre-filled from `profile.team`. Changing this also updates `profile.team` (not just settings).
  - **Section 5 — Theme:** Radio group: Dark (default). Light and Auto are shown but disabled with a "Coming soon" badge.
  - **Section 6 — Notifications:** Two toggle switches: "Show confirmation toast after logging" (default on), "Play sound on bookmarklet trigger" (default off).
  - **Save behavior:** Single "Save Settings" button at bottom. On click, writes the full settings JSON to `platform_users.settings` for the current user. Shows a success toast on save. If team changed, also updates `platform_users.team`.
  - **Styling:** Inline styles. Dark theme tokens from `C` constant. Consistent with existing Dashboard design. Font: Segoe UI. Section headings: 14px bold, white. Descriptions: 11px, `C.textSec`. Controls: dark backgrounds with subtle borders, orange accent for selected states.
  - Files to create: `src/components/SettingsPage.jsx`
  - Acceptance criteria: Component renders all 6 sections with working controls. Save writes to Supabase. Build passes.
  - Test command: `npm run build` completes with 0 errors

- [x] **Task 4: Add Settings route to Dashboard**
  - What to build: In `src/components/Dashboard.jsx`, add a "Settings" link/button to the navigation (likely in `Navbar.jsx`). When clicked, render `SettingsPage` instead of the default dashboard content. Use a simple state toggle (`view: 'dashboard' | 'settings'`) — no router needed.
  - Files to modify: `src/components/Dashboard.jsx`, `src/components/Navbar.jsx`
  - Acceptance criteria: Navbar shows a Settings gear icon or link. Clicking it shows the SettingsPage. Clicking back or the dashboard link returns to the main dashboard view.
  - Test command: `npm run build` completes with 0 errors

### Phase 4: Wire Settings to PiP Widget

- [x] **Task 5: Read settings in App.jsx and pass to PipBar**
  - What to build: In `src/App.jsx`, import `getUserSettings` from constants. Derive `userSettings` from `profile` using `getUserSettings(profile)`. Pass `userSettings` as a prop to the `buildPipBar()` function and through to `PipBar`. This is prop threading — no new state needed, just derived from the existing `profile` state.
  - Files to modify: `src/App.jsx`
  - Acceptance criteria: `PipBar` receives a `userSettings` prop containing the merged settings object. Build passes.
  - Test command: `npm run build` completes with 0 errors

- [ ] **Task 6: PipBar renders configurable stat buttons**
  - What to build: In `src/PipBar.jsx`, replace the hardcoded 5 `StatButton` components with a dynamic rendering based on `userSettings.stat_buttons`. Create a `STAT_BUTTON_CONFIG` map that defines each button's label template, color, and stat key:
    ```js
    const STAT_BUTTON_CONFIG = {
      resolved:  { icon: '✓', label: 'Resolved', color: C.resolved, key: 'resolved' },
      reclass:   { icon: '↩', label: 'Reclass',  color: C.reclass,  key: 'reclass' },
      calls:     { icon: '☎', label: 'Calls',     color: C.calls,    key: 'calls' },
      processes: { icon: '📋', label: 'Processes', color: C.processNavy, key: 'processes' },
      total:     { icon: '',  label: 'Total',     color: C.process,  key: null }, // computed
    }
    ```
    For the `total` button, compute the value by summing whichever stats are in `userSettings.total_includes`. Render only the buttons listed in `userSettings.stat_buttons`, in order.
  - Files to modify: `src/PipBar.jsx`
  - Acceptance criteria: Bar renders only the stat buttons the user has enabled, in their configured order. Total computes from the configured formula. If settings are null/default, behavior is identical to the 5-button hardcoded layout.
  - Test command: `npm run build` completes with 0 errors

- [ ] **Task 7: Apply pip_position setting in usePipWindow**
  - What to build: In `src/hooks/usePipWindow.js`, the `resizeAndPin` function uses `moveTo()` to position the PiP window. Currently it always pins to bottom-right. Update it to read the `pip_position` value from the settings passed through. Add a `position` parameter to `resizeAndPin(mode, position)` that defaults to `'bottom-right'`. Calculate the `moveTo` x/y based on the position:
    - `bottom-right`: `x = screen.availWidth - width`, `y = screen.availHeight - height`
    - `bottom-left`: `x = 0`, `y = screen.availHeight - height`
    - `top-right`: `x = screen.availWidth - width`, `y = 0`
    - `top-left`: `x = 0`, `y = 0`
  - In `App.jsx`, pass `userSettings.pip_position` as the second argument to all `resizeAndPin` calls.
  - Files to modify: `src/hooks/usePipWindow.js`, `src/App.jsx`
  - Acceptance criteria: PiP window positions to the correct screen corner based on settings. Default is bottom-right (no regression from current behavior).
  - Test command: `npm run build` completes with 0 errors

### Phase 5: Update Documentation

- [ ] **Task 8: Update AGENTS.md with settings architecture**
  - What to build: Add a new section to `AGENTS.md` documenting the settings system: the `DEFAULT_SETTINGS` constant, the `getUserSettings` helper, the `platform_users.settings` JSONB column, and the `STAT_BUTTON_CONFIG` map in PipBar. Include the available stat button keys and the pip_position options.
  - Files to modify: `AGENTS.md`
  - Acceptance criteria: AGENTS.md has a "User Settings" section with accurate documentation of the settings system.
  - Test command: `npm run build` (no code change)

## Testing Strategy

- Primary: `npm run build` completes with 0 errors for every task
- Migration: Run `002_user_settings.sql` in Supabase SQL Editor before testing Tasks 3+
- Visual: After all tasks, verify in `npm run dev`:
  1. Settings page renders in Dashboard
  2. Toggling stat buttons off removes them from the PiP bar
  3. Changing Total formula changes the Total count
  4. Changing PiP position moves the widget to the correct corner
  5. Settings persist across page refresh

## Out of Scope

- Theme switching (UI exists but Dark is the only functional option)
- Sound notifications (toggle exists but audio playback is future work)
- Drag-to-reorder stat buttons (future enhancement)
- Settings sync across devices (implicit via Supabase — already works)
- PiP-inline settings (all settings are Dashboard-only)

## Notes for Ralph

- The `profile` object is already loaded in `App.jsx` from `platform_users` and passed around. Adding `.settings` to it requires no new queries — the existing `select('*')` already fetches all columns.
- `C.processNavy` is `var(--color-process-navy)` which resolves to `rgba(0,48,135,0.4)`. This may be too transparent for a stat button background on its own. If it looks washed out, use `#003087` (solid Hapag Blue) instead.
- The Navbar component in `src/components/Navbar.jsx` already has navigation items. Add Settings as a gear icon or text link in the same style.
- When the `total` button computes its value, it should use `userSettings.total_includes` to decide which stats to sum. Example: if `total_includes` is `['resolved', 'calls']`, Total = `stats.resolved + stats.calls`.
- The team setting in Section 4 does double duty: it updates both `settings.team` and `platform_users.team` (the top-level column). This is because `profile.team` is used throughout the app for category filtering, not `settings.team`. The settings value is a convenience so the Settings page can manage it in one place.
