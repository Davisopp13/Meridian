# Meridian — PiP Widget Dark Theme PRD

## Project Overview

Meridian is a Vite + React 18 Document Picture-in-Picture widget. The dashboard is already dark (`#0f1117`). This PRD makes the floating PiP widget match — replacing all hardcoded light/white backgrounds and text colors in PiP-rendered components with dark equivalents. The `:root` CSS token block in `usePipWindow.js` has already been updated with dark tokens. This PRD wires those tokens up correctly and fixes any hardcoded values that bypass them. Success = the PiP bar, tray, pills, overlays, and all PiP-rendered UI render on a dark semi-transparent surface with white text and orange/blue accents.

---

## Architecture & Key Decisions

- **Framework:** Vite + React 18, no TypeScript, inline styles only in PiP window
- **Styling pattern:** All PiP component styles are inline (`style={{ ... }}`). CSS modules and Tailwind do not apply inside the PiP window. The only shared styles are CSS custom properties injected via the `:root` block in `usePipWindow.js`
- **Token system:** CSS custom properties are already updated in `usePipWindow.js`. Use them via the `C` or `COLORS` constant object if one exists in the codebase, otherwise reference the variables directly
- **Dark tokens (already live in usePipWindow.js):**
  - `--bg-card`: `rgba(255,255,255,0.06)` — main bar and card backgrounds
  - `--border`: `rgba(255,255,255,0.1)` — all borders
  - `--divider`: `rgba(255,255,255,0.08)` — divider lines
  - `--card-bg-subtle`: `rgba(255,255,255,0.05)` — subtle surface tint
  - `--text-pri`: `rgba(255,255,255,0.9)` — primary text
  - `--text-sec`: `rgba(255,255,255,0.55)` — secondary text
  - `--text-dim`: `rgba(255,255,255,0.3)` — dim/hint text
  - `--case-focus`: `rgba(232,84,10,0.1)` — focused case row bg
  - `--case-border`: `rgba(232,84,10,0.25)` — focused case row border
  - `--row-focus`: `rgba(255,255,255,0.04)` — hovered row bg
  - `--amber-row`: `rgba(217,119,6,0.12)` — awaiting row bg
  - `--shadow-subtle`: `none`
  - `--shadow-glow`: `none`
- **Accent colors stay the same:** CT orange `#E8540A`, MPL blue `#4da6ff`, resolved green `#4ade80`, reclass red `#ef4444`, calls blue `#3b82f6`, awaiting amber `#f59e0b`
- **Do NOT touch:** Dashboard, Navbar, auth screens (SignIn, SignUp), onboarding steps, DashboardStatCard, DashboardChart, BookmarkletModal — these are host-page components, not PiP-rendered

---

## Environment & Setup

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in `.env.local`
- No schema changes, no new dependencies

---

## Tasks

### Phase 1: Bar Background

- [x] **Task 1: Dark background on PipBar**
  - What to build: Find the hardcoded background color on the main bar container in `src/components/PipBar.jsx`. Replace it with `var(--bg-card)`. Also find and replace any hardcoded white, `#fff`, `#ffffff`, or light gray (`#f`, `rgba(0,0,0,0.0x)`) background values in this file. Replace border colors using `var(--border)`, divider lines using `var(--divider)`, primary text using `var(--text-pri)`, secondary text using `var(--text-sec)`.
  - Files to modify: `src/components/PipBar.jsx`
  - Acceptance criteria: PiP bar renders with dark semi-transparent background; no white or light background visible on the bar itself; title text is light; borders are subtle light opacity
  - Test command: `npm run build` completes

### Phase 2: Pills

- [ ] **Task 2: Dark theme for CasePill**
  - What to build: In `src/components/CasePill.jsx`, audit all inline styles. The pill background for a focused/active case should be `rgba(232,84,10,0.12)` with border `rgba(232,84,10,0.3)`. For an unfocused case, use `rgba(255,255,255,0.06)` background with border `var(--border)`. For awaiting state, use `rgba(245,158,11,0.12)` background with border `rgba(245,158,11,0.3)`. Replace any hardcoded white backgrounds, dark text colors (`#0f172a`, `#1e293b`, `#374151`), or black borders with the appropriate dark equivalents. Keep `#E8540A` orange and `#fff` white text on colored elements as-is.
  - Files to modify: `src/components/CasePill.jsx`
  - Acceptance criteria: Case pills render correctly on dark bar — focused orange tint, unfocused subtle, awaiting amber tint; text readable
  - Test command: `npm run build` completes

- [ ] **Task 3: Dark theme for StatButton**
  - What to build: In `src/components/StatButton.jsx`, the stat buttons (Resolved, Reclassified, Calls, Total) should keep their colored backgrounds but ensure text contrast is correct on dark. Replace any hardcoded white backgrounds with dark equivalents. The existing colored backgrounds (green, red, blue, gray) should stay — only fix if they have a white container behind them.
  - Files to modify: `src/components/StatButton.jsx`
  - Acceptance criteria: Stat buttons render correctly on dark bar with no white container visible
  - Test command: `npm run build` completes

### Phase 3: Tray & Lane Rows

- [ ] **Task 4: Dark theme for SwimlaneTray and lane rows**
  - What to build: Find `src/components/SwimlaneTray.jsx` and any `CaseLaneRow.jsx` / `ProcessLaneRow.jsx` files. Replace all hardcoded light backgrounds with `var(--bg-card)` or `var(--card-bg-subtle)`. Replace dark text colors with `var(--text-pri)` / `var(--text-sec)` / `var(--text-dim)`. Replace black/dark borders with `var(--border)`. Replace divider lines with `var(--divider)`. Focused case row background: `var(--case-focus)`, border: `var(--case-border)`. Hovered row: `var(--row-focus)`. Awaiting row: `var(--amber-row)`. Remove any `box-shadow` values — use `var(--shadow-subtle)` which is now `none`.
  - Files to modify: `src/components/SwimlaneTray.jsx`, `src/components/CaseLaneRow.jsx` (if exists), `src/components/ProcessLaneRow.jsx` (if exists)
  - Acceptance criteria: Tray renders on dark surface; lane rows readable; focused/awaiting states visually distinct; no white backgrounds
  - Test command: `npm run build` completes

### Phase 4: Overlays

- [ ] **Task 5: Dark theme for CategoryDrillDown**
  - What to build: In `src/components/CategoryDrillDown.jsx`, replace all hardcoded light backgrounds with `var(--bg-card)`. Replace white category button backgrounds with `var(--card-bg-subtle)` and borders with `var(--border)`. Replace dark text with `var(--text-pri)`. Keep the selected/active category state using the existing accent color (orange or blue depending on context). Replace the back button and header text with `var(--text-sec)`.
  - Files to modify: `src/components/CategoryDrillDown.jsx`
  - Acceptance criteria: Category drill-down overlay renders dark; category buttons readable; selected state distinct; back button visible
  - Test command: `npm run build` completes

- [ ] **Task 6: Dark theme for ManualEntryForm**
  - What to build: In `src/components/ManualEntryForm.jsx`, replace all hardcoded light/white backgrounds with `var(--bg-card)`. Duration pill buttons (5min, 10min etc.) should use `var(--card-bg-subtle)` background with `var(--border)` border and `var(--text-pri)` text when unselected, and the existing process blue `#4da6ff` tint when selected. Replace any dark text colors with `var(--text-pri)` / `var(--text-sec)`. Remove shadows.
  - Files to modify: `src/components/ManualEntryForm.jsx`
  - Acceptance criteria: Manual entry form renders dark; duration pills readable and selectable; category section consistent with CategoryDrillDown dark theme
  - Test command: `npm run build` completes

- [ ] **Task 7: Dark theme for PendingTriggerBanner**
  - What to build: In `src/components/PendingTriggerBanner.jsx`, replace any light/white background with `var(--bg-card)`. This banner appears in the host page (not PiP window) when a trigger arrives while PiP is closed — check whether it uses the PiP CSS tokens or host page styles. If it uses host page styles, use hardcoded dark values (`background: rgba(15,17,23,0.95)`, `color: rgba(255,255,255,0.9)`) rather than CSS variables since the tokens only apply inside the PiP window document. Keep the orange accent color for the trigger type indicator.
  - Files to modify: `src/components/PendingTriggerBanner.jsx`
  - Acceptance criteria: Banner renders dark when appearing over the host page; text readable; orange accent visible
  - Test command: `npm run build` completes

### Phase 5: Verification

- [ ] **Task 8: Visual audit and cleanup**
  - What to build: Run `grep -rn "background.*#fff\|background.*white\|background.*#f8\|background.*#f9\|color.*#0f172\|color.*#1e293\|color.*#374\|color.*#475" src/components/PipBar.jsx src/components/CasePill.jsx src/components/StatButton.jsx src/components/SwimlaneTray.jsx src/components/CaseLaneRow.jsx src/components/CategoryDrillDown.jsx src/components/ManualEntryForm.jsx src/components/PendingTriggerBanner.jsx` and fix any remaining light values that were missed in earlier tasks. Also check `src/components/overlays/` directory if it exists for any overlay components not covered above.
  - Files to modify: Any PiP component files with remaining light values
  - Acceptance criteria: Grep returns no hardcoded light backgrounds or dark text colors in PiP component files
  - Test command: `npm run build` completes

---

## Testing Strategy

- Primary: `npm run build` — must complete with zero errors for every task
- Secondary: `npm run dev` — launch the PiP widget and visually verify each state:
  - Idle bar: dark surface, light text, green connection dot
  - Case active: orange tinted pill on dark bar
  - Process active: blue tinted pill on dark bar
  - Tray open: dark swimlane, readable lane rows
  - Category picker: dark overlay, readable category buttons
  - Manual entry: dark overlay, readable duration pills
- No automated test suite — rely on build success + visual check

---

## Out of Scope

- Do not touch `src/components/Dashboard.jsx`
- Do not touch `src/components/Navbar.jsx`
- Do not touch `src/components/DashboardChart.jsx`
- Do not touch `src/components/DashboardStatCard.jsx`
- Do not touch `src/components/BookmarkletModal.jsx`
- Do not touch `src/components/auth/` directory
- Do not touch `src/components/onboarding/` directory
- Do not touch `src/components/SignIn.jsx` or `src/components/SignUp.jsx`
- Do not touch `src/hooks/usePipWindow.js` — tokens already updated
- No logic changes, no state changes, no schema changes, no new dependencies
- Do not change any accent colors (orange, blue, green, red, amber)

---

## Notes for Ralph

- **Inline styles only** — all PiP component styles are `style={{ ... }}` objects. There are no CSS class names to update inside PiP components. Every change is a value swap in an inline style prop.
- **CSS variables work inside PiP** only because they are injected into the PiP window's `<head>` via `usePipWindow.js`. They are already updated and live. Use them with `var(--token-name)` in inline style strings: `style={{ background: 'var(--bg-card)' }}`.
- **`PendingTriggerBanner` is a host-page component** — it renders in the main browser tab, not inside the PiP window. CSS variables from `usePipWindow.js` do NOT apply to it. Use hardcoded dark hex values for this component only.
- **Do not guess file locations** — if a file listed in a task doesn't exist (e.g. `ProcessLaneRow.jsx`), check `src/components/` for the actual filename before proceeding.
- **The goal is visual consistency** — the PiP widget should feel like it belongs to the same dark design system as the dashboard. When in doubt, match the dashboard's aesthetic: `#0f1117` deep background, subtle borders, white text hierarchy.
