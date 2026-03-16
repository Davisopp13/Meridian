# Meridian — Minimized Strip Redesign + Reliability Fixes PRD

## Project Overview

Meridian is a Vite + React 18 Document Picture-in-Picture productivity widget for Hapag-Lloyd IDT agents. It tracks Salesforce cases (CT) and manual process time (MPL) via a floating PiP bar. This PRD covers two workstreams: (1) a full redesign of the minimized strip with new layout, logo mark, scorecard, and process actions, and (2) four high-priority reliability fixes identified in a design audit. Success = minimized strip behaves correctly across all 5 states, and all four reliability issues are resolved with no regressions to the full bar or dashboard.

---

## Architecture & Key Decisions

- **Framework:** Vite + React 18, no TypeScript, inline styles only in PiP window
- **State:** All state lives in `App.jsx` (host page) — no state inside PiP components
- **Timers:** `setInterval` refs in `App.jsx` — never inside PiP components
- **PiP styling:** CSS custom properties do NOT inherit into PiP window — all styles are inline or injected via `<style>` block in `usePipWindow.js`
- **Resize rule:** `resizeTo()` requires synchronous user activation — NEVER call from `useEffect` or async context
- **Supabase:** `@supabase/supabase-js ^2.49.0`, RLS on all user tables
- **Colors:** CT = Hapag Orange `#E8540A`, MPL = `#4da6ff` (blue), dark bg `#0f1117`
- **Logo mark:** Use the actual `meridian-icon-512.png` asset via `<img>` tag at 20×20px — do NOT attempt SVG recreation

---

## Environment & Setup

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in `.env.local`
- No schema changes required for this PRD
- No new dependencies required

---

## Tasks

### Phase 1: Reliability Fixes

- [x] **Task 1: Add error boundary to PiP window**
  - What to build: A React `ErrorBoundary` class component that wraps the entire PiP window render root. On error, render a minimal fallback UI inside the PiP: a dark 680×68 bar showing the Meridian logo mark and a "Widget error — click to reload" message. Clicking the fallback calls `window.location.reload()` on the host page.
  - Files to create/modify:
    - Create `src/components/PipErrorBoundary.jsx`
    - Modify `src/hooks/usePipWindow.js` — wrap `ReactDOM.createRoot(...).render(...)` with `<PipErrorBoundary>`
  - Acceptance criteria: Error boundary renders without crashing; wraps the PiP root correctly
  - Test command: `npm run build` completes with no errors

- [ ] **Task 2: Add Supabase connection status indicator**
  - What to build: A small connection state dot visible on both the full PiP bar and the minimized strip. Track connection state in `App.jsx` using Supabase's `onAuthStateChange` and a periodic health-check ping (every 30s, `supabase.from('platform_users').select('id').limit(1)`). Three states: `connected` (green `#4ade80`), `degraded` (amber `#fbbf24`), `offline` (red `#f87171`). Dot is 6×6px, positioned at the far right of the full bar (before the minimize button), and also visible on the minimized strip scorecard zone.
  - Files to create/modify:
    - Modify `src/App.jsx` — add `connectionStatus` state, health-check interval, pass as prop
    - Modify `src/components/PipBar.jsx` — render dot before minimize button
  - Acceptance criteria: Dot renders in all three color states; health-check fires every 30s; does not cause re-renders of the whole tree (use a dedicated state slice)
  - Test command: `npm run build` completes

- [ ] **Task 3: Fix RFC concurrent write race condition**
  - What to build: Prevent the race condition where rapid resolve + RFC prompt clicks could corrupt a `ct_cases` row. Add a `resolvingCaseIds` ref (a `Set`) in `App.jsx`. Before any resolve/RFC write, check if the case ID is already in the set — if so, return early. Add the ID on write start, remove it on write completion (success or error) in a `finally` block.
  - Files to create/modify:
    - Modify `src/App.jsx` — add `resolvingCaseIds` ref, guard all `ct_cases` status update calls
  - Acceptance criteria: Rapid double-clicks on resolve/RFC do not result in duplicate DB writes; single writes complete normally
  - Test command: `npm run build` completes

- [ ] **Task 4: Deduplicate RFC logic**
  - What to build: RFC prompt logic currently exists in two places — the full `RFCPrompt` overlay and inline inside `CaseLaneRow`. Remove the inline RFC logic from `CaseLaneRow` entirely. Instead, when RFC needs to fire from the tray lane row, call the same `handleRFCRequired(caseId)` callback in `App.jsx` that triggers the full `RFCPrompt` overlay. This ensures one RFC code path only.
  - Files to create/modify:
    - Modify `src/components/CaseLaneRow.jsx` — remove local RFC state and inline prompt, add `onRFCRequired` prop call instead
    - Modify `src/App.jsx` — ensure `handleRFCRequired` callback is passed down to `CaseLaneRow` via `SwimlaneTray`
    - Modify `src/components/SwimlaneTray.jsx` — thread `onRFCRequired` prop through to `CaseLaneRow`
  - Acceptance criteria: RFC prompt only ever renders via the single `RFCPrompt` overlay component; `CaseLaneRow` has no local RFC state
  - Test command: `npm run build` completes

---

### Phase 2: Minimized Strip — Core Redesign

- [ ] **Task 5: Add `minimizedStripView` state and swap logic to App.jsx**
  - What to build: Add a new state variable `minimizedStripView` to `App.jsx` — values: `'auto' | 'case' | 'process'`. Default is `'auto'`. Add a derived value `activeStripSession` computed from this state: when `'auto'`, compare `focusedCase?.created_at` vs `activeProcess?.startedAt` and return whichever is more recent (or whichever exists if only one is active). When `'case'` or `'process'`, return that session directly. Add a `handleStripSwap()` callback that toggles between `'case'` and `'process'` when both are active, and resets to `'auto'` when either session ends.
  - Files to create/modify:
    - Modify `src/App.jsx`
  - Acceptance criteria: `minimizedStripView` state exists; `activeStripSession` derives correctly for all combinations of active sessions; `handleStripSwap` toggles correctly
  - Test command: `npm run build` completes

- [ ] **Task 6: Add today's scorecard counts to App.jsx**
  - What to build: Add a `todayScorecard` derived value in `App.jsx` containing three counts, each configurable via a user preference (hardcode defaults for now, settings UI comes later): `resolved` (count of `ct_cases` with `status: 'resolved'` created today), `calls` (count of `case_events` with `type: 'call'` created today), `processEntries` (count of `mpl_entries` created today). Use America/New_York timezone for "today" boundary (midnight to now). Fetch on mount and refresh on any new case/process write. Pass `todayScorecard` as a prop down to `PipBar` and the minimized strip.
  - Files to create/modify:
    - Modify `src/App.jsx` — add `todayScorecard` state, fetch function, refresh triggers
  - Acceptance criteria: All three counts fetch correctly; refresh after new entries; passed as prop to PiP components
  - Test command: `npm run build` completes

- [ ] **Task 7: Rebuild MinimizedStrip component**
  - What to build: Replace the existing minimized strip render with a new `MinimizedStrip` component. The strip is always 220×32px with glassmorphism styling (`background: rgba(255,255,255,0.12)`, `backdrop-filter: blur(24px)`, `border: 0.5px solid rgba(255,255,255,0.18)`, `border-radius: 10px`). Layout has three zones:

    **Zone 1 — Logo (left, 32×32px fixed):**
    - `<img src="/meridian-icon-512.png" width="20" height="20" style="object-fit: contain" />`
    - Separated from Zone 2 by a `0.5px solid rgba(255,255,255,0.1)` right border
    - `onClick`: calls `onOpenDashboard()` prop with `stopPropagation`
    - Cursor: pointer

    **Zone 2 — Session (flex: 1, min-width: 0, overflow: hidden):**
    - Full strip (outside logo) `onClick` calls `onRestore()` — this is the restore tap target
    - Content varies by state (see states below)
    - All action buttons inside Zone 2 use `stopPropagation` so they don't trigger restore

    **Zone 3 — Scorecard (right, fixed width ~68px):**
    - Separated from Zone 2 by `0.5px solid rgba(255,255,255,0.2)` left border
    - Always shows three stats left-to-right: resolved (green check icon + count), calls (phone icon + count in `#4da6ff`), process entries (document icon + count in `#94a3b8`)
    - Counts come from `todayScorecard` prop
    - Connection status dot (6×6px) appended after the three stats, color based on `connectionStatus` prop

    **Zone 2 content by state:**

    *Idle (no active case, no active process):*
    - Just the text "idle" in `rgba(255,255,255,0.4)` at 10px — or leave Zone 2 empty

    *Case only (focused case, no process):*
    - Case number in `#E8540A` 10px 500 weight (truncated to fit)
    - Elapsed timer in `rgba(255,255,255,0.85)` tabular-nums
    - Pause/resume icon button (18×18px) pushed to right via `margin-left: auto`

    *Process only (no focused case, active process):*
    - Static blue dot (6×6px, `#4da6ff`) — non-pulsing since no hidden session
    - Process elapsed timer in `#4da6ff` tabular-nums
    - Three 18×18px icon buttons pushed right: pause (blue pause icon), log (blue lines + green plus), discard (red ×)

    *Both active — showing process (process is most recent OR `minimizedStripView === 'process'`):*
    - Pulsing orange dot (6×6px, `#E8540A`, CSS pulse animation) — `onClick` calls `onStripSwap()` with `stopPropagation`
    - Process elapsed timer in `#4da6ff` tabular-nums
    - Three action buttons (same as process-only state)

    *Both active — showing case (case is most recent OR `minimizedStripView === 'case'`):*
    - Pulsing blue dot (6×6px, `#4da6ff`, CSS pulse animation) — `onClick` calls `onStripSwap()` with `stopPropagation`
    - Case number in `#E8540A` truncated
    - Elapsed timer
    - Pause/resume button

    **Pulse animation (inject into PiP window `<head>` style block):**
    ```css
    @keyframes meridian-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.45; transform: scale(0.75); }
    }
    .swap-dot-pulse { animation: meridian-pulse 1.4s ease-in-out infinite; }
    ```

  - Files to create/modify:
    - Create `src/components/MinimizedStrip.jsx`
    - Modify `src/App.jsx` — replace existing minimized strip render with `<MinimizedStrip>`, pass all required props: `focusedCase`, `activeProcess`, `activeStripSession`, `connectionStatus`, `todayScorecard`, `onRestore`, `onOpenDashboard`, `onStripSwap`, `onCasePause`, `onProcessPause`, `onProcessLog`, `onProcessDiscard`
  - Acceptance criteria: All 5 strip states render correctly; logo tap and strip tap are independent; swap dot only appears when both sessions active; action buttons don't trigger restore; scorecard always visible
  - Test command: `npm run build` completes

---

### Phase 3: Process Actions from Minimized Strip

- [ ] **Task 8: Wire process pause/resume from minimized strip**
  - What to build: The pause/resume button in `MinimizedStrip` (Zone 2, process states) should call the existing `handleProcessPause(processId)` / `handleProcessResume(processId)` callbacks in `App.jsx`. Pass these down as `onProcessPause` and `onProcessResume` props. The pause icon should toggle to a play icon when the process is paused. The process dot should turn amber `#fbbf24` when paused.
  - Files to create/modify:
    - Modify `src/components/MinimizedStrip.jsx` — wire pause/resume toggle
    - Modify `src/App.jsx` — pass `onProcessPause` / `onProcessResume` props
  - Acceptance criteria: Pause button stops process timer; resume button restarts it; dot color reflects paused state; no restore triggered
  - Test command: `npm run build` completes

- [ ] **Task 9: Wire process log action from minimized strip**
  - What to build: The log icon button in `MinimizedStrip` should: (1) call `onRestore()` to expand the widget back to full size, and (2) immediately set a new `App.jsx` state flag `pendingProcessLog: true`. When the PiP bar renders after restore and detects `pendingProcessLog === true`, it should immediately open the `ProcessPicker` overlay for the active process (same as if the agent had clicked "Log" from the full bar), then clear the flag.
  - Files to create/modify:
    - Modify `src/App.jsx` — add `pendingProcessLog` state, handle in PiP render effect
    - Modify `src/components/MinimizedStrip.jsx` — log button sets flag then restores
  - Acceptance criteria: Tapping log from minimized strip restores widget and opens category picker immediately; `pendingProcessLog` flag clears after picker opens
  - Test command: `npm run build` completes

- [ ] **Task 10: Wire process discard action from minimized strip**
  - What to build: The discard (×) button in `MinimizedStrip` should call `onProcessDiscard(processId)` which maps to the existing discard/cancel process handler in `App.jsx`. This removes the process from local state without creating an `mpl_entries` row. No confirmation prompt — action fires immediately. Use `stopPropagation` to prevent restore.
  - Files to create/modify:
    - Modify `src/components/MinimizedStrip.jsx` — wire discard button
    - Modify `src/App.jsx` — pass `onProcessDiscard` prop
  - Acceptance criteria: Discard removes process from state; no DB write occurs; widget stays minimized; scorecard process count does not increment
  - Test command: `npm run build` completes

---

### Phase 4: PiP Window Integration & Resize

- [ ] **Task 11: Inject pulse animation CSS into PiP window**
  - What to build: The `meridian-pulse` keyframe animation used by the swap dots in `MinimizedStrip` must be injected into the PiP window's `<head>` — CSS from the host page does not inherit. In `usePipWindow.js`, where the existing `:root` CSS variable `<style>` block is injected into the PiP document head, append the pulse keyframe and `.swap-dot-pulse` class to that same style block.
  - Files to create/modify:
    - Modify `src/hooks/usePipWindow.js`
  - Acceptance criteria: Pulse animation renders correctly inside PiP window; no animation in host page (style is scoped to PiP document)
  - Test command: `npm run build` completes

- [ ] **Task 12: Wire minimized strip into PiP resize logic**
  - What to build: When `isMinimized` is true, `resizeTo(220, 32)` must be called synchronously in the same handler that sets `isMinimized = true` (the minimize button click handler). When restoring (`handleRestore()`), `resizeTo` must be called synchronously with the correct size from `getBarSize()` before clearing `isMinimized`. Verify these resize calls are already synchronous (in event handlers, not `useEffect`). If any resize calls are currently in a `useEffect`, move them to the appropriate synchronous handler. Also ensure `moveTo` is called alongside `resizeTo` to pin the widget to the bottom-right corner (use existing `resizeAndPin` helper if it exists, or create it following the established pattern).
  - Files to create/modify:
    - Modify `src/App.jsx` — audit and fix all minimize/restore resize call sites
    - Modify `src/hooks/usePipWindow.js` if `resizeAndPin` helper needs updating
  - Acceptance criteria: Widget correctly resizes to 220×32 on minimize; correctly resizes back to full size on restore; widget stays anchored to bottom-right through all transitions; no `NotAllowedError` thrown in console
  - Test command: `npm run build` completes; manual verify in browser — no console errors on minimize/restore

---

## Testing Strategy

- Primary: `npm run build` — must complete with zero errors for every task
- Secondary: `npm run dev` — manual visual check of minimized strip in all 5 states
- For Task 12 specifically: open Chrome DevTools console, minimize and restore the widget multiple times — confirm no `NotAllowedError` appears
- No automated test suite exists — Ralph should rely on build success + acceptance criteria checks

---

## Out of Scope

- No changes to the Supabase schema or migrations
- No changes to the dashboard, ActivityLog, or Navbar components
- No settings page UI for scorecard preferences (that is a separate future PRD)
- No changes to the bookmarklet or relay architecture
- No changes to the onboarding flow
- No new npm dependencies
- Do not modify `ct_cases`, `mpl_entries`, or any other Supabase table structure
- Do not change authentication or RLS policies

---

## Notes for Ralph

- **`resizeTo()` is the most dangerous call in this codebase.** It throws `NotAllowedError` if called outside a synchronous user activation context. Never move resize calls into `useEffect`, `setTimeout`, or async functions. If you're unsure whether a call site is synchronous, leave it and flag it in `progress.txt`.
- **All PiP component styles must be inline.** CSS modules, Tailwind, and external stylesheets do not apply inside the PiP window. The only exception is the `<style>` block injected into the PiP document head in `usePipWindow.js` — this is where the pulse animation lives.
- **The logo asset** `meridian-icon-512.png` should already be in the `public/` directory. Use `<img src="/meridian-icon-512.png" />` — do not import it as a module.
- **`stopPropagation` is critical** on every action button inside `MinimizedStrip`. Without it, button taps will bubble up to the strip restore handler and expand the widget unexpectedly.
- **State lives in `App.jsx`** — `MinimizedStrip` is a pure presentational component (props in, callbacks out). Do not add local state to it beyond what's needed for UI-only concerns (e.g. hover state).
- **`todayScorecard` timezone:** Use `America/New_York` for the midnight boundary — this is already the established pattern for daily boundaries in this codebase.
- The existing `handleProcessPause` / `handleProcessResume` / process cancel handlers in `App.jsx` should already exist — find and reuse them rather than creating new ones.
- If `resizeAndPin` helper does not exist yet, create it as a synchronous function that calls both `pipWindow.resizeTo(w, h)` and `pipWindow.moveTo(screenX, screenY)` where `screenX/Y` pins to bottom-right: `screen.availWidth - w - 16` and `screen.availHeight - h - 16`.
