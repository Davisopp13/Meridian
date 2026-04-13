# Meridian MPL Widget Fix PRD

## Project Overview

Fix the MPL (Processes) widget so it renders correctly as a compact popup window accessible from any page via bookmarklet. Two bugs to resolve: (1) CSS custom properties (`var(--bg-card)`, `var(--text-pri)`, `var(--border)`, etc.) resolve to nothing in the popup window because the MPL app never injects the dark theme token block — making MplPipBar, CategoryDrillDown, and ManualEntryForm partially invisible. (2) The idle popup opens at `400×100` but the rendered content is taller than that, causing a scroll or clip. All fixes are isolated to `src/mpl/` and shared components — do NOT touch `src/ct/`, `src/App.jsx`, or any Supabase schema.

Tech stack: Vite + React 18, inline styles, Supabase, Vercel deployment.  
Test command: `npx vite build 2>&1 | tail -8` — must show `✓ built in` with zero errors.

---

## Architecture & Key Decisions

- **MplApp renders into a `window.open` popup** — NOT a Document PiP window. No `usePipWindow`, no `openPip`. The popup IS the widget window.
- **CSS vars must be injected manually** — `index.css` is loaded by the popup (same origin), but `var(--bg-card)` etc. in `index.css` use the default `:root` block which does NOT include the full dark token set used by PiP components. The fix is to inject a `<style>` tag into `document.head` in `MplApp.jsx` on mount, identical in content to what `usePipWindow.js`'s `buildThemeTokens('dark')` produces.
- **Do NOT use `usePipWindow` in MplApp** — MplApp is the popup. It doesn't open a child PiP window.
- **`window.resizeTo()` in a popup IS allowed** — popups opened with `window.open(..., 'popup,...')` can be resized by their own scripts. This is different from PiP windows. The `resizeTo` calls in MplApp are correct.
- **Sizing constants are already correct** — `getMplSizeForState` returns the right dimensions. The idle width computes to `370px` (`160 base + 114 processes + 90 total + 6 gap`), height `100px`.
- **Do not modify `usePipWindow.js`, `CtApp.jsx`, `src/App.jsx`** — these are CT/combined widget infrastructure. MPL is standalone.

---

## Dark Token Block (copy this exactly into MplApp)

This is what needs to be injected into `document.head` on mount. It matches `buildThemeTokens('dark')` from `usePipWindow.js` — copy the values exactly so the tokens are consistent:

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
  --shadow-subtle:  0 2px 8px rgba(0,0,0,0.4);
  --case-focus:     rgba(232,84,10,0.10);
  --case-border:    rgba(232,84,10,0.25);
  --row-focus:      rgba(255,255,255,0.04);
  --amber-row:      rgba(217,119,6,0.15);
  --color-mbtn:     #003087;
  --color-mmark:    #E8540A;
  --color-resolved: #22c55e;
  --color-reclass:  #ef4444;
  --color-calls:    #3b82f6;
  --color-process:  #64748b;
  --color-process-navy: rgba(0,48,135,0.45);
  --color-awaiting: #f59e0b;
  --color-active-dot: #4ade80;
  --dash-bg:        #0f1117;
  --dash-card:      rgba(255,255,255,0.04);
  --dash-border:    rgba(255,255,255,0.08);
  --dash-text-pri:  rgba(255,255,255,0.92);
  --dash-text-sec:  rgba(255,255,255,0.55);
  --dash-text-dim:  rgba(255,255,255,0.30);
}
body { background: #0f1117; }
```

---

## Files to Touch

```
src/mpl/
  MplApp.jsx          ← MODIFY: inject CSS tokens on mount, fix idle height
src/lib/
  constants.js        ← MODIFY: fix MPL_HEIGHTS.idle from 100 → 64 (matches popup open height)
```

Everything else (`MplPipBar.jsx`, `CategoryDrillDown.jsx`, `ManualEntryForm.jsx`, `ProcessPicker.jsx`) uses `var(--)` and `C.*` tokens correctly — they will fix themselves once the token injection is in place. Do not touch them.

---

## Tasks

### Phase 1: CSS Token Injection

- [x] **Task 1: Inject dark theme CSS tokens into MplApp on mount**
  - What: In `src/mpl/MplApp.jsx`, add a `useEffect(() => { ... }, [])` that runs once on mount and injects a `<style id="meridian-mpl-theme">` tag into `document.head`.
  - The style tag's `textContent` should be the exact dark token block from the **Dark Token Block** section above.
  - Guard against double-injection: check `document.getElementById('meridian-mpl-theme')` first — if it exists, skip.
  - Place the effect immediately after the existing `widgetInitRef` useEffect (around line 112).
  - Test: `npx vite build 2>&1 | tail -8` — zero errors.

### Phase 2: Sizing Fix

- [x] **Task 2: Fix idle popup height to match window.open dimensions**
  - What: The popup opens at `height=100` (from Dashboard's `handleLaunchMpl`) but `MPL_HEIGHTS.idle` is `100`. The issue is the browser's popup chrome (title bar, borders) eats ~32-40px, leaving the content area shorter than `100px`. The idle bar needs to be `64px` content height — same as CT idle — and the popup should open at `64px`.
  - In `src/lib/constants.js`: change `MPL_HEIGHTS.idle` from `100` to `64`.
  - In `src/components/Dashboard.jsx`: change `handleLaunchMpl`'s popup height from `100` to `64`.  
    Find: `window.open(url, 'meridian-mpl', 'popup,width=400,height=100,...')`  
    Change: `height=100` → `height=64`
  - In `src/mpl/MplApp.jsx`: the `widgetInitRef` useEffect calls `resizeTo('idle')` on mount — this is correct, leave it.
  - Test: `npx vite build 2>&1 | tail -8` — zero errors.

### Phase 3: MplPipBar Idle Layout Fix

- [x] **Task 3: Fix MplPipBar idle bar height to 64px**
  - What: `MplPipBar.jsx`'s bar row currently has `minHeight: 60`. It needs to match `64px` so it fills the popup correctly at idle state and doesn't leave a gap.
  - In `src/mpl/MplPipBar.jsx`: find the bar row div (the one with `minHeight: 60, display: 'flex', alignItems: 'center', padding: '0 12px'`) and change `minHeight: 60` → `minHeight: 64`.
  - While in that file, also ensure the root container div has `minHeight: 0` (not just `height: '100%'`) so flex children don't overflow in expanded states.
  - Test: `npx vite build 2>&1 | tail -8` — zero errors.

### Phase 4: TimerActive Height Sanity Check

- [x] **Task 4: Verify timerActive state height is correct**
  - What: `MPL_HEIGHTS.timerActive` is `140`. This is the height the popup resizes to when a process timer is running. Verify `MplPipBar` renders correctly at this height — the bar row (`64px`) + a second row showing timer details should fit in `140px` without scroll.
  - Read `src/mpl/MplPipBar.jsx` carefully. The `timerActive` state renders the active process pill, Log button, and Discard button all in the same `64px` bar row — there is no second row. This means `140px` is too tall for this state (leaves dead space) OR there's supposed to be a second row.
  - Decision: Change `MPL_HEIGHTS.timerActive` from `140` to `64` in `src/lib/constants.js` — the timer display is inline in the bar row, same height as idle. The pill + Log + Discard all fit in 64px.
  - Test: `npx vite build 2>&1 | tail -8` — zero errors.

### Phase 5: Final Verification

- [ ] **Task 5: Full build verification and grep checks**
  - Run `npx vite build 2>&1 | tail -8` — must show `✓ built in` with zero errors.
  - Run `grep -n "meridian-mpl-theme" src/mpl/MplApp.jsx` — must return at least 1 hit (the style injection).
  - Run `grep -n "MPL_HEIGHTS" src/lib/constants.js` — confirm `idle: 64` and `timerActive: 64`.
  - Run `grep -n "height=64\|height=100" src/components/Dashboard.jsx` — confirm `height=64` for MPL popup, no `height=100` for MPL.
  - No code changes allowed in this task — verification only. If any check fails, fix the relevant file and re-run build.

---

## Testing Strategy

- Primary: `npx vite build 2>&1 | tail -8` — run after every task
- Grep checks in Task 5 confirm the right values are in the right places
- No runtime tests possible (no test suite) — build pass + grep = done

---

## Out of Scope

- Do NOT touch `src/ct/CtApp.jsx`, `src/ct/CtPipBar.jsx`
- Do NOT touch `src/App.jsx`
- Do NOT touch `src/hooks/usePipWindow.js`
- Do NOT modify Supabase schema or RLS policies
- Do NOT add light mode support to the MPL widget (dark only for now)
- Do NOT change the bookmarklet logic (already fixed in this session)
- Do NOT add new features — this PRD is fixes only

---

## Notes for Ralph

- **MplApp is a popup, not a PiP.** It uses `window.resizeTo()` directly (popup windows allow this). Do not confuse it with `CtApp` which uses `usePipWindow` to open a Document PiP child window.
- **CSS vars are the root cause of invisible UI.** `index.css` exists but its `:root` block only has a few base tokens — not the full dark set. Components like `MplPipBar`, `CategoryDrillDown`, and `ManualEntryForm` use `var(--bg-card)`, `var(--text-pri)`, `var(--border)`, `var(--card-bg-subtle)` etc. which resolve to `initial` (empty) without the injected style tag.
- **The style injection useEffect runs before paint** — React runs effects synchronously after paint on first render, but the style is injected early enough that no flash should occur. If concerned, the `document.head` injection can also be done outside the component (module-level IIFE) — but the useEffect approach is cleaner and consistent with how `usePipWindow.js` does it.
- **`C.*` tokens from `constants.js` are CSS variable references** — e.g. `C.bg = 'var(--bg-card)'`. They only work once the token block is injected. This is why all child components fix themselves once Task 1 is complete.
- **Build command is `npx vite build`**, not `npm run build`. Both work, but the progress.txt history uses `npx vite build 2>&1 | tail -8`.
- **Do not run `git commit` unless the repo has a remote configured** — check with `git remote -v` first.
