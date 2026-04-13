# Meridian — Light Mode PRD

## Project Overview

Add a toggleable light mode to Meridian. The PiP widget and Dashboard currently use a dark theme hardcoded in CSS variables and inline styles. This PRD adds a full light token set, wires the existing Theme toggle in `SettingsPage.jsx` to persist the user's preference to `platform_users.settings`, and makes the PiP widget and Dashboard both react to that preference. Success = agents can switch between dark and light mode from Settings, the widget and dashboard both reflect the chosen theme, and the preference persists across sessions and page reloads.

## Architecture & Key Decisions

- **Framework:** Vite + React 18, no TypeScript, inline styles for PiP components
- **Database:** Supabase (`platform_users` table has a `settings` JSONB column)
- **Theme storage:** `platform_users.settings.theme` — values `'dark'` | `'light'`. Default is `'dark'` when null/missing
- **CSS token injection:** All PiP window styles live in `src/hooks/usePipWindow.js` inside a `style.textContent` block. The `:root` block must be swapped at PiP open time based on current theme preference
- **Dashboard theming:** Dashboard components use hardcoded dark colors in inline styles. Add a `data-theme="light"` attribute to `document.documentElement` and apply CSS overrides via a `<style>` tag injected into the host page `<head>` for light mode
- **Realtime:** No realtime needed — theme change takes effect on next PiP launch and on save (trigger a full re-render by flipping a context value)
- **State:** Theme preference flows from `profile.settings.theme` (loaded in `App.jsx`) → React context → consumed by `usePipWindow.js` and `Dashboard.jsx`
- **Design constraint:** Hapag Blue `#003087`, Hapag Orange `#E8540A` stay as accents in both themes. Light mode is white/light-gray surfaces with dark text — NOT inverted brand colors

## File Structure (files to touch)

```
src/
  context/
    ThemeContext.jsx          ← NEW: provides { theme, setTheme }
  hooks/
    usePipWindow.js           ← MODIFY: inject theme-appropriate token block
  components/
    SettingsPage.jsx          ← MODIFY: wire Theme section, remove disabled state
    Dashboard.jsx             ← MODIFY: consume ThemeContext, apply light class
  App.jsx                     ← MODIFY: wrap with ThemeProvider, pass initial theme from profile
```

## Token Reference

### Dark token block (current — already in usePipWindow.js)
```css
:root {
  --bg-body:        #0f1117;
  --bg-card:        rgba(255,255,255,0.05);
  --card-bg-subtle: rgba(255,255,255,0.03);
  --text-pri:       rgba(255,255,255,0.92);
  --text-sec:       rgba(255,255,255,0.55);
  --text-dim:       rgba(255,255,255,0.30);
  --divider:        rgba(255,255,255,0.08);
  --border:         rgba(255,255,255,0.10);
  --shadow-subtle:  none;
  --case-focus:     rgba(0,48,135,0.25);
  --case-border:    rgba(0,48,135,0.5);
  --row-focus:      rgba(255,255,255,0.04);
  --amber-row:      rgba(217,119,6,0.15);
  /* accent tokens stay the same in both themes */
  --color-mbtn:     #003087;
  --color-mmark:    #E8540A;
  --color-resolved: #22c55e;
  --color-reclass:  #ef4444;
  --color-calls:    #3b82f6;
  --color-process:  #64748b;
  --color-awaiting: #f59e0b;
  --color-active-dot: #4ade80;
}
body { background: #0f1117; }
```

### Light token block (NEW — to be injected when theme === 'light')
```css
:root {
  --bg-body:        #f1f5f9;
  --bg-card:        #ffffff;
  --card-bg-subtle: rgba(0,0,0,0.03);
  --text-pri:       #0f172a;
  --text-sec:       #475569;
  --text-dim:       #94a3b8;
  --divider:        rgba(0,0,0,0.08);
  --border:         rgba(0,0,0,0.10);
  --shadow-subtle:  0 1px 4px rgba(0,0,0,0.08);
  --case-focus:     rgba(0,48,135,0.07);
  --case-border:    rgba(0,48,135,0.20);
  --row-focus:      rgba(0,0,0,0.04);
  --amber-row:      rgba(217,119,6,0.08);
  /* accent tokens — same as dark */
  --color-mbtn:     #003087;
  --color-mmark:    #E8540A;
  --color-resolved: #22c55e;
  --color-reclass:  #ef4444;
  --color-calls:    #3b82f6;
  --color-process:  #64748b;
  --color-awaiting: #f59e0b;
  --color-active-dot: #4ade80;
}
body { background: #f1f5f9; }
```

### Dashboard light mode CSS overrides (injected into host page head)
```css
/* Applied when data-theme="light" on <html> */
[data-theme="light"] {
  --dash-bg:        #f1f5f9;
  --dash-card:      #ffffff;
  --dash-border:    rgba(0,0,0,0.08);
  --dash-text-pri:  #0f172a;
  --dash-text-sec:  #475569;
  --dash-text-dim:  #94a3b8;
}
[data-theme="dark"] {
  --dash-bg:        #0f1117;
  --dash-card:      rgba(255,255,255,0.05);
  --dash-border:    rgba(255,255,255,0.08);
  --dash-text-pri:  rgba(255,255,255,0.92);
  --dash-text-sec:  rgba(255,255,255,0.55);
  --dash-text-dim:  rgba(255,255,255,0.30);
}
```

**NOTE:** Dashboard components already use `background: '#0f1117'` and similar hardcoded hex values as inline styles. Rather than refactoring all inline styles (which Ralph should NOT do in this PRD — that's a separate cleanup task), Ralph should instead identify the **page-level background and main card containers** in `Dashboard.jsx` and `SettingsPage.jsx` and switch them to `var(--dash-bg)` / `var(--dash-card)` etc. Deep component-level style refactoring is out of scope.

## Environment & Setup

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are already set in `.env`
- Supabase client is at `src/lib/supabaseClient.js` (or `src/supabaseClient.js` — check)
- `platform_users.settings` column already exists as JSONB (was added in earlier sprint)
- If `settings` column does NOT exist, Ralph should add the migration: `ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;`

## Tasks

### Phase 1: Theme Context

- [x] **Task 1: Create ThemeContext**
  - What to build: Create `src/context/ThemeContext.jsx`. Export `ThemeProvider` component and `useTheme` hook. Provider accepts `initialTheme` prop (string `'dark'` | `'light'`, defaults to `'dark'` if null/undefined). Internally holds `theme` state. Exposes `{ theme, setTheme }` via context. Also inject the dashboard CSS custom property block into `document.head` on mount — a `<style id="meridian-theme-vars">` tag containing both `[data-theme="dark"]` and `[data-theme="light"]` variable blocks from the Token Reference section above. When `theme` changes, update `document.documentElement.dataset.theme` to match.
  - Files to create: `src/context/ThemeContext.jsx`
  - Acceptance criteria: File created, exports `ThemeProvider` and `useTheme`, no build errors
  - Test command: `npx vite build 2>&1 | tail -8`

- [x] **Task 2: Wrap App with ThemeProvider**
  - What to build: In `src/App.jsx`, import `ThemeProvider` from `./context/ThemeContext`. Find where `profile` state is set after Supabase auth loads. Extract `initialTheme` as `profile?.settings?.theme ?? 'dark'`. Wrap the entire JSX return (or at minimum the authenticated routes) with `<ThemeProvider initialTheme={initialTheme}>`. Make sure ThemeProvider wraps all routes that include `Dashboard`, `SettingsPage`, and the PiP widget trigger.
  - Files to modify: `src/App.jsx`
  - Acceptance criteria: App compiles, ThemeProvider wraps authenticated UI, no runtime errors
  - Test command: `npx vite build 2>&1 | tail -8`

### Phase 2: PiP Widget Theme

- [x] **Task 3: Theme-aware token injection in usePipWindow**
  - What to build: In `src/hooks/usePipWindow.js`, find the `openPip` function (or equivalent) that builds the `style.textContent` string injected into the PiP window `<head>`. The hook must accept a `theme` parameter (string). Add a helper function `buildThemeTokens(theme)` that returns the appropriate `:root { ... }` block + `body { background: ... }` line from the Token Reference section. Inside the style block, replace the current hardcoded `:root` block with a call to `buildThemeTokens(theme)`. Export or accept `theme` via props/argument — whichever pattern already exists in the hook. If the hook currently takes no arguments, add `theme = 'dark'` as a destructured prop from the options object.
  - Files to modify: `src/hooks/usePipWindow.js`
  - Acceptance criteria: `buildThemeTokens('dark')` returns a string containing `--bg-body: #0f1117`, `buildThemeTokens('light')` returns a string containing `--bg-body: #f1f5f9`. Build passes.
  - Test command: `npx vite build 2>&1 | tail -8`

- [x] **Task 4: Pass theme to usePipWindow from PipBar or App**
  - What to build: Find where `usePipWindow` is called (likely `src/PipBar.jsx` or `src/App.jsx`). Import `useTheme` from `../context/ThemeContext`. Get `theme` from `useTheme()`. Pass `theme` into the hook call. If `usePipWindow` is called as `usePipWindow({ ... })`, add `theme` to the options object. If called differently, adapt accordingly — but do NOT restructure the hook signature beyond adding one parameter.
  - Files to modify: `src/PipBar.jsx` (or wherever usePipWindow is called)
  - Acceptance criteria: Theme value flows from context into hook, build passes
  - Test command: `npx vite build 2>&1 | tail -8`

### Phase 3: Settings Page Wiring

- [x] **Task 5: Un-disable and wire the Theme section in SettingsPage**
  - What to build: In `src/components/SettingsPage.jsx`, find the Theme section (section 05). It currently has `opacity: 0.4; cursor: not-allowed` or similar disabled styling on the Light option — remove all disabled state. The section should show two cards: "Dark" and "Light" with visual previews. For Dark: a small rounded div with `background: #1a1a2e`. For Light: a small rounded div with `background: #f1f5f9; border: 1px solid rgba(0,0,0,0.1)`. Wire the selection: clicking a card calls `setTheme(value)` from `useTheme()`. The currently active card gets a highlighted border (`border: 2px solid #E8540A`). Save the preference to Supabase: on theme card click, immediately call `supabase.from('platform_users').update({ settings: { ...existingSettings, theme: value } }).eq('user_id', user.id)`. Show a brief inline "Saved" confirmation. Do NOT add a separate save button for this section — save on click like a radio button.
  - Files to modify: `src/components/SettingsPage.jsx`
  - Acceptance criteria: Both theme cards visible and clickable, no disabled styling, `useTheme` consumed, Supabase update fires on click, build passes
  - Test command: `npx vite build 2>&1 | tail -8`

### Phase 4: Dashboard Surface Theming

- [ ] **Task 6: Apply theme CSS vars to Dashboard page background**
  - What to build: In `src/components/Dashboard.jsx`, import `useTheme`. Get `theme` from `useTheme()`. Find the outermost wrapper div that sets the page background (look for `background: '#0f1117'` or similar). Change its `background` inline style to `'var(--dash-bg)'`. Find the main content card or panel containers (the ones that use `background: 'rgba(255,255,255,0.05)'` or similar) and change them to `'var(--dash-card)'`. Find top-level text elements using hardcoded white/light colors and change to `'var(--dash-text-pri)'` or `'var(--dash-text-sec)'`. Do NOT attempt to refactor every component's inline style — only the page-level wrapper, main card containers, and top-level text. Leave nested component styles untouched.
  - Files to modify: `src/components/Dashboard.jsx`
  - Acceptance criteria: In light mode, dashboard background is `#f1f5f9` and main cards are white; in dark mode unchanged from current. Build passes.
  - Test command: `npx vite build 2>&1 | tail -8`

- [ ] **Task 7: Apply theme CSS vars to SettingsPage background**
  - What to build: Same pattern as Task 6 but for `src/components/SettingsPage.jsx`. Change the page wrapper background to `var(--dash-bg)`, section card backgrounds to `var(--dash-card)`, and section header/label text to `var(--dash-text-pri)` / `var(--dash-text-sec)`. The orange Save button and Hapag Blue accents stay hardcoded — do not change accent colors.
  - Files to modify: `src/components/SettingsPage.jsx`
  - Acceptance criteria: Settings page background and card surfaces respond to theme toggle. Build passes.
  - Test command: `npx vite build 2>&1 | tail -8`

### Phase 5: Persistence on Load

- [ ] **Task 8: Reload PiP theme on preference change**
  - What to build: In the component that renders the PiP open button (likely `src/PipBar.jsx`), add a `useEffect` that watches `theme` from `useTheme()`. When `theme` changes AND the PiP window is currently open, close and reopen it so the new token block is injected. Use the existing close/open functions from `usePipWindow`. This gives agents instant feedback when they switch themes in Settings while the widget is open. Add a brief console.log `[Meridian] Reapplying theme: ${theme}` for debuggability.
  - Files to modify: `src/PipBar.jsx` (or wherever PiP open/close is controlled)
  - Acceptance criteria: If PiP is open and theme changes, PiP closes and reopens with new tokens. Build passes.
  - Test command: `npx vite build 2>&1 | tail -8`

## Testing Strategy

- Primary: `npx vite build 2>&1 | tail -8` — must exit cleanly after every task
- No test suite exists — Ralph verifies via build pass only
- Manual QA (Davis does this after Ralph finishes):
  1. Open Settings → Theme section should show Dark + Light cards, both clickable
  2. Click Light → dashboard background should shift to `#f1f5f9`
  3. Open PiP widget → should open with light token set (white card surface, dark text)
  4. Reload page → light mode should persist (loaded from Supabase)
  5. Switch back to Dark → everything returns to current dark state

## Out of Scope

- Do NOT refactor every component's inline styles to use CSS vars — only page-level wrappers and main card containers
- Do NOT touch auth pages (`SignIn.jsx`, `SignUp.jsx`, `Onboarding.jsx`) — they stay dark always
- Do NOT build an "auto" / system preference mode — just `dark` | `light`
- Do NOT touch CT 1.0 (`case-tracker-app.vercel.app`) in any way
- Do NOT add animations to the theme transition — instant switch only
- Do NOT modify the bookmarklet or `pending_triggers` logic

## Notes for Ralph

- The PiP window is a separate `Document` — CSS variables injected via `usePipWindow.js`'s `style.textContent` block are the ONLY way to theme PiP components. They do NOT inherit from the host page's `<html>` tag.
- `document.documentElement.dataset.theme` controls theming on the host/dashboard page via the `[data-theme="..."]` CSS selectors injected by `ThemeContext`.
- The Supabase update in Task 5 should use spread to preserve other settings fields: `{ settings: { ...(existingSettings || {}), theme: value } }`. Get `existingSettings` from the profile state already in context or component state.
- If `platform_users.settings` column doesn't exist yet, run this SQL migration first before any other task: `ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;`
- `usePipWindow.js` injects styles synchronously at PiP open time — no async needed for token injection
- The scrollbar styles in `usePipWindow.js` should also be theme-aware: dark scrollbar for dark mode (`rgba(255,255,255,0.22)`), subtle gray for light mode (`rgba(0,0,0,0.18)`)
