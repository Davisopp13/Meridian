# Meridian: MPL Separation PRD

## Project Overview

Separate the Manual Process Logger (MPL) from the Case Tracker widget into its own standalone surface. Currently both CT and MPL share one PipBar widget, making it overcrowded and confusing. After this work, CT keeps its existing PiP widget (unchanged) and MPL gets its own dedicated page accessible via `?mode=mpl`. Both tools share the same Supabase backend, auth, and dashboard. This is a Vite + React 18 app with Supabase backend, inline styles, no TypeScript.

## Architecture & Key Decisions

- **Framework:** Vite + React 18, no TypeScript, inline styles using `C` color tokens from `src/lib/constants.js`
- **Database:** Supabase — MPL writes to `mpl_entries` table, calls write to `case_events` table with `session_id: null`
- **Mode detection:** `?mode=mpl` URL parameter detected in App.jsx, similar to existing `?mode=widget` pattern
- **The CT PiP widget (PipBar.jsx) must NOT change** — James and Carlos are daily users. Do not modify any CT-specific code paths.
- **Reuse existing components:** `CategoryDrillDown.jsx`, `ManualEntryForm.jsx`, and `ProcessPicker.jsx` are used by the new MPL widget. Do not duplicate them — import them.
- **Styling:** Dark theme, `#0f1117` background, Segoe UI / Inter font stack, 8px grid. Use `C` tokens from constants.js for all colors.
- **Stats hook:** Reuse `useStats()` from `src/hooks/useStats.js` — it already counts processes and calls.

## Environment & Setup

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in `.env.local`
- Supabase tables `mpl_entries`, `mpl_categories`, `mpl_subcategories`, `case_events`, `platform_users` already exist
- `mpl_categories` has columns: `id`, `name`, `team`, `is_active`, `display_order`, with related `mpl_subcategories`
- `case_events` supports `session_id: null` for calls not associated with a case
- No new npm dependencies needed

## Tasks

### Phase 1: Create the MPL Widget Component

- [x] **Task 1: Create MplWidget.jsx**
  - What to build: Create `src/components/MplWidget.jsx` — a standalone, full-page MPL interface. This is the primary deliverable.
  - **Layout:** Full viewport height, dark background (`#0f1117`). Two zones:
    - **Top bar (60px):** Meridian icon (links to dashboard), active timer pill (if running), current category label, Log Call button, stats display (processes count, calls count), connection status dot
    - **Main area (fills remaining space):** Shows either the idle state, active timer state, or category picker
  - **States:**
    - **Idle:** Shows a prominent "Start Timer" button and a "Manual Entry" button. Also shows today's process count and call count.
    - **Timer running:** Shows the elapsed timer, a "Log" button (opens category picker), a "Pause" button, and a "Discard" button
    - **Category picker open:** Shows the `CategoryDrillDown` component for selecting category/subcategory. When selected, logs the entry and returns to idle.
    - **Manual entry:** Shows the `ManualEntryForm` component (duration chips + category selection). When complete, returns to idle.
  - **Log Call button:** Always visible in the top bar. Clicking it inserts to `case_events` with `{ user_id, type: 'call', session_id: null, excluded: false, rfc: false }` and shows a brief confirmation. Increments the calls stat.
  - **Props:** `user`, `profile`, `categories`, `stats` (from useStats), `refetch` (to refresh stats after logging), `onLog` (async function for timer-based entries), `onManualLog` (async function for manual entries), `onCall` (async function for call logging)
  - **Internal state:** `timerRunning` (bool), `elapsed` (seconds), `paused` (bool), `showPicker` (bool), `showManualEntry` (bool)
  - **Timer:** Use `setInterval` for the timer, same pattern as App.jsx's `startProcessTimer`/`stopProcessTimer`. Timer is local state — no Supabase row created until the entry is logged.
  - **Logging:** When category is selected (from picker or manual entry), call the `onLog` prop with `(categoryId, subcategoryId, minutes, source)`. The parent (App.jsx) handles the Supabase insert.
  - Files to create: `src/components/MplWidget.jsx`
  - Acceptance criteria: Component renders all states (idle, timer, picker, manual entry). Log Call button is present. Build passes.
  - Test command: `npm run build` completes with 0 errors

- [ ] **Task 2: Style the MplWidget top bar**
  - What to build: Polish the top bar to match the Meridian design system. It should feel like a sibling of the PipBar — same visual language but focused on MPL.
  - **Top bar layout (left to right):**
    - Meridian icon (32x32, rounded 8px, clickable — opens dashboard via `window.open(origin, 'meridian-dashboard')`)
    - Vertical divider (1px, `C.divider`)
    - Timer pill (when timer is running): shows `● HH:MM:SS` with process blue accent (`C.process`), includes Pause/Resume toggle
    - Category label (when timer is running and category pre-selected): shows the category name in `C.process` color
    - Flex spacer
    - Log Call button: phone icon + "N Calls" label, blue accent (`C.calls`), always enabled
    - Process stat: "N Processes" with process color
    - Connection status dot (6px circle, green when connected)
  - **Timer pill styling:**
    - Running: `background: rgba(96,165,250,0.12)`, `border: 1px solid rgba(96,165,250,0.3)`, white text
    - Paused: `background: rgba(245,158,11,0.12)`, `border: 1px solid rgba(245,158,11,0.3)`, amber text
  - Use inline styles with `C` token references. Match the 60px bar height, 12px horizontal padding, 8px gap pattern from PipBar.
  - Files to modify: `src/components/MplWidget.jsx`
  - Acceptance criteria: Top bar visually matches Meridian design system. Timer pill changes appearance when paused vs running.
  - Test command: `npm run build` completes with 0 errors

- [ ] **Task 3: Implement timer logic in MplWidget**
  - What to build: Add start/pause/resume/discard timer functionality using local state and `setInterval`.
  - **Start:** Set `timerRunning = true`, `elapsed = 0`, `paused = false`. Start interval that increments `elapsed` every second.
  - **Pause:** Set `paused = true`. Clear the interval but keep `elapsed` value.
  - **Resume:** Set `paused = false`. Restart the interval from current `elapsed`.
  - **Discard:** Clear interval, reset all timer state to idle.
  - **Log (opens picker):** Set `showPicker = true`. The picker component receives `elapsed` and handles category selection.
  - Use `useRef` for the interval ID to avoid stale closures. Clean up interval on unmount via `useEffect` return.
  - Timer display: Use `formatElapsed` from `src/lib/constants.js`.
  - Files to modify: `src/components/MplWidget.jsx`
  - Acceptance criteria: Timer starts, pauses, resumes, and discards correctly. Elapsed time displays formatted. Interval is cleaned up on unmount.
  - Test command: `npm run build` completes with 0 errors

- [ ] **Task 4: Integrate CategoryDrillDown and ManualEntryForm**
  - What to build: Wire the category picker and manual entry form into MplWidget's main area.
  - **When `showPicker` is true:** Render `ProcessPicker` component below the top bar, passing `categories`, `elapsed`, `onConfirm`, `onCancel`, and `onScreenChange`. The `onConfirm` callback receives `(categoryId, subcategoryId, durationSeconds)` — convert to minutes via `Math.round(durationSeconds / 60) || 1`, call `onLog(categoryId, subcategoryId, minutes, 'mpl_timer')`, then reset timer state to idle. Set `showPicker = false`, `timerRunning = false`, `elapsed = 0`.
  - **When `showManualEntry` is true:** Render `ManualEntryForm` below the top bar, passing `categories`, `onClose` (sets `showManualEntry = false`), and `onLog` (receives `(categoryId, subcategoryId, minutes)` — call `onManualLog(categoryId, subcategoryId, minutes)`, then set `showManualEntry = false`).
  - **The main area** should use `flex: 1, minHeight: 0, overflow: hidden` so the picker/form fills available space below the 60px top bar.
  - When neither picker nor manual entry is open, show the idle state with "Start Timer" and "Manual Entry" buttons.
  - Files to modify: `src/components/MplWidget.jsx`
  - Acceptance criteria: Category picker opens when Log is clicked on running timer. Manual entry form opens from idle. Both correctly log entries via props. State resets to idle after logging.
  - Test command: `npm run build` completes with 0 errors

### Phase 2: Wire MPL Mode into App.jsx

- [ ] **Task 5: Add isMplMode detection and render branch**
  - What to build: In `src/App.jsx`, detect `?mode=mpl` in the URL and render MplWidget instead of Dashboard.
  - **Add near the existing `isWidgetMode` detection** (around line 92):
    ```javascript
    const isMplMode = new URLSearchParams(window.location.search).get('mode') === 'mpl'
    ```
  - **Add an MPL init effect** (similar to the widget init effect around line 286):
    ```javascript
    const mplInitRef = useRef(false)
    useEffect(() => {
      if (!isMplMode) return
      if (authLoading || !user || !profile?.onboarding_complete) return
      if (mplInitRef.current) return
      mplInitRef.current = true
      document.body.classList.add('widget-mode')
    }, [isMplMode, authLoading, user, profile])
    ```
  - **Add render branch** — BEFORE the `isWidgetMode` check and BEFORE the Dashboard return, add:
    ```jsx
    if (isMplMode) {
      return (
        <div style={{
          width: '100%',
          height: '100vh',
          background: '#0f1117',
          overflow: 'hidden',
          fontFamily: '"Inter", system-ui, sans-serif',
        }}>
          <MplWidget
            user={user}
            profile={profile}
            categories={categories}
            stats={stats}
            refetch={refetch}
            onLog={async (categoryId, subcategoryId, minutes, source) => {
              await safeWrite(supabase.from('mpl_entries').insert({
                user_id: user.id,
                category_id: categoryId,
                subcategory_id: subcategoryId,
                minutes,
                source: source || 'mpl_widget',
              }))
              refetch()
            }}
            onManualLog={async (categoryId, subcategoryId, minutes) => {
              await safeWrite(supabase.from('mpl_entries').insert({
                user_id: user.id,
                category_id: categoryId,
                subcategory_id: subcategoryId,
                minutes,
                source: 'manual',
              }))
              refetch()
            }}
            onCall={async () => {
              await safeWrite(supabase.from('case_events').insert({
                session_id: null,
                user_id: user.id,
                type: 'call',
                excluded: false,
                rfc: false,
              }))
              refetch()
            }}
          />
        </div>
      )
    }
    ```
  - **Add import** at the top of App.jsx: `import MplWidget from './components/MplWidget.jsx'`
  - Files to modify: `src/App.jsx`
  - Acceptance criteria: Navigating to `?mode=mpl` renders MplWidget. Auth works (shared session). Categories load based on profile team. Build passes.
  - Test command: `npm run build` completes with 0 errors

- [ ] **Task 6: Add MPL bookmarklet entry point**
  - What to build: Update the bookmarklet screens so agents have a way to launch MPL.
  - **In `src/components/onboarding/Step3Bookmarklet.jsx`:** Add a second bookmarklet anchor below the existing CT one. This one opens `?mode=mpl`:
    ```javascript
    const mplBmHref = `javascript:(function(){window.open('https://meridian-hlag.vercel.app?mode=mpl','meridian-mpl');})();`;
    ```
    Render as a second draggable button with blue (`#3b82f6`) background:
    ```jsx
    <a href={mplBmHref} draggable="true" style={{
      display: 'inline-block', background: '#3b82f6', color: '#fff',
      fontWeight: 700, fontSize: 14, padding: '10px 24px', borderRadius: 20,
      cursor: 'grab', userSelect: 'none', textDecoration: 'none',
    }} onClick={e => e.preventDefault()}>
      📋 MPL — Log Process
    </a>
    ```
    Place it in a flex row next to the existing bookmarklet with `gap: 12px`.
  - **In `src/components/BookmarkletModal.jsx`:** Same second bookmarklet anchor.
  - **Update instruction text** in both files:
    - Step 3: `'Click "Meridian — Log" on Salesforce to log cases. Click "MPL — Log Process" to time manual work.'`
  - Files to modify: `src/components/onboarding/Step3Bookmarklet.jsx`, `src/components/BookmarkletModal.jsx`
  - Acceptance criteria: Both bookmarklet anchors render. CT bookmarklet unchanged. MPL bookmarklet opens `?mode=mpl`. Build passes.
  - Test command: `npm run build` completes with 0 errors

### Phase 3: Clean Up PipBar (CT-only)

- [ ] **Task 7: Remove process UI from PipBar**
  - What to build: Remove the `+ Process` button from PipBar since MPL now has its own surface. Take a conservative approach — minimize changes to PipBar.jsx.
  - **In `src/PipBar.jsx`:** Remove ONLY the `+ Process` button JSX (the button with text "+ Process" and `onClick={() => onStartProcess && onStartProcess()}`). Keep the `+ Case` button. Keep all props in the function signature — just don't render the process button.
  - **In `src/App.jsx` `buildPipBar()` function:** Change `processes={processes}` to `processes={[]}` so no process pills render in the CT widget. This is the safest approach — PipBar.jsx still accepts the prop but receives an empty array.
  - **In `src/lib/constants.js`:** Change `DEFAULT_SETTINGS.stat_buttons` from `['resolved', 'reclass', 'calls', 'processes', 'total']` to `['resolved', 'reclass', 'calls', 'total']`.
  - **DO NOT** remove process props from PipBar's function signature. DO NOT refactor PillZone.jsx or SwimlaneTray.jsx. Just stop passing process data and remove the + Process button UI.
  - Files to modify: `src/PipBar.jsx` (remove + Process button only), `src/App.jsx` (change processes prop in buildPipBar), `src/lib/constants.js` (update DEFAULT_SETTINGS)
  - Acceptance criteria: PipBar renders case-only UI. No + Process button. No process pills. Stat buttons show resolved, reclass, calls, total. Build passes.
  - Test command: `npm run build` completes with 0 errors

## Testing Strategy

- Primary: `npm run build` completes with 0 errors after each task
- Every task must pass build before being marked complete
- Do NOT attempt to run `npm run dev` or start a dev server — just verify the build

## Out of Scope

- No Supabase schema changes (tables already exist)
- No changes to the Dashboard component
- No changes to the activity log or edit feature
- No changes to the auth flow
- No changes to `usePipWindow.js` or the Document PiP API
- No changes to `meridian-trigger.js` or `meridian-relay.html`
- No CSS framework changes (keep inline styles)
- Do NOT add react-router or any routing library
- Do NOT create separate Vite entry points
- Do NOT modify existing handler functions in App.jsx (handleProcessStart, handlePickerConfirm, etc.) — MPL mode defines its own handlers via props
- Do NOT touch CaseLaneRow.jsx, CasePill.jsx, CasesLane.jsx, RFCPrompt.jsx, or any CT-specific component

## Notes for Ralph

- **Import paths:** Components are in `src/components/`. Hooks are in `src/hooks/`. Constants in `src/lib/constants.js`. Supabase client in `src/lib/supabase.js`.
- **Color tokens:** Always use `C.xxx` from constants.js. Never hardcode hex in components. Exception: background colors like `#0f1117` for page-level backgrounds are OK.
- **`formatElapsed(seconds)`:** Exported from `src/lib/constants.js`. Returns `MM:SS` format string.
- **`categories` array shape:** `[{ id, name, team, display_order, mpl_subcategories: [{ id, name, display_order }] }]`
- **`mpl_entries` insert shape:** `{ user_id, category_id, subcategory_id, minutes, source }` — `subcategory_id` can be null.
- **`case_events` call insert shape:** `{ session_id: null, user_id, type: 'call', excluded: false, rfc: false }`
- **The `?mode=widget` path already exists** — check how it's implemented (around line 92 and line 1336 in App.jsx) and follow the exact same pattern for `?mode=mpl`.
- **ProcessPicker props:** `{ categories, elapsed, onConfirm, onCancel, onScreenChange }`. `onConfirm` is called with `(categoryId, subcategoryId, durationSeconds)`.
- **ManualEntryForm props:** `{ categories, onClose, onLog }`. `onLog` is called with `(categoryId, subcategoryId, minutes)`.
- **Use lucide-react for icons** — it's already a dependency. Import like: `import { Phone, Play, Pause, Square, Clock, Plus } from 'lucide-react'`
- **PipBar.jsx uses `useState`** for local state (case input). When removing the + Process button, only remove that specific JSX block. Don't restructure the component.
- **The `safeWrite` function** is defined in App.jsx and shows error toasts. All Supabase writes in the MPL render branch should use it via the inline async functions passed as props.
