# Meridian MPL — Crash Recovery PRD

## Project Overview

Add crash recovery to Meridian MPL so agents don't lose active Process timers when the PiP window is killed unexpectedly (Windows Update, browser crash, tab close, accidental X). Incident source: Carlos Cuba, 4/20/26 — Windows Update force-closed the PiP mid-session and the active timer + category were lost.

Currently MPL timer state lives only in React memory inside `MplApp.jsx`. When the PiP window closes, the interval refs and the `processes` array are gone. This PRD adds four layers of persistence so a killed session can always be recovered: localStorage snapshot on every tick, debounced `mpl_active_timers` upsert, `bar_sessions` heartbeat for stale-session detection, and a `beforeunload` sendBeacon flush.

Success = Carlos can have his PiP force-closed mid-timer, reopen it, and see a "Resume / Log now / Discard" prompt with his accumulated time intact.

---

## Architecture & Key Decisions

- **Framework**: Vite + React 18 (do not change)
- **State target file**: `src/mpl/MplApp.jsx` — this is the MPL orchestrator; all process state lives here
- **DO NOT TOUCH**: `src/App.jsx`, `src/PipBar.jsx` (legacy fallbacks), `src/ct/*` (CT widget — this PRD is MPL-only), `src/hooks/useTimer.js` (used elsewhere; do not modify its signature)
- **Storage hierarchy** (fastest → most durable):
  1. React state (`processes` array in `MplApp.jsx`) — existing, unchanged
  2. `localStorage` under key `meridian.mpl.active.v1` — NEW, written every tick
  3. `mpl_active_timers` Supabase table — NEW writes every 10s (table already exists)
  4. `bar_sessions` heartbeat — NEW, every 30s
- **Recovery order on mount**: localStorage first (instant, most recent), then Supabase fallback (survives machine death)
- **Staleness threshold**: `bar_sessions.last_seen_at` older than 5 minutes = crash detected
- **Debounce, don't hammer**: Supabase writes are debounced at 10s intervals (not every second) to respect quota
- **Optimistic recovery**: restore timer state immediately from localStorage on mount; verify against Supabase async
- **All new code is additive** — no refactors of existing working paths
- **No new npm packages** — use browser APIs only (`localStorage`, `navigator.sendBeacon`)

---

## Environment & Setup

- Supabase client: `src/lib/supabase.js` (already configured)
- Meridian Supabase project ref: `wluynppocsoqjdbmwass`
- MPL table: `mpl_active_timers` (exists, currently has at least: `id`, `user_id`, `category_id` nullable, `started_at`, `status`, `total_paused_seconds`)
- Build command: `npx vite build`
- Typecheck: there is no separate tsc step — this is a JS project; `npx vite build` is the verification
- Deployment: `meridian-hlag.vercel.app` (auto-deploys on push to `main`)

---

## File Structure Impact

```
src/
├── mpl/
│   ├── MplApp.jsx              ← MODIFY: integrate useMplRecovery, call snapshot on process changes
│   ├── MplPipBar.jsx           ← MODIFY: render <RecoveryPrompt /> when recovery state is set
│   └── RecoveryPrompt.jsx      ← NEW: Resume / Log now / Discard UI
├── hooks/
│   ├── useMplRecovery.js       ← NEW: localStorage snapshot + Supabase sync + recovery detection
│   └── useBarHeartbeat.js      ← NEW: pings bar_sessions every 30s
├── lib/
│   ├── mplRecoveryStorage.js   ← NEW: localStorage read/write helpers + schema versioning
│   └── api.js                  ← MODIFY: add upsertMplActiveTimer, clearMplActiveTimer, pingBarSession
supabase/
└── migrations/
    └── 009_mpl_crash_recovery.sql  ← NEW: ensure mpl_active_timers has the columns we need + bar_sessions.last_seen_at
```

---

## Tasks

### Phase 1: Schema verification + migration

- [x] **Task 1: Verify + migrate `mpl_active_timers` schema**
  - What: Create `supabase/migrations/009_mpl_crash_recovery.sql` that adds any missing columns needed by this PRD.
  - Required columns on `mpl_active_timers`:
    - `id` uuid PK (exists)
    - `user_id` uuid FK → platform_users (exists)
    - `process_id` text — the UUID generated in `MplApp.jsx` via `crypto.randomUUID()` for each process; lets us match on restore. Add if missing.
    - `category_id` uuid nullable (exists)
    - `subcategory_id` uuid nullable — add if missing
    - `started_at` timestamptz (exists)
    - `accumulated_seconds` integer default 0 — add if missing (NOT elapsed; this is the authoritative seconds count, written on every sync)
    - `status` text (exists; values: 'running', 'paused')
    - `total_paused_seconds` integer default 0 (exists)
    - `updated_at` timestamptz default now() — add if missing
  - Required columns on `bar_sessions`:
    - `last_seen_at` timestamptz — add if missing, default now()
    - `widget_mode` text — add if missing ('mpl-widget' | 'ct-widget')
  - Use `ADD COLUMN IF NOT EXISTS` for every column.
  - Add an index: `CREATE INDEX IF NOT EXISTS idx_mpl_active_timers_user ON mpl_active_timers(user_id, updated_at DESC);`
  - Do NOT drop any existing columns.
  - Files: Create `supabase/migrations/009_mpl_crash_recovery.sql`
  - Acceptance criteria: File exists, uses only `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`, no destructive statements.
  - Test: `grep -E "DROP|TRUNCATE|DELETE FROM" supabase/migrations/009_mpl_crash_recovery.sql` returns empty.

### Phase 2: localStorage layer (biggest resilience win, smallest code change)

- [x] **Task 2: localStorage read/write helpers**
  - What: Create `src/lib/mplRecoveryStorage.js` with these exports:
    - `STORAGE_KEY = 'meridian.mpl.active.v1'`
    - `saveSnapshot(userId, processes)` — serializes `{ userId, savedAt: Date.now(), processes }` to localStorage. `processes` is `[{ id, elapsed, paused, categoryId, subcategoryId, startedAt }]`. Wraps in try/catch (localStorage can throw in incognito / quota exceeded) and logs on failure without crashing.
    - `loadSnapshot(userId)` — reads, parses, returns null if empty, stale (>24h old), or wrong userId.
    - `clearSnapshot()` — removes the key.
    - `STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000` — exported constant.
  - Files: Create `src/lib/mplRecoveryStorage.js`
  - Acceptance criteria: File exports all four symbols; all functions are synchronous; all use try/catch around localStorage access.
  - Test: `npx vite build 2>&1 | tail -5` — no errors. `grep -c "try" src/lib/mplRecoveryStorage.js` returns ≥ 3.

- [x] **Task 3: Write snapshot on every MPL tick**
  - What: In `src/mpl/MplApp.jsx`, after the existing `processes` state and the `processesRef` effect (around line 48), add a new `useEffect` that calls `saveSnapshot(user.id, processes)` whenever `processes` changes. This fires on start, every second (because the tick updates `processes`), on pause/resume, and on stop.
  - Import `saveSnapshot` from `../lib/mplRecoveryStorage.js`.
  - Gate on `if (!user?.id) return;` — don't write before auth resolves.
  - Do NOT replace the existing `processesRef` effect — this is additive.
  - Also call `clearSnapshot()` from the unmount cleanup effect near line 96 when `processes` is empty at unmount, so we don't leave a stale snapshot after a graceful session.
  - Files: Modify `src/mpl/MplApp.jsx`
  - Acceptance criteria: On every tick while a process is running, localStorage key `meridian.mpl.active.v1` contains the current process array.
  - Test: `npx vite build 2>&1 | tail -5` passes. In dev: open PiP, start a timer, check `localStorage.getItem('meridian.mpl.active.v1')` in console — should show updated `savedAt` and `elapsed`.

### Phase 3: Supabase sync layer

- [x] **Task 4: Add API wrappers**
  - What: In `src/lib/api.js`, add these three exports (place them next to the existing `logMplEntry`):
    - `upsertMplActiveTimer({ userId, processId, categoryId, subcategoryId, startedAt, accumulatedSeconds, status })` → `supabase.from('mpl_active_timers').upsert({...}, { onConflict: 'process_id' })`
    - `clearMplActiveTimer(processId)` → `supabase.from('mpl_active_timers').delete().eq('process_id', processId)`
    - `fetchMyActiveMplTimers(userId)` → `supabase.from('mpl_active_timers').select('*').eq('user_id', userId).order('started_at', { ascending: false })`
  - All three return the Supabase `{ data, error }` shape directly.
  - Files: Modify `src/lib/api.js`
  - Acceptance criteria: All three functions exported, use the existing `supabase` client import.
  - Test: `npx vite build 2>&1 | tail -5` passes. `grep -E "^export (async )?function (upsertMplActiveTimer|clearMplActiveTimer|fetchMyActiveMplTimers)" src/lib/api.js | wc -l` returns `3`.

- [x] **Task 5: `useMplRecovery` hook — debounced Supabase sync**
  - What: Create `src/hooks/useMplRecovery.js`. It accepts `(userId, processes)` and:
    - Uses a ref-based debouncer (10-second interval) that upserts every active process to `mpl_active_timers` via the new `upsertMplActiveTimer` API. Do not write every second; batch into 10s windows.
    - When a process is removed from the `processes` array (logged/discarded), call `clearMplActiveTimer(processId)`.
    - Tracks previously-synced process IDs in a ref so removed ones get a delete call.
    - Exposes: `{ syncNow: () => Promise<void> }` — a manual flush used by the `beforeunload` handler (Task 8).
  - Handle errors silently (console.warn) — a failed sync should never crash the widget. The localStorage layer is the primary resilience net.
  - Files: Create `src/hooks/useMplRecovery.js`
  - Acceptance criteria: Hook exports a default function; uses `setInterval` with 10000ms; cleans up interval on unmount.
  - Test: `npx vite build 2>&1 | tail -5` passes.

- [x] **Task 6: Wire `useMplRecovery` into MplApp**
  - What: In `src/mpl/MplApp.jsx`, import `useMplRecovery` and call it with `(user?.id, processes)` near the other hook calls (around line 188, next to `usePendingTriggers`). Destructure `syncNow` from the return value and hold it in a ref for Task 8.
  - Files: Modify `src/mpl/MplApp.jsx`
  - Acceptance criteria: Hook is invoked; `syncNow` is available in a ref.
  - Test: `npx vite build 2>&1 | tail -5` passes. Start a timer in dev, wait 15 seconds, query `SELECT process_id, accumulated_seconds FROM mpl_active_timers WHERE user_id = '<davis-uuid>'` in Supabase — should show the running timer.

### Phase 4: Heartbeat + stale-session detection

- [x] **Task 7: `useBarHeartbeat` hook**
  - What: Create `src/hooks/useBarHeartbeat.js`. It accepts `(userId, widgetMode)` and upserts a row to `bar_sessions` every 30 seconds with `{ user_id, widget_mode, last_seen_at: new Date().toISOString() }`. Use `onConflict: 'user_id,widget_mode'` so each user has one row per widget type.
  - On unmount, fire a final upsert with `last_seen_at = now` so a graceful close has a recent timestamp (this helps distinguish crash from graceful close on the next mount).
  - Export default function `useBarHeartbeat`.
  - Files: Create `src/hooks/useBarHeartbeat.js`
  - Acceptance criteria: Hook exports default; uses `setInterval(30000)`; cleans up on unmount.
  - Test: `npx vite build 2>&1 | tail -5` passes. Call from `MplApp.jsx` with `(user?.id, 'mpl-widget')` — `SELECT last_seen_at FROM bar_sessions WHERE widget_mode = 'mpl-widget'` updates every 30s.

  IMPORTANT SCHEMA NOTE: `bar_sessions` may not have a composite unique constraint on `(user_id, widget_mode)` yet. If the upsert fails with a constraint error, add this to migration 009: `CREATE UNIQUE INDEX IF NOT EXISTS idx_bar_sessions_user_mode ON bar_sessions(user_id, widget_mode);` — then redo Task 1.

### Phase 5: Graceful-close flush + Recovery UI

- [x] **Task 8: `beforeunload` sendBeacon flush**
  - What: In `src/mpl/MplApp.jsx`, add a `useEffect` that attaches a `beforeunload` handler to the PiP window (and the main window as fallback). The handler:
    - Reads current `processes` from `processesRef.current`
    - For each active process, calls `navigator.sendBeacon(url, blob)` where the URL is the Supabase REST endpoint for `mpl_active_timers` and blob is a JSON payload upserting the current state
    - Uses `fetch` with `keepalive: true` as a fallback if `sendBeacon` returns false
  - Because `sendBeacon` is fire-and-forget, it does NOT use the supabase-js client — it must hit the REST endpoint directly with the anon key header. Build the request URL from `import.meta.env.VITE_SUPABASE_URL || supabase.supabaseUrl` and the anon key from `supabase.supabaseKey`.
  - This handler runs on graceful close (user closes window, closes tab, browser quit). It will NOT run on OS-force-kill (Windows Update), but that's what Task 3 (localStorage) covers.
  - Files: Modify `src/mpl/MplApp.jsx`
  - Acceptance criteria: `window.addEventListener('beforeunload', ...)` fires during PiP close; `sendBeacon` is called.
  - Test: `npx vite build 2>&1 | tail -5` passes. In dev: start a timer, close PiP window, check `mpl_active_timers` row has `updated_at` within 2 seconds of close.

- [ ] **Task 9: `RecoveryPrompt` component**
  - What: Create `src/mpl/RecoveryPrompt.jsx` — a bar-width overlay that takes `{ recoveredProcesses, onResume, onLogNow, onDiscard, categories }` and renders:
    - Message: "Meridian closed unexpectedly. You had {N} active {process|processes}."
    - List: each process as `• {category name || 'Uncategorized'} — {formatted elapsed time}`
    - Three buttons: `Resume`, `Log now`, `Discard`
  - Use existing design tokens: Hapag Blue `#003087`, Orange `#E8540A`, dark bg `#0f1117`, Segoe UI. Match the visual language of existing MPL overlays (look at `ProcessPicker.jsx` for pattern).
  - The component is pure presentational — all state lives in `MplApp`.
  - Files: Create `src/mpl/RecoveryPrompt.jsx`
  - Acceptance criteria: Component exports default; accepts all four props; renders three action buttons.
  - Test: `npx vite build 2>&1 | tail -5` passes.

- [ ] **Task 10: Recovery detection + restoration logic**
  - What: In `src/mpl/MplApp.jsx`, add a `useEffect` that runs once after `user` and `categories` are loaded (gate on `if (!user?.id || categories.length === 0 || recoveryChecked) return;` and set a `recoveryChecked` state flag after running). The effect:
    1. Reads localStorage via `loadSnapshot(user.id)`. If found and `savedAt` is less than 1 hour old, these are the recovered processes.
    2. Falls back to `fetchMyActiveMplTimers(user.id)`. Cross-reference against `bar_sessions.last_seen_at` for this user's `mpl-widget` row: if `last_seen_at` is older than 5 minutes OR localStorage had a snapshot, treat as a crash.
    3. If recovered processes exist, set state `recoveredProcesses` and open the PiP if closed. `MplPipBar` renders `<RecoveryPrompt />` when `recoveredProcesses.length > 0`.
    4. `onResume`: restore each process into the `processes` array with its elapsed time (capped at `min(stored elapsed, seconds since startedAt)`), restart timers, clear `recoveredProcesses`.
    5. `onLogNow`: for each recovered process with a category, call `logMplEntry` with the elapsed minutes. For uncategorized processes, route to the existing category picker. Then clear both localStorage and `mpl_active_timers` rows.
    6. `onDiscard`: call `clearSnapshot()` and `clearMplActiveTimer(processId)` for each, clear `recoveredProcesses`.
  - Files: Modify `src/mpl/MplApp.jsx`, modify `src/mpl/MplPipBar.jsx` to accept and render the prompt overlay
  - Acceptance criteria: On mount with a stale snapshot present, `<RecoveryPrompt />` renders. Each button path leaves both storage layers clean.
  - Test: `npx vite build 2>&1 | tail -5` passes. Manual dev test: start timer, kill browser via Task Manager, reopen — prompt appears with correct category + elapsed.

### Phase 6: End-to-end verification

- [ ] **Task 11: Build + smoke test**
  - What: Run `npx vite build` and confirm no errors or warnings related to new files. Confirm bundle size didn't balloon (should be within 10KB of pre-change baseline).
  - Files: None (verification only)
  - Acceptance criteria: Build succeeds. No console errors on widget mount in Chrome.
  - Test: `npx vite build 2>&1 | tail -20` — shows "✓ built in" message, no red errors.

- [ ] **Task 12: Document in progress.txt**
  - What: Append a summary to `progress.txt`:
    - Files added
    - Storage keys introduced (`meridian.mpl.active.v1`)
    - New Supabase columns added (via migration 009)
    - How to manually trigger recovery for testing (kill the PiP via DevTools → Application → localStorage is populated, then reopen)
    - Known limitation: Windows Update force-close may beat even `beforeunload`; localStorage is the only true safety net for that case (which is fine — it's the whole point).
  - Files: Modify `progress.txt`
  - Acceptance criteria: New section appended with heading `## MPL Crash Recovery (PRD 009)`.
  - Test: `grep -c "MPL Crash Recovery" progress.txt` returns `≥ 1`.

---

## Testing Strategy

- **Primary**: `npx vite build 2>&1 | tail -10` after every task. This is the project's type + lint + bundle check all in one.
- **Manual smoke test after Task 11** (if Ralph can open a browser): load dev server, start an MPL timer, close the tab via Task Manager, reopen — recovery prompt should appear.
- **Schema verification** (after Task 1): Ralph should output the full SQL file content to `progress.txt` for Davis to manually apply. Do NOT attempt to run migrations — Davis applies them manually via Supabase SQL Editor.

---

## Out of Scope

- **Do NOT modify** `src/App.jsx`, `src/PipBar.jsx`, or any file under `src/ct/` — CT widget gets its own PRD later
- **Do NOT modify** `src/hooks/useTimer.js` signature
- **Do NOT refactor** the existing `processes` state shape in `MplApp.jsx` — the recovery layers wrap around it, not replace it
- **Do NOT add** new npm dependencies — all storage APIs used are browser built-ins
- **Do NOT touch** RLS policies — `mpl_active_timers` and `bar_sessions` already have correct RLS from earlier migrations
- **Do NOT apply the migration automatically** — only write the SQL file; Davis applies it manually
- **No cross-device session sync** beyond what Supabase provides naturally — if agent opens Meridian on a second machine while another is running, that's fine; recovery prompt will show on whichever they open next
- **No automatic recovery**; always prompt the user. Silent auto-resume risks double-counting time.

---

## Notes for Ralph

### Existing patterns to follow

- **Supabase writes use `safeWrite()` helper** inside `MplApp.jsx` (line ~62). Reuse it for any non-beacon writes to get consistent error toasts.
- **Timers are tracked in `processTimers.current`** keyed by process id — a ref object, not state. Do not change this; recovery on Resume must add new interval IDs to this ref.
- **`processesRef.current`** mirrors `processes` state for use inside callbacks that can't close over fresh state (see line 48). If you need the current processes array inside a `beforeunload` handler or interval callback, read from this ref.
- **`showToast(message)`** displays PiP-local toasts — use for recovery confirmations ("Timer resumed", "Logged 14 minutes").
- **PiP window lifecycle** is managed by `usePipWindow` in `src/hooks/usePipWindow.js`. Do not call `window.open` or `documentPictureInPicture.requestWindow` directly.

### Known gotchas

- **`crypto.randomUUID()`** is used for `process.id` and must be matched as `process_id` (text) in `mpl_active_timers`. If the column doesn't exist yet, Task 1 adds it.
- **localStorage does NOT inherit into PiP windows the way some APIs do** — but PiP windows share the same origin, so `localStorage` is actually the same store. This works correctly by default; no special handling needed.
- **`navigator.sendBeacon` requires a Blob with a content type** — use `new Blob([JSON.stringify(payload)], { type: 'application/json' })`.
- **Supabase upsert with `onConflict`** requires the conflict column to have a unique constraint. Task 1 adds unique indexes for this.
- **RLS**: writes to `mpl_active_timers` require `auth.uid() = user_id`. Beacon writes use the anon key + JWT; the JWT must be in the request header. Get it from `(await supabase.auth.getSession()).data.session.access_token` at effect setup and keep it in a ref.
- **Debounce timing**: 10s for Supabase sync is deliberate — NOT 1s, NOT 60s. This balances write cost vs data freshness.
- **Staleness window**: 5 minutes is deliberate — PiP heartbeat is 30s, so 5min = 10 missed pings, well beyond any transient network blip.
- **Do not block widget startup on recovery checks** — if Supabase is slow, localStorage alone is sufficient to surface the prompt. Recovery should render within 100ms of mount.

### If things look different than expected

- If `mpl_active_timers` already has columns this PRD describes as "add if missing", the `ADD COLUMN IF NOT EXISTS` is a no-op — that's correct, continue.
- If `bar_sessions` doesn't have `widget_mode`, add it in migration 009 and default existing rows to `'legacy'`.
- If the build fails on unused imports after a task, that's a real error — clean up and retry, don't leave them.
