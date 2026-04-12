# Meridian Dual-Widget Split PRD

## Project Overview

Split Meridian's single combined widget into two focused widgets: **CT Widget** (cases only) and **MPL Widget** (manual processes only). Both open via separate bookmarklets, share the same Supabase backend and auth, and write to existing tables. The dashboard unifies data from both.

**Stack:** Vite + React 18, Supabase, Vercel deployment  
**Repo:** Already cloned, working directory is root  
**Success:** Two independently launchable widgets — CT handles case logging, MPL handles process timing/logging — both reachable via bookmarklets, Vite build passes with no errors.

## Architecture & Key Decisions

- **No new dependencies.** Both widgets use existing React, Supabase, Lucide icons.
- **Fork, don't rewrite.** CT widget is a copy of App.jsx with process code stripped. MPL widget is a new streamlined component.
- **Routing via query param.** `?mode=ct-widget` renders CtApp. `?mode=mpl-widget` renders MplApp. Default (no param) renders existing Dashboard/App.
- **Shared components stay shared.** StatButton, MinimizeButton, PipErrorBoundary, CasePill, CategoryDrillDown — these live in `src/components/` and are imported by both widgets.
- **Shared hooks stay shared.** usePipWindow, usePendingTriggers, useStats, useTimer — parameterized where needed.
- **Two bookmarklets.** CT bookmarklet opens `?mode=ct-widget` and runs SF scraping. MPL bookmarklet opens `?mode=mpl-widget` with no scraping.
- **MPL widget has Start button.** Idle state shows Start (timer mode) and Quick Log (manual entry mode). Start begins a timer immediately; category is selected when logging (after timer).
- **Do NOT modify or delete the existing App.jsx or PipBar.jsx.** They remain as the combined fallback. New files are created alongside them.
- **Do NOT modify Supabase schema or RLS policies.** All existing tables and policies are correct.
- **CSS variables are defined in index.css.** Both widgets inherit them. For PiP windows, the `usePipWindow.js` hook already injects `:root` vars into the PiP document head.

## File Structure (Target)

```
src/
├── main.jsx                    ← MODIFY: add routing for ct-widget / mpl-widget modes
├── App.jsx                     ← DO NOT TOUCH (combined fallback)
├── PipBar.jsx                  ← DO NOT TOUCH (combined fallback)
├── ct/
│   ├── CtApp.jsx               ← NEW: CT orchestrator (forked from App.jsx, cases only)
│   └── CtPipBar.jsx            ← NEW: CT bar component (forked from PipBar.jsx, no process UI)
├── mpl/
│   ├── MplApp.jsx              ← NEW: MPL orchestrator (new build, processes only)
│   └── MplPipBar.jsx           ← NEW: MPL bar component with Start/Quick Log buttons
├── components/                 ← shared components (DO NOT MOVE, already correct)
│   ├── StatButton.jsx
│   ├── MinimizeButton.jsx
│   ├── MinimizedStrip.jsx
│   ├── CasePill.jsx
│   ├── ProcessPill.jsx
│   ├── CategoryDrillDown.jsx
│   ├── ManualEntryForm.jsx
│   ├── overlays/ProcessPicker.jsx
│   ├── overlays/RFCPrompt.jsx
│   ├── SwimlaneTray.jsx
│   ├── PillZone.jsx
│   ├── PipErrorBoundary.jsx
│   └── onboarding/Step3Bookmarklet.jsx  ← MODIFY: show two bookmarklets
│   ...
├── hooks/                      ← shared hooks (DO NOT MOVE)
│   ├── usePipWindow.js
│   ├── usePendingTriggers.js
│   ├── useStats.js
│   ├── useTimer.js
│   ...
├── lib/
│   ├── constants.js            ← MODIFY: add CT-specific and MPL-specific size configs
│   ├── supabase.js             ← DO NOT TOUCH
│   └── timezone.js             ← DO NOT TOUCH
```

## Environment & Setup

- Supabase URL and anon key are in `src/lib/supabase.js` — already configured
- Deployment URL: `https://meridian-hlag.vercel.app`
- Build command: `npx vite build`
- No `.env` files needed — keys are hardcoded in supabase.js and bookmarklet

## Tasks

### Phase 1: CT Widget (Cases Only)

- [x] **Task 1: Create CT size constants**
  - What: Add CT-specific height/width configs to `src/lib/constants.js`
  - Add `CT_HEIGHTS` object: `{ minimized: 32, idle: 64, caseActive: 64, bothActive: 64, rfcBanner: 114, trayOpen: 276 }` (no categoryScreen, subcategoryScreen, manualEntryForm, overlay — those are MPL-only)
  - Add `CT_STATE_BASE_WIDTHS` object: same as current `STATE_BASE_WIDTHS` but remove `categoryScreen`, `subcategoryScreen`, `manualEntryForm`, `overlay` keys
  - Add `CT_STAT_BUTTON_WIDTHS`: same as current but remove `processes` key
  - Add `getCtBarWidth(stateKey, statButtons)` and `getCtSizeForState(stateKey, statButtons)` functions following the same pattern as existing ones
  - Keep all existing exports unchanged
  - Files: `src/lib/constants.js`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [x] **Task 2: Create CtPipBar.jsx**
  - What: Fork `src/PipBar.jsx` → `src/ct/CtPipBar.jsx`
  - Remove: `+ Process` button, process-related props (`processes`, `onLogProcess`, `onCloseProcess`, `onNewProcess`, `onProcessPause`, `onProcessResume`, `onProcessLog`, `onProcessDiscard`, `onStartProcess`), process pill rendering from PillZone usage, `processes` stat button from STAT_BUTTON_CONFIG
  - Keep: M° logo, `+ Case` input, case pills via PillZone (pass empty `processes={[]}` to PillZone), stat buttons (resolved, reclass, calls, total), minimize button, connection dot, toast, SnapButton (still hidden with `{false && ...}`), all case-related props
  - The default `stat_buttons` for CT should be `['resolved', 'reclass', 'calls', 'total']` (no 'processes')
  - Import paths: adjust to `../components/PillZone.jsx`, `../components/StatButton.jsx`, etc.
  - Files: Create `src/ct/CtPipBar.jsx`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [x] **Task 3: Create CtApp.jsx — Core shell**
  - What: Fork `src/App.jsx` → `src/ct/CtApp.jsx`
  - This is the largest task. Copy App.jsx, then remove all process-related code:
    - Remove state: `processes`, `pickerPending`, `manualEntryOpen`, `pendingProcessLog`, process-related refs
    - Remove functions: `startProcessTimer`, `stopProcessTimer`, `handleProcessStart`, `handleLogProcess`, `handleProcessLogFromStrip`, `handleCloseProcess`, `handleNewProcess`, `handleManualEntryClose`, `handleManualLog`, `handlePickerConfirm`, `handlePickerScreenChange`, `handlePickerCancel`, `handleProcessPause`, `handleProcessResume`, `handleConfirmProcess`
    - Remove from `syncTimers`: process timer logic (keep case timer logic only)
    - Remove imports: ManualEntryForm, ProcessPicker, CategoryDrillDown
    - Change `getBarMode` to only check cases/tray/rfcBanner (no process conditions)
    - Update `buildPipBar()` to render `CtPipBar` instead of `PipBar`, pass only case-related props
    - Use `getCtSizeForState` from constants instead of `getSizeForState`
    - Keep: all auth logic, case handlers, case timers, RFC flow, swimlane tray, pending trigger handling (but only `handleCaseStart` — replace `handleProcessStart` with a no-op or remove it from usePendingTriggers callback), bar_sessions, localStorage state persistence, connection ping
    - In `usePendingTriggers` call: pass `handleProcessStart: () => {}` (no-op) since CT ignores process triggers
    - The `isWidgetMode` check should look for `mode=ct-widget`: `const isWidgetMode = new URLSearchParams(window.location.search).get('mode') === 'ct-widget'`
    - Import `CtPipBar` from `./CtPipBar.jsx`
    - For the JSX return section (the dashboard fallback when not in widget mode): render a simple centered message like "CT Widget — use bookmarklet to launch" or redirect to root. Actually, in widget mode the JSX return is the widget itself — keep the same pattern as App.jsx's widget mode rendering but with CtPipBar.
  - Files: Create `src/ct/CtApp.jsx`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [x] **Task 4: Wire CT widget routing in main.jsx**
  - What: Modify `src/main.jsx` to check `window.location.search` for `mode=ct-widget` and render `CtApp` instead of `App`
  - Pattern:
    ```jsx
    import App from './App.jsx'
    import CtApp from './ct/CtApp.jsx'
    import MplApp from './mpl/MplApp.jsx'  // will exist after Phase 2
    
    const mode = new URLSearchParams(window.location.search).get('mode')
    const Root = mode === 'ct-widget' ? CtApp
               : mode === 'mpl-widget' ? MplApp
               : App
    
    createRoot(document.getElementById('root')).render(
      <StrictMode><Root /></StrictMode>
    )
    ```
  - Since MplApp doesn't exist yet, create a temporary placeholder: `src/mpl/MplApp.jsx` that exports a simple `function MplApp() { return <div>MPL Widget — coming soon</div> }` so the import doesn't break the build.
  - Files: Modify `src/main.jsx`, create `src/mpl/MplApp.jsx` (placeholder)
  - Test: `npx vite build 2>&1 | tail -8` — no errors

### Phase 2: MPL Widget (Processes Only)

- [x] **Task 5: Create MPL size constants**
  - What: Add MPL-specific height/width configs to `src/lib/constants.js`
  - Add `MPL_HEIGHTS`: `{ minimized: 32, idle: 100, timerActive: 140, categoryPicker: 480, manualEntry: 480 }`
  - Add `MPL_STATE_BASE_WIDTHS`: `{ idle: 160, timerActive: 200, categoryPicker: 200, manualEntry: 200 }`
  - Add `MPL_STAT_BUTTON_WIDTHS`: `{ processes: 114, total: 90 }` (MPL only shows process count and total)
  - Add `getMplBarWidth(stateKey, statButtons)` and `getMplSizeForState(stateKey, statButtons)` functions
  - MPL widget width should be 400px for all states (use 400 as fixed width, or base 200 + stat buttons)
  - Files: `src/lib/constants.js`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [x] **Task 6: Create MplPipBar.jsx**
  - What: Build a new bar component for the MPL widget from scratch (NOT a fork of PipBar.jsx — it's different enough)
  - **Idle state** (no active timer): Shows M° logo, **Start** button (blue, prominent), **Quick Log** button (secondary), process count stat, connection dot, minimize button
  - **Timer running state**: Shows M° logo, active process pill with elapsed timer (blue pill, mm:ss format), **Log** button (blue, triggers category picker), **Discard** button (subtle), process count stat, connection dot, minimize button
  - **Category picker / manual entry state**: The bar area stays the same, but `children` slot expands below with CategoryDrillDown or ManualEntryForm
  - Props:
    ```
    activeProcess       — { id, elapsed, paused } or null
    processCount        — number (today's completed processes)
    mplState            — 'idle' | 'timerActive' | 'categoryPicker' | 'manualEntry'
    onOpenDashboard     — click M° logo
    onStart             — click Start button (begins timer)
    onQuickLog          — click Quick Log button (opens manual entry)
    onLog               — click Log button (opens category picker for active timer)
    onDiscard           — click Discard button
    onPause             — pause active process
    onResume            — resume paused process
    onMinimize          — minimize to strip
    onRestore           — restore from strip
    isMinimized         — boolean
    connectionStatus    — 'connected' | 'degraded' | 'offline'
    pipToast            — string or null
    children            — overlay/picker slot
    ```
  - Styling: Use same design tokens from `src/lib/constants.js` (`C` object). Blue accent (`C.process` / `C.processNavy`) as primary color. Same dark background, same font family.
  - **Start button**: Height 28px, padding 0 14px, borderRadius 14, background `rgba(96,165,250,0.15)`, border `1px solid rgba(96,165,250,0.3)`, color `#60a5fa`, fontSize 11, fontWeight 700, text "▶ Start"
  - **Quick Log button**: Same dimensions but more subtle — background transparent, border `1px solid var(--border)`, color `var(--text-sec)`, text "Quick Log"
  - **Log button** (when timer active): Same style as Start but text "Log" 
  - **Discard button**: background none, border none, color `var(--text-dim)`, fontSize 10, text "✕"
  - **Active process pill**: Same style as existing ProcessPill component but inline in the bar — blue dot + mm:ss elapsed time
  - Files: Create `src/mpl/MplPipBar.jsx`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [x] **Task 7: Create MplApp.jsx — Full implementation**
  - What: Replace the placeholder `src/mpl/MplApp.jsx` with the full MPL orchestrator
  - This is a NEW component, not a fork of App.jsx. It's much simpler because it only handles processes.
  - **State:**
    - `user`, `profile`, `authLoading` — same auth pattern as App.jsx (copy the auth useEffect)
    - `activeProcess` — `{ id, elapsed, paused } | null` — only ONE active process at a time (simpler than App.jsx which supports multiple)
    - `mplState` — `'idle' | 'timerActive' | 'categoryPicker' | 'manualEntry'`
    - `categories` — fetched from `mpl_categories` + `mpl_subcategories` (same query as App.jsx)
    - `processCount` — today's completed process count
    - `isMinimized`, `connectionStatus`, `pipToast`
  - **Timer:** Single `useRef` interval. `startTimer()` increments `activeProcess.elapsed` every second. `stopTimer()` clears interval.
  - **Key handlers:**
    - `handleStart()` — creates `activeProcess = { id: crypto.randomUUID(), elapsed: 0, paused: false }`, starts timer, sets `mplState = 'timerActive'`, resizes window
    - `handleQuickLog()` — sets `mplState = 'manualEntry'`, resizes window to 480 height. No timer started.
    - `handleLog()` — stops timer, sets `mplState = 'categoryPicker'`, resizes window to 480 height
    - `handleDiscard()` — stops timer, sets `activeProcess = null`, `mplState = 'idle'`, resizes window
    - `handlePickerConfirm(categoryId, subcategoryId, durationSeconds)` — writes to `mpl_activity_log`, increments `processCount`, resets to idle
    - `handleManualLog(categoryId, subcategoryId, minutes)` — writes to `mpl_activity_log` with `source: 'manual'` and `duration_s: minutes * 60`, increments `processCount`, resets to idle
    - `handlePause()` / `handleResume()` — pause/resume timer
  - **Widget mode:** Same pattern as App.jsx — checks `?mode=mpl-widget`. In widget mode, renders MplPipBar directly in the page. In non-widget mode, uses PiP via `usePipWindow` hook.
  - **Realtime:** Subscribe to `pending_triggers` for `MERIDIAN_PROCESS_START` type only — call `handleStart()`. Use `usePendingTriggers` hook but pass `handleCaseStart: () => {}` (no-op).
  - **Writing to mpl_activity_log:** Insert with fields: `user_id`, `category_id`, `subcategory_id`, `duration_s`, `source` ('timer' or 'manual'), `entry_date` (NY timezone date string), `created_at` (auto)
  - **Category fetching:** On auth, fetch categories the same way App.jsx does — query `mpl_categories` with `mpl_subcategories(*)` join, filtered by the user's team haulage_type from `profile.team` or the team's `haulage_type`. Check how App.jsx currently fetches categories and replicate that exact query.
  - **Connection ping:** Same 30s pattern as App.jsx
  - **Sizing:** Use `getMplSizeForState` from constants. Resize via `window.resizeTo()` in widget mode (same pattern as App.jsx's `pin()` function).
  - **JSX structure when in widget mode:**
    ```jsx
    <MplPipBar ...props>
      {mplState === 'categoryPicker' && <ProcessPicker ... />}
      {mplState === 'manualEntry' && <ManualEntryForm ... />}
    </MplPipBar>
    ```
  - Files: Replace `src/mpl/MplApp.jsx`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

### Phase 3: Bookmarklets & Onboarding

- [x] **Task 8: Create MPL bookmarklet builder function**
  - What: Create a helper function `buildMplBmHref(userId)` in `src/components/onboarding/Step3Bookmarklet.jsx`
  - The MPL bookmarklet is much simpler than the CT bookmarklet:
    1. Opens `https://meridian-hlag.vercel.app?mode=mpl-widget` as a popup window named `meridian-mpl` with `width=400,height=100,top=0,left=<screen.availWidth - 416>`
    2. Inserts a `pending_triggers` row with type `MERIDIAN_PROCESS_START` via direct fetch to Supabase REST (same anon key pattern as the non-SF path in the existing bookmarklet)
    3. Shows a toast on the page: "✓ Meridian — Process widget opened"
    4. No relay iframe needed. No DOM scraping. No SF detection.
  - The full bookmarklet code (minified into the href):
    ```javascript
    javascript:(function(){
      window.open('https://meridian-hlag.vercel.app?mode=mpl-widget','meridian-mpl','popup,width=400,height=100,top=0,left='+(screen.availWidth-416));
      var SUPABASE_URL='https://wluynppocsoqjdbmwass.supabase.co';
      var ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsdXlucHBvY3NvcWpkYm13YXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDU4NzIsImV4cCI6MjA4ODIyMTg3Mn0.x9-t_038hz4eJUciA1F9-DWE8UN_V58KE0i43cpOAMk';
      var USER_ID='${userId}';
      fetch(SUPABASE_URL+'/rest/v1/pending_triggers',{method:'POST',headers:{'apikey':ANON_KEY,'Authorization':'Bearer '+ANON_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({user_id:USER_ID,type:'MERIDIAN_PROCESS_START',page_url:window.location.href})}).catch(function(err){console.error('[Meridian]',err)});
      try{var et=document.getElementById('meridian-toast');if(et)et.remove();var t=document.createElement('div');t.id='meridian-toast';t.textContent='\u2713 Meridian \u2014 Process widget opened';t.style.cssText='position:fixed;bottom:24px;right:24px;background:#003087;color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;font-family:"Segoe UI",sans-serif;z-index:2147483647;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.3);border-left:3px solid #60a5fa;transition:opacity 300ms';document.body.appendChild(t);setTimeout(function(){t.style.opacity='0'},2200);setTimeout(function(){t.remove()},2500)}catch(e){}
    })();
    ```
  - This must be minified into a single line (no newlines) in the href attribute, same as the existing CT bookmarklet.
  - Files: Modify `src/components/onboarding/Step3Bookmarklet.jsx`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [x] **Task 9: Update CT bookmarklet to open CT widget specifically**
  - What: Modify `buildBmHref(userId)` in `src/components/onboarding/Step3Bookmarklet.jsx`
  - Change the `window.open` URL from `https://meridian-hlag.vercel.app?mode=widget` to `https://meridian-hlag.vercel.app?mode=ct-widget`
  - Change the popup window name from `meridian-widget` to `meridian-ct`
  - Everything else stays the same — relay iframe for SF, direct fetch for non-SF, SF DOM scraping
  - Also update the non-SF branch: currently it sends `type:'MERIDIAN_PROCESS_START'` for non-SF pages. Change this to `type:'MERIDIAN_CASE_START'` since the CT bookmarklet should always trigger case behavior. Actually — on non-SF pages the CT bookmarklet should just open the CT widget without triggering anything specific. Change the non-SF `fetch` to not insert a pending_trigger at all — just open the popup. The agent can use the `+ Case` button in the widget to manually enter a case number.
  - So for non-SF pages: just `window.open(...)` + toast. Remove the `fetch()` call from the `else` branch.
  - Rename the existing function from `buildBmHref` to `buildCtBmHref` for clarity
  - Files: Modify `src/components/onboarding/Step3Bookmarklet.jsx`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [x] **Task 10: Update onboarding Step 3 to show two bookmarklets**
  - What: Modify the JSX in `Step3Bookmarklet.jsx` to show both bookmarklets
  - Show two draggable anchors:
    1. **"⚡ Cases"** — orange background (#E8540A), uses `buildCtBmHref(userId)`
    2. **"⚡ Processes"** — blue background (#4a90d9), uses `buildMplBmHref(userId)`
  - Side by side in a flex row with gap 12
  - Update instruction step 3 text to: "Drag both buttons to your bookmarks bar. Use Cases on Salesforce pages, Processes for manual work tracking."
  - Files: Modify `src/components/onboarding/Step3Bookmarklet.jsx`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

### Phase 4: Dashboard Integration

- [x] **Task 11: Add dual launch buttons to Dashboard**
  - What: Modify `src/components/Dashboard.jsx`
  - Find the existing "Launch Widget" button/section
  - Replace with two buttons side by side:
    1. **"Launch Cases"** — orange accent, opens `?mode=ct-widget` as popup (same pattern as existing launch)
    2. **"Launch Processes"** — blue accent, opens `?mode=mpl-widget` as popup
  - Both use `window.open()` with appropriate dimensions (CT: 600×64, MPL: 400×100)
  - Files: Modify `src/components/Dashboard.jsx`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [ ] **Task 12: Final build verification**
  - What: Run `npx vite build` and verify zero errors, zero warnings
  - Check that all imports resolve correctly
  - Check that no circular dependencies exist
  - If any issues found, fix them
  - Files: Any files with issues
  - Test: `npx vite build 2>&1 | tail -8` — clean build with no errors or warnings

## Testing Strategy

- Primary: `npx vite build 2>&1 | tail -8` — must show "built in Xs" with no errors
- Secondary: `grep -r "from '.*App'" src/ct/ src/mpl/` to verify import paths are correct
- Sanity check: `grep -rn "handleProcessStart\|handleLogProcess\|ManualEntryForm\|ProcessPicker" src/ct/` should return zero results (no process code in CT)
- Sanity check: `grep -rn "handleCaseStart\|handleResolve\|handleReclass\|RFCPrompt\|SwimlaneTray" src/mpl/` should return zero results (no case code in MPL)

## Out of Scope

- No Supabase schema changes
- No RLS policy changes
- No new npm dependencies
- No changes to `src/App.jsx` or `src/PipBar.jsx` (preserved as combined fallback)
- No changes to `public/meridian-relay.html` or `public/meridian-trigger.js`
- No PiP mode for MPL widget (popup only for now — PiP can be added later)
- No supervisor dashboard / Insights work
- No role hierarchy schema changes
- No Salesforce API integration
- No CSS variable changes in index.css
- No widget corner snapping work

## Notes for Ralph

### Critical patterns already in the codebase:

1. **Widget mode detection:** `const isWidgetMode = new URLSearchParams(window.location.search).get('mode') === 'widget'` — the CT widget should check for `'ct-widget'`, MPL for `'mpl-widget'`

2. **PiP window CSS vars:** The `usePipWindow.js` hook injects CSS variables into the PiP window's `<head>`. Both widgets inherit this if using PiP mode. For popup/widget mode, vars come from index.css.

3. **`resizeTo()` requires user activation:** Cannot call from useEffect or async callbacks. The `pin()` function in App.jsx handles this — replicate the pattern but don't expect it to always succeed from Realtime callbacks.

4. **Supabase anon key RLS:** The bookmarklet uses the anon key. `pending_triggers` has RLS policies that allow anon inserts with `WITH CHECK (true)`. Don't change RLS.

5. **`Prefer: return=minimal`:** Bookmarklet fetches to Supabase must use this header. `return=representation` causes 401 for anon role.

6. **Category fetching pattern:** Look at how App.jsx fetches categories around line 390-410. The query joins `mpl_categories` with `mpl_subcategories`. The haulage type filter comes from the user's team. Replicate this exact query in MplApp.jsx.

7. **Activity log writes:** When logging a process, write to `mpl_activity_log` table. Check existing `handleManualLog` and `handleConfirmProcess` in App.jsx (around lines 1045-1090) for the exact column names and patterns.

8. **New York timezone dates:** Always use `getNewYorkDateKey()` from `src/lib/timezone.js` for `entry_date` values.

9. **Import paths from ct/ and mpl/ subdirectories:** Components are at `../components/X.jsx`, hooks at `../hooks/X.js`, lib at `../lib/X.js`.

10. **The ManualEntryForm component** expects `categories` array and calls `onLog(categoryId, subcategoryId, minutes)`. The ProcessPicker expects `categories`, `elapsed`, and calls `onConfirm(categoryId, subcategoryId, durationSeconds)`. Both are in `src/components/`.

11. **Bar session tracking:** The `bar_sessions` table tracks when a widget is opened/closed. App.jsx has `createBarSession()` around line 224. CT widget should replicate this. MPL widget should too but can be simpler.

12. **`body.widget-mode` class:** App.jsx adds this to document.body when in widget mode (check around line 290-300). Both CT and MPL widgets should do the same.

13. **Process timer is client-side only:** Unlike cases (which are persisted to `ct_cases` on start), process timers only exist in React state until the agent logs them. The elapsed time is passed to `mpl_activity_log.duration_s` on log. MplApp should follow this same pattern — no `mpl_sessions` table write on Start, only write to `mpl_activity_log` on Log.
