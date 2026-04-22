# Meridian Design Token Consolidation PRD

## Project Overview

Eliminate design-token duplication across the Meridian codebase. The app has a solid set of CSS custom properties defined in `src/index.css`, but 20 components declare their own local `const C = { … }` palette with hardcoded hex values instead of using the tokens. This drift blocks theme switching, makes color changes a 20-file search, and has produced at least one silent bug (the Insights module references tokens that don't exist).

The work is **100% mechanical**: no new features, no new logic, no new dependencies. Just route every visual value through the existing token system — and fix the critical bugs uncovered during the design audit along the way.

**Success criteria:**
- `grep -rn "const C = {" src/components/` returns **zero results** in components (only in hooks/libs if any).
- `grep -rn "var(--text-primary)\|var(--text-secondary)" src/` returns **zero results**.
- `grep -rn "'#003087'\|'#E8540A'\|'#0f0f1e'\|'#1a1a2e'" src/components/` returns **zero results** (all via tokens).
- `npx vite build` completes cleanly.
- Dark mode and light mode both render correctly after the pass (visual check).
- All interactive elements show a visible focus ring when Tab'd to.

---

## Architecture & Key Decisions

Do not change these. They are established and correct — the work here is aligning to them, not questioning them.

- **Token source of truth: `src/index.css`.** All color, font, motion, and spacing tokens live there. Components read via `var(--token-name)`.
- **Font is Segoe UI.** No `Inter`, no Google Fonts, no `@import`. Set once in `:root` via `--font-family`, inherit everywhere.
- **Theme switching is CSS-driven, not JS-driven.** The `[data-theme="light"]` block in `index.css` already handles dark↔light swaps. Components should NOT branch on `theme === 'light'` in their style objects.
- **Inline styles remain.** Meridian's house style is inline-styled React components (pattern established in `Dashboard.jsx`, `Navbar.jsx`). Do not introduce CSS modules, Tailwind, styled-components, or a new CSS file. Just route inline-style values through `var(...)` references.
- **The `const C` pattern stays** — but its values become `var(...)` references, not hex literals. This is a surgical transformation, not a refactor.
- **No new tokens unless listed in Task 0.** If a component needs a color that has no token, check the candidate list in Task 0 first, then add to `index.css` — never reintroduce hex at the call site.

---

## Environment & Setup

Ralph should assume:
- Working directory: `/Users/davis/Meridian 1.0` (or wherever the repo is cloned).
- `npm install` already done.
- `.env.local` populated with Supabase keys.
- Primary test command: `npx vite build`
- Secondary check: `grep` assertions listed in each task.

---

## Pre-existing Context

Things Ralph should know before starting:

- The app ships a dark theme by default. A `ThemeContext` exists at `src/context/ThemeContext.jsx` and toggles a `data-theme="light"` attribute on the root. Most CSS variables already have dark/light variants in `index.css`.
- The canonical brand colors are **Hapag Blue `#003087`** (`--color-mbtn`) and **Hapag Orange `#E8540A`** (`--color-mmark`).
- Hapag Orange should be **reserved for brand moments** — the M° mark, primary CTAs, the focus ring — not every active tab state.
- There is a migration script pattern in the repo (`scripts/sync-ct1-*`); don't touch it. It's CT 1.0 bridge code.
- Two other audit findings relate to visual polish (stat card redesign, Insights hierarchy rebalance) — those are **out of scope** for this PRD. Just do the token consolidation and bug fixes.

---

## Tasks

### Phase 0 — Foundation: fix the token system itself

- [x] **Task 0.1: Extend `src/index.css` with missing tokens**

  The existing tokens are good but incomplete. Add the handful we need to route every `const C` through vars without introducing new hex.

  Edit `src/index.css`. In the `:root` block, add (keep existing tokens untouched):

  ```css
  :root {
    /* … existing tokens … */

    /* Font — canonical, Segoe UI commit */
    --font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;

    /* Navbar — specific because it's glassy */
    --bg-navbar: rgba(26, 26, 46, 0.8);

    /* Hover surface (dark mode default) */
    --hover-surface: rgba(255, 255, 255, 0.06);
    --hover-surface-soft: rgba(255, 255, 255, 0.03);

    /* Active-tab fill (navy by default — NOT orange) */
    --tab-active-bg: var(--color-mbtn);
    --tab-active-fg: #ffffff;

    /* Motion tokens */
    --motion-fast: 150ms cubic-bezier(0.3, 0, 0.2, 1);
    --motion-slow: 240ms cubic-bezier(0.3, 0, 0.2, 1);

    /* Focus ring */
    --focus-ring: 2px solid var(--color-mmark);
    --focus-offset: 2px;
  }

  [data-theme="light"] {
    /* … existing overrides … */
    --bg-navbar: rgba(255, 255, 255, 0.85);
    --hover-surface: rgba(15, 23, 42, 0.06);
    --hover-surface-soft: rgba(15, 23, 42, 0.03);
  }
  ```

  Add a **global focus-visible rule** to the same file, below the `body` block:

  ```css
  :focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-offset);
    border-radius: 4px;
  }
  button:focus-visible,
  [role="button"]:focus-visible,
  a:focus-visible,
  input:focus-visible,
  textarea:focus-visible,
  select:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-offset);
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  body {
    font-variant-numeric: tabular-nums;
  }
  ```

  **Acceptance:**
  - `grep -n "motion-fast\|focus-ring\|hover-surface\|tab-active-bg\|bg-navbar" src/index.css` returns ≥ 7 matches.
  - `grep -n "prefers-reduced-motion\|focus-visible\|tabular-nums" src/index.css` returns ≥ 3 matches.
  - `npx vite build` passes.

---

### Phase 1 — Critical bug fixes

- [x] **Task 1.1: Fix the Insights token typo (CRITICAL)**

  The entire Insights module references `var(--text-primary)` and `var(--text-secondary)`, which do **not exist**. The canonical tokens are `--text-pri` and `--text-sec`. This means every Insights panel is currently rendering with default browser colors in some contexts.

  In each of the following files, replace:
  - `var(--text-primary)` → `var(--text-pri)`
  - `var(--text-secondary)` → `var(--text-sec)`

  **Files:**
  - `src/components/insights/TeamCaseVolumePanel.jsx`
  - `src/components/insights/AgentHandleTimePanel.jsx`
  - `src/components/insights/AgentRow.jsx`
  - `src/components/insights/TrendComparisonPanel.jsx`
  - `src/components/insights/OverviewTab.jsx`
  - Any other file under `src/components/insights/` that matches.

  **Acceptance:**
  - `grep -rn "var(--text-primary)\|var(--text-secondary)" src/` returns **zero matches**.
  - `grep -rn "var(--text-pri)\|var(--text-sec)" src/components/insights/` returns ≥ 10 matches.
  - `npx vite build` passes.

- [x] **Task 1.2: Remove the `Inter` font reference**

  `src/index.css` declares `--font-family: 'Inter', system-ui, sans-serif` but Inter is never loaded. Meanwhile every component hardcodes Segoe UI inline. Task 0.1 already updated the token to Segoe UI — now strip the inline restatements so components inherit.

  In every file under `src/components/`, `src/mpl/`, `src/ct/`, `src/DashboardApp.jsx`:
  - Find any inline style that sets `fontFamily: '"Segoe UI", …'` or `font-family: "Segoe UI"…` or `fontFamily: 'Inter …'`.
  - **Delete that line entirely.** Don't replace it with `var(--font-family)` — inheritance handles it. The root `body` rule in `index.css` already applies `--font-family`.

  One exception: the `widget-mode` body CSS rule in `index.css` may need its own explicit `font-family: var(--font-family);` if PiP windows don't inherit. Check and add if needed.

  **Acceptance:**
  - `grep -rn "fontFamily.*Segoe\|fontFamily.*Inter\|font-family:.*Segoe" src/` returns **zero matches** (or only in `src/index.css`).
  - `npx vite build` passes.
  - Font is visually unchanged (Segoe UI on Windows, system fallback on Mac).

---

### Phase 2 — Token migration: one file per task

For each file below, the transformation is the same three-step pattern:

1. Locate the local `const C = { … }` (or equivalent hardcoded color object).
2. Replace each hex/rgba value with the corresponding `var(--token)` reference per the **Token Translation Table** at the bottom of this PRD.
3. If a value has no token equivalent, **check the list of tokens added in Task 0.1 first**, then promote to `index.css` rather than reintroducing a hex.

After each file, run `npx vite build` — it must pass before moving on.

- [x] **Task 2.1: `src/components/Navbar.jsx`**
  - Replace the `const C = { bg: 'rgba(26, 26, 46, 0.8)', … }` with token refs (`bg: 'var(--bg-navbar)'`, etc.).
  - Replace inline `transition: 'all 150ms ease'` with `transition: 'all var(--motion-fast)'`.
  - **Acceptance:** `grep -n "#003087\|#E8540A\|rgba(26" src/components/Navbar.jsx` = 0. Build passes.

- [x] **Task 2.2: `src/components/SignIn.jsx` and `src/components/auth/SignIn.jsx`**
  - Both files have local `const C`. Migrate both.
  - **Acceptance:** `grep -n "#003087\|#E8540A\|#0f0f1e\|#1a1a2e" src/components/SignIn.jsx src/components/auth/SignIn.jsx` = 0. Build passes.

- [x] **Task 2.3: `src/components/auth/SignUp.jsx`**
  - **Acceptance:** no hex in file. Build passes.

- [x] **Task 2.4: Onboarding trio — `Step1Profile.jsx`, `Step2Team.jsx`, `Step3Bookmarklet.jsx`**
  - All three are under `src/components/onboarding/` and each has its own `const C`.
  - Migrate all three in this task.
  - **Acceptance:** `grep -rn "#003087\|#E8540A\|#0f0f1e\|#1a1a2e\|rgba(255,255,255,0.12)" src/components/onboarding/` = 0. Build passes.

- [x] **Task 2.5: `src/components/Dashboard.jsx`**
  - The `const C` uses var-prefixed values already. The issue is the inline `theme === 'light' ? '…' : '…'` ternary in `tabStyle()`. Replace with a single `var(--hover-surface)` reference — the CSS var already branches for light mode.
  - Also update active-tab background from `C.mMark` (orange) to `var(--tab-active-bg)` (navy) — orange should be reserved for brand moments, not active tabs. (See audit finding F-05.)
  - **Acceptance:** `grep -n "theme === 'light'" src/components/Dashboard.jsx` = 0. Build passes.

- [x] **Task 2.6: `src/components/InsightsTab.jsx`**
  - Same treatment as Dashboard: replace `theme === 'light'` ternary with `var(--hover-surface)`.
  - Replace active-tab orange with `var(--tab-active-bg)`.
  - **Acceptance:** `grep -n "theme === 'light'" src/components/InsightsTab.jsx` = 0. Build passes.

- [x] **Task 2.7: `src/components/ActivityLog.jsx`**
  - Has a `const C` around line 739. Migrate it to token refs.
  - The `TYPE_STYLE` object at the top also has hardcoded hexes but those ARE semantic status colors — leave them as-is for now (they're a documented exception and consistent with the stat card colors in `Dashboard.jsx`).
  - **DO NOT TOUCH** any of the SF Direct Link wiring that was added in the prior PRD: the `import CaseLink from './CaseLink.jsx'`, the `<CaseLink sfCaseId={...} />` calls (there are 2 — one in the row render, one in the edit modal header), the `className="case-link-host"` on the EntryRow wrapper, or the `width: 116` on the case# slot. These are functional, not stylistic.
  - **DO NOT TOUCH** any `entry.sf_case_id` references — that's data flow, not styling.
  - **Acceptance:**
    - `grep -n "const C = {" src/components/ActivityLog.jsx` = 0
    - `grep -c "CaseLink" src/components/ActivityLog.jsx` is unchanged from before Ralph's edit (run it both before and after; values must match). Capture the before-count in `progress.txt` before editing.
    - Build passes.

- [x] **Task 2.8: `src/components/SettingsPage.jsx`**
  - Migrate the `const C` palette.
  - **Acceptance:** no hex in `const C` block. Build passes.

- [x] **Task 2.9: Admin surface — `AdminTab.jsx` and everything under `src/components/admin/`**
  - `AdminTab.jsx` has a top-level `const C`. Every file under `src/components/admin/` uses inline styles.
  - Focus on the top-level `const C` definitions only — migrate those to token refs.
  - **Acceptance:** `grep -rn "const C = {" src/components/admin/ src/components/AdminTab.jsx` = 0. Build passes.

- [ ] **Task 2.10: Feedback surface — everything under `src/components/feedback/`**
  - `SuggestionRow.jsx`, `SuggestionForm.jsx`, `AttachmentUploader.jsx`, `SuggestionDetailPanel.jsx`, `CategoryPromotionModal.jsx` — all have local `const C`.
  - `FeedbackTab.jsx` also has one.
  - **Acceptance:** `grep -rn "const C = {" src/components/feedback/ src/components/FeedbackTab.jsx` = 0. Build passes.

- [ ] **Task 2.11: Modal components — `BookmarkletModal.jsx`**
  - Migrate the `const C`.
  - **Acceptance:** no hex in `const C`. Build passes.

- [ ] **Task 2.12: Chart — `DashboardChart.jsx`**
  - Has a `const C`. Note: chart data colors (the green/red/blue/etc. for each metric) should stay as-is — they're semantic metric colors, not theme surface colors. Only migrate background/border/text tokens to vars.
  - **Acceptance:** background/border/text values use vars. Metric colors unchanged. Build passes.

- [ ] **Task 2.13: `DashboardTable.jsx` and `InsightsEmptyState.jsx`**
  - Two smaller files with `const C`. Migrate both in this task.
  - **Acceptance:** no local hex in `const C` blocks. Build passes.

- [ ] **Task 2.14: `src/components/CaseLink.jsx` — review only, no migration expected**
  - This file was added in the SF Direct Link PRD. It already uses CSS vars (`var(--text-dim)`, `var(--color-mmark)`, `var(--hover-surface)`, `var(--motion-fast)`) correctly.
  - Task: verify that all color/motion values in `CaseLink.jsx` reference tokens, not hex literals. If any do, migrate them. Otherwise mark complete as a no-op and note in `progress.txt`.
  - **DO NOT** change the `onClick={(e) => e.stopPropagation()}`, the `target`/`rel` attributes, the `caseUrl()` import, or the `showOnHover` prop logic — all functional.
  - **Acceptance:** `grep -nE "#[0-9a-fA-F]{3,6}" src/components/CaseLink.jsx` returns 0 matches. Build passes.

- [ ] **Task 2.15: `src/lib/salesforce.js` — review only, hands off**
  - This file owns the SF URL construction. It contains only logic, no styling.
  - Verify no changes are needed. Mark complete.
  - **Acceptance:** `git diff --name-only src/lib/salesforce.js` shows no modifications after Ralph's run.

---

### Phase 3 — Final sweep and verification

- [ ] **Task 3.1: Remove the `backdropFilter: blur(12px)` no-op from `DashboardStatCard.jsx`**

  The stat card has `backdropFilter: 'blur(12px)'` on an opaque solid-color background. It does nothing and adds GPU cost.

  In `src/components/DashboardStatCard.jsx`, delete these two lines:
  ```js
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  ```

  Also update the `transition` value from its overshoot cubic-bezier curve to the standard motion token — the stat card redesign is out of scope, but the motion consistency win is free:
  ```js
  transition: 'all var(--motion-fast)',
  ```

  **Acceptance:**
  - `grep -n "backdropFilter" src/components/DashboardStatCard.jsx` = 0.
  - Build passes.

- [ ] **Task 3.2: Fix `prefers-reduced-motion` on the `fade-in-up` animation**

  The `fade-in-up` keyframe animation is inlined in `Dashboard.jsx`. The global rule added in Task 0.1 should handle it, but verify.

  Run the app (or build + inspect output) and confirm no `animation:` shorthand bypasses the global rule by using `animation-duration` directly (the global override works on the shorthand).

  **Acceptance:** visual check in DevTools with "emulate prefers-reduced-motion: reduce" — animations do not fire.

- [ ] **Task 3.3: Grep assertion pass — final check**

  Run this block. Every line must return zero unless noted.

  ```bash
  # No local C palettes in components
  grep -rln "const C = {" src/components/ | wc -l      # expect 0

  # No broken token references
  grep -rn "var(--text-primary)\|var(--text-secondary)" src/  # expect empty

  # No inline Inter/Segoe font family (should inherit)
  grep -rn "fontFamily.*Segoe\|fontFamily.*Inter" src/components/  # expect empty

  # No theme === 'light' branching in style objects
  grep -rn "theme === 'light' ?" src/components/  # expect empty or very few (with justification)

  # No hardcoded brand hex in components (admin/feedback/dashboard)
  grep -rn "'#003087'\|'#E8540A'\|'#0f0f1e'\|'#1a1a2e'" src/components/  # expect 0

  # Build
  npx vite build
  ```

  If any grep returns unexpected matches, open the file and migrate. If build fails, debug and fix.

  **Acceptance:** all five grep checks produce expected output. Build passes. Commit with message `token consolidation: fix insights vars, route all const C through tokens, add focus ring + motion tokens`.

---

## Out of Scope

These are documented design issues but **not** part of this PRD. Do not touch them:

- ❌ Redesigning `DashboardStatCard` visual treatment (separate track — happens after this lands).
- ❌ Rebuilding the `InsightsTab` hierarchy / adding new Insights panels.
- ❌ Any changes to `TYPE_STYLE` objects in `ActivityLog.jsx` or metric colors in `Dashboard.jsx` — those are semantic and stay as explicit hex until a separate "semantic color palette" track.
- ❌ Any database, schema, or API changes.
- ❌ Adding new features, new tabs, new routes.
- ❌ Refactoring inline styles to CSS modules or Tailwind — the house style stays inline.
- ❌ Touching the PiP widget code (`src/ct/`, `public/ct-widget.js`, `public/meridian-trigger.js`, `public/meridian-relay.html`) — those have their own constraints.
- ❌ Onboarding text copy or flow changes — token migration only.
- ❌ **Anything related to SF Direct Link functionality.** The prior PRD shipped `src/lib/salesforce.js`, `src/components/CaseLink.jsx`, `<CaseLink />` usages in `ActivityLog.jsx`, `className="case-link-host"` on activity rows, `sf_case_id` data flow in `useActivityData.js`, and the `.case-link-host / .case-link-icon` CSS rules in `index.css`. ALL of this is functional, not stylistic. Do not remove, refactor, or "clean up" any of it. Treat it as load-bearing code.

---

## Token Translation Table

Use this as the lookup when migrating any `const C` block. Any value not in this table and not already a token should be resolved with judgement — prefer the closest existing token, and only if none fits reasonably, promote to `index.css`.

| Old hardcoded value | Token to use |
|---|---|
| `'#003087'` | `'var(--color-mbtn)'` |
| `'#E8540A'` | `'var(--color-mmark)'` |
| `'#0f0f1e'` | `'var(--bg-deep)'` |
| `'#1a1a2e'` | `'var(--bg-card)'` |
| `'rgba(255, 255, 255, 0.95)'` | `'var(--text-pri)'` |
| `'rgba(255, 255, 255, 0.93)'` | `'var(--text-pri)'` |
| `'rgba(255, 255, 255, 0.75)'` | `'var(--text-sec)'` |
| `'rgba(255, 255, 255, 0.55)'` | `'var(--text-dim)'` |
| `'rgba(255, 255, 255, 0.45)'` | `'var(--text-dim)'` |
| `'rgba(255, 255, 255, 0.12)'` | `'var(--border)'` |
| `'rgba(255, 255, 255, 0.08)'` | `'var(--divider)'` |
| `'rgba(255, 255, 255, 0.06)'` | `'var(--hover-surface)'` |
| `'rgba(255, 255, 255, 0.04)'` | `'var(--card-bg-subtle)'` |
| `'rgba(26, 26, 46, 0.8)'` | `'var(--bg-navbar)'` |

**Do not migrate these** (they're semantic status colors, stay as-is):
- `'#16a34a'` / `'#22c55e'` (Resolved green)
- `'#dc2626'` / `'#ef4444'` (Reclass red)
- `'#0284c7'` / `'#0d9488'` (Calls blue/teal)
- `'#60a5fa'` (Process light blue)
- `'#f59e0b'` / `'#d97706'` / `'#f87171'` (Awaiting amber)
- `'#6b7280'` (Not a Case neutral)
- `'#4ade80'` (Active dot)

---

## Testing Strategy

**Per-task:**
- `npx vite build` — must pass cleanly.
- `grep` assertion in each task's Acceptance block.

**Final:**
- `npx vite build` passes.
- Open the built app in a browser. Walk these surfaces and confirm nothing looks broken:
  1. Sign-in page renders with correct dark background.
  2. Onboarding Step 1 renders correctly.
  3. Dashboard renders — stat cards, period tabs, activity log, table.
  4. Navbar renders — M° mark orange, buttons functional.
  5. Insights tab (as a supervisor) — all four panels render with correct text color.
  6. Settings page, Admin tab, Feedback tab — all render.
  7. Toggle light mode — everything still readable and the contrast holds.
  8. Tab through an interactive surface — orange focus ring is visible on every button/link/input.

---

## Notes for Ralph

- **The migration is mechanical, not creative.** If you find yourself wanting to "improve" the design, stop and add a note to `progress.txt` for Davis to review. This PRD is strictly about routing values through the token system.
- **Commit after each task.** Use the per-task commit pattern: `token consolidation: <file>`. This gives Davis easy rollback points.
- **If `npx vite build` fails, do NOT move on.** Debug the file you just touched. The most likely failure mode is a typo in a `var(--…)` name — check against `index.css`.
- **Never invent new tokens mid-task.** If Task 2.N needs a token that doesn't exist, stop, go back to Task 0.1, add it to `index.css` with a comment explaining why, then continue. Log it in `progress.txt`.
- **The metric color exception is real.** `'#16a34a'`, `'#dc2626'`, etc. are semantic — they represent meaning (green=resolved, red=reclass) and must stay stable across themes. Do not "fix" them.
- **If in doubt, leave the file alone and log it.** Ralph shipping a smaller, correct migration is better than Ralph shipping a larger, buggy one.
- **`grep -c` on files with single-line minified content counts matching LINES, not occurrences.** If a task specifies `grep -c` acceptance on a file that may be minified (or any file where a pattern might appear multiple times on one line), additionally run `grep -o <pattern> <file> | wc -l` for a true count. Specific risk: `public/ct-widget.js` is NOT in scope for this PRD, but this principle applies generally.
- **Do not claim a grep check passed without actually running it.** Every Acceptance block in this PRD specifies concrete commands. Run them. Paste the output into `progress.txt`. Ralph's self-reported status is only as good as its last `bash` exit code.
- **Read before you write.** For each task, actually `view` the file before editing. Don't rely on line numbers in the PRD — the file may have shifted since the PRD was written. Find the block by content, not by line.

---
