# PRD — Pause Feature v2.1 (Ralph-ready)
**Status:** Locked · 04/27 evening
**Scope:** Wave 1A (case-pause as distinct state) + Wave 1B (process-pause on MPL bar)
**Source of truth:** Lish conversation 04/26 + Davis code audit commit b2ac0fb (04/27)
**Owner:** Ralph overnight · Davis review AM 04/28

---

## 1 · Background

**Pause is a partial regression.** Per Lish, a Pause concept existed in a previous version and was removed during edits. Per Davis's 04/27 code audit (commit b2ac0fb), the *functionality* still exists today — clicking the Awaiting button stops the timer correctly — but the **Pause label and any visual distinction from Awaiting were removed**. The button is now icon-only, no tooltip, and toggles a single conceptual state that the code labels `awaiting`.

**The actual ask is to re-separate Pause from Awaiting** — both as distinct semantic states in the data model, and as distinct affordances in the UI.

**Pause and Awaiting are semantically distinct states:**
- **Pause** — agent-side interruption. Agent stepped away, switched context, took a call, or is switching between concurrent cases.
- **Awaiting Customer Reply** — customer-side block. Case is parked until the customer provides required information.

These are different states because they answer different questions in reporting:
- "How much time was the agent actively working?" → exclude both
- "How much time was the case blocked on the customer?" → include awaiting only
- "How fragmented was the agent's attention?" → include pause only

**Pause is also the primitive for multicase.** When concurrent-case support ships in a future wave, switching from case A to case B is implemented as a pause on A. Building pause now is groundwork for that work.

---

## 2 · Audit findings (from commit b2ac0fb, 04/27)

**CT side (case pause):**
- `handlePauseCase` and `handleResumeCase` exist in `CtApp.jsx` lines 601–615 but write `status: 'awaiting'` AND set `{ paused: true, awaiting: true }` on local state. Misnamed and aliased — they implement Awaiting under a Pause name with both flags toggled together.
- A functional duplicate `handleAwaitingCase` exists at line 868. Same DB write, same timer stop, same state update; only difference is an early `if (!user) return` guard. Vestigial.
- The Awaiting button in `MinimizedStrip` is **icon-only with no text label and no tooltip**. Active state: gray pause icon (⏸). Paused state: green play icon (▶). Discoverability is a real problem — first-time users won't know it exists.
- Each case object has `paused` AND `awaiting` boolean fields on local React state, but they are *always set together* — the distinction Lish wants does not exist in code today.
- `syncTimers` (line 147) checks both: `if (!c.paused && !c.awaiting) startCaseTimer(c.id)`. Logic is OK but assumes the aliased pair.
- Persistence: `ct_cases.status = 'awaiting'` is written to DB on pause, persists across tab close. ⚠ **Unverified:** the case-load mapper that reads `status` and rehydrates local state — it must set `paused:true` when `status==='awaiting'`. Ralph: confirm this mapper exists and works correctly before changing handler writes.

**MPL side (process pause):**
- `mpl_active_timers.total_paused_seconds` column exists from migration 009, never written.
- `MplPipBar` has no pause UI on the active process pill.
- `MinimizedStrip`'s process-pause buttons are unreachable from CT (CtApp passes `processes={[]}`, `activeProcess={null}`).

**Architectural constraint:** CT and MPL are independent apps. This PRD does not bridge them. Process-pause ships on the MPL bar where MPL state lives.

---

## 3 · Wave 1A — Case-pause as distinct state (CT)

### 3.1 Database

Add a new value to `ct_cases.status`. Current values include `'active'` and `'awaiting'`; add `'paused'`.

- **If `status` is a Postgres enum:** `ALTER TYPE ... ADD VALUE 'paused';` in a new migration (next available number after 027).
- **If `status` is a plain text/varchar column:** no migration needed; just start writing the new value.
- **Investigation step (Ralph):** check the column type before deciding migration shape. `\d ct_cases` or equivalent in the Supabase SQL editor.

### 3.2 Handlers in `CtApp.jsx`

**Critical: existing state shape (audit finding).** Today, `case.paused` and `case.awaiting` are toggled together as an aliased pair. Every handler that currently sets one sets the other:
- `handlePauseCase` (line 601) sets `{ paused: true, awaiting: true }`
- `handleResumeCase` (line 612) sets `{ paused: false, awaiting: false }`
- `handleAwaitingCase` (line 868, the duplicate) sets `{ paused: true, awaiting: true }`

**This is the regression Lish reported.** A previous version distinguished the two; the current code does not. The work in this section is not just renaming — it's *separating two flags that today always move together* into two genuinely independent states.

After the changes in this section:
- `paused: true, awaiting: false` → agent-side pause only
- `paused: false, awaiting: true` → customer-blocked only
- `paused: false, awaiting: false` → active
- `paused: true, awaiting: true` → **invalid going forward.** Treat any case loaded from DB with both flags set as awaiting-only (legacy data migration, in-memory only — no DB rewrite).

**Audit all read sites of either flag** before changing the writers. Specifically:
- `syncTimers` (line 147): currently `if (!c.paused && !c.awaiting) startCaseTimer(c.id)` — this logic is correct for the new world *if* paused-only should also stop the timer. Verify intent.
- Any UI rendering that branches on `paused` vs `awaiting`.
- Stats / reporting code reading `ct_cases.status`.

**Action:**

1. **Rename** existing `handlePauseCase` / `handleResumeCase` → `handleAwaitingCase` / `handleResumeAwaitingCase`. Update the writes to set `{ paused: false, awaiting: true }` (separate the flags). (These currently write `status: 'awaiting'` — the new names match what they actually do.) Note: there is already a `handleAwaitingCase` at line 868 that's a functional duplicate; **delete the duplicate** and consolidate into the renamed function. Verify no other call sites broken by the consolidation.

2. **Create new** `handleTruePauseCase(id)` and `handleResumeFromPauseCase(id)`:
   - On pause: write `status: 'paused'` to `ct_cases`, call `stopCaseTimer(id)`, set `{ paused: true, awaiting: false }` on local state.
   - On resume: write `status: 'active'`, set `{ paused: false, awaiting: false }`, call `startCaseTimer(id)`.

3. **Case-load mapper:** wherever cases are hydrated from `ct_cases` into local state (search for the function that reads `status`), ensure:
   - `status === 'awaiting'` → `{ paused: false, awaiting: true }`
   - `status === 'paused'` → `{ paused: true, awaiting: false }`
   - `status === 'active'` → `{ paused: false, awaiting: false }`

4. **Discoverability fix (per audit notes):** the existing Awaiting button is icon-only with no tooltip. Add `title` attributes (or aria-label) to both Pause and Awaiting buttons:
   - Pause button: `title="Pause (agent stepped away)"`
   - Awaiting button: `title="Awaiting customer reply"`
   - Resume buttons: `title="Resume"` (or "Resume from Pause" / "Resume from Awaiting" if Ralph wants to be explicit)

### 3.3 UI in `CtPipBar.jsx` and `MinimizedStrip.jsx`

The focused case row needs **two buttons**, both visible, clearly distinguished:

- **Pause** (icon: ⏸ or pause-square) — agent-side interruption
- **Awaiting** (icon: ⏳ or hourglass) — customer-blocked

When a case is in either state, the corresponding button becomes a **Resume** button. Only one of pause/awaiting can be active at a time (mutual exclusion in state).

`MinimizedStrip` already has `onPauseCase` / `onResumeCase` props plumbed through. Wire them to the new `handleTruePauseCase` / `handleResumeFromPauseCase`. Add `onAwaitingCase` / `onResumeAwaitingCase` props for the Awaiting flow if not already plumbed.

### 3.4 Timer correctness

Both pause states must stop `caseTimers.current[id]` cleanly. Verify by:
- Pause a case for 60 seconds, resume, confirm `elapsed` advanced by zero during the pause.
- Same for Awaiting.
- Mutual exclusion: setting Awaiting on a paused case clears Pause first; setting Pause on an Awaiting case clears Awaiting first.

### 3.5 Persistence

Local React state already persists to localStorage (lines ~270–290 in CtApp). Confirm the `paused` and `awaiting` fields survive a tab close + reopen with both states.

---

## 4 · Wave 1B — Process-pause on MPL bar (MPL)

### 4.1 Handlers in `MplApp.jsx`

New functions:

- `handleProcessPause(processId)`:
  1. Stop the local timer interval for that process.
  2. Calculate seconds elapsed since last resume (or since `started_at` if never paused).
  3. Add to `mpl_active_timers.total_paused_seconds`. **Wait — re-read this.** `total_paused_seconds` should accumulate the time *spent paused*, not total time elapsed. The cleaner pattern: store `paused_at` when pause fires, and on resume compute `(now - paused_at)` seconds and add to `total_paused_seconds`. Then clear `paused_at`.
  4. Set `paused: true` on local state.

- `handleProcessResume(processId)`:
  1. Compute `(now - paused_at)` and add to `mpl_active_timers.total_paused_seconds`. Clear `paused_at`.
  2. Restart the timer interval.
  3. Clear `paused: true` on local state.

**Schema requirement:** `mpl_active_timers` may need a `paused_at TIMESTAMPTZ NULL` column. Migration if absent. Check schema before adding.

### 4.2 UI in `MplPipBar.jsx`

Add a Pause button to the active process pill. Mirror the MinimizedStrip pattern: ⏸ icon when running, ▶ icon when paused. Toggle on click.

### 4.3 The dual-parent landmine — CRITICAL

**`MplPipBar` is rendered by both `MplApp.jsx` AND `DashboardApp.jsx`.** Any new prop added to `MplPipBar` must be wired in *both* parents. If only one is wired, the feature silently no-ops on the other surface — no error, no warning, just nothing happens.

**Required verification step:** after adding `onProcessPause` / `onProcessResume` props to `MplPipBar`, run:
```
grep -n "MplPipBar" src/mpl/MplApp.jsx src/DashboardApp.jsx
```
Both files must pass the new props. Both files must define the handlers (or import them). Test the pause feature on both `?mode=mpl-widget` URL and the default DashboardApp entry.

### 4.4 Dormant column risk

`total_paused_seconds` has been dormant since migration 009 (Feb 2026). Before writing to it:
- `grep -rn "total_paused_seconds" src/` to confirm no read sites exist.
- If read sites exist, audit them to confirm they handle non-zero values correctly. (Stats panels may have been computing assuming this is always zero.)
- If unclear, write to a *new* column instead — `pause_seconds_v2` — and leave the dormant one alone. Net effect identical, safer.

### 4.5 MinimizedStrip ghost buttons

`MinimizedStrip` has process-pause UI that is unreachable from CT (because CtApp passes `processes={[]}`). **Leave this alone.** Do not delete the buttons; do not bridge state. Add a comment in MinimizedStrip:

```js
// NOTE: process-pause buttons here are dormant until cross-app state bridge
// between CT and MPL exists (separate PRD). Today they only render when
// CtApp passes a non-null activeProcess, which it never does.
```

---

## 5 · Out of scope (do not touch)

- Cross-app state bridge between CT and MPL.
- Multicase / concurrent case support (separate PRD, future wave).
- Pause logging in `case_events` (deferred to Insights Tier II).
- `case_events` schema changes of any kind.
- Renaming the `'awaiting'` database value.
- Anything in `src/mpl/` other than `MplApp.jsx` and `MplPipBar.jsx`.
- Migrations below 027.
- The bookmarklet.
- Any file outside `src/ct/`, `src/mpl/`, `src/components/MinimizedStrip.jsx`, and a single new migration file.

---

## 6 · Testing requirements before declaring done

- [ ] Case-pause button appears on focused case row, distinct from Awaiting button.
- [ ] Both buttons have tooltips (title attribute) describing what they do.
- [ ] Pause stops timer; Resume restarts it; elapsed time does not advance during pause.
- [ ] Awaiting still works exactly as before — no regression.
- [ ] **`paused` and `awaiting` flags are now independent.** A case with `{paused: true, awaiting: false}` is a valid state; verify by inspecting React DevTools after pausing.
- [ ] Pause and Awaiting are mutually exclusive (cannot be both at once in UI; legacy DB rows with both flags treat as awaiting).
- [ ] Case-load mapper correctly rehydrates `status: 'paused'` → `{paused: true, awaiting: false}` and `status: 'awaiting'` → `{paused: false, awaiting: true}`.
- [ ] Both states persist across tab close/reopen.
- [ ] Process-pause button appears on MPL bar active process pill.
- [ ] Process-pause stops MPL timer; resume restarts; `total_paused_seconds` (or `pause_seconds_v2`) accumulates correctly across multiple cycles.
- [ ] **MplPipBar dual-parent verified** — process-pause works on both `?mode=mpl-widget` and the default DashboardApp.
- [ ] No regression in existing stats panels (verify dashboard renders, no NaN, no broken queries).
- [ ] `npm run build` passes clean.

---

## 7 · Failure modes to avoid

- **Don't bridge CT and MPL state.** It's not in scope. The MinimizedStrip ghost buttons stay ghosts.
- **Don't add multicase logic.** Pause is the primitive; multicase is a separate wave.
- **Don't delete the `'awaiting'` status value or migrate it.** Awaiting must continue to work unchanged.
- **Don't refactor unrelated code.** Stay strictly within the files listed in §5.
- **Don't ship without verifying both MplPipBar parents.** This is the most likely silent-failure mode and Davis has hit it before.

---

## 8 · Progress log requirements

Maintain `progress.txt` with:
- Each task started/completed
- Each migration number used
- Each file edited (full path)
- Any decisions Ralph made when the PRD was ambiguous (so Davis can review)
- Any blockers — and STOP if blocked rather than guessing

---

## 9 · Definition of done

- All §6 tests pass.
- `progress.txt` is complete and committed.
- Branch is `feat/pause-feature-v2` off green main.
- Build is green.
- No untracked files.
- PR description references this PRD.
