# PRD — Multicase + Pause v2.2 (Ralph-ready)
**Status:** Draft · 04/28 evening
**Scope:** Multicase support + Pause as switching primitive + Awaiting (long-term park) + Process-pause on MPL bar
**Source of truth:**
  - Lish conversation 04/26 (pause as multicase primitive; pause for processes)
  - Wanda conversation 04/28 (pause for short-term switching; awaiting for long-term parks)
  - Carlos signal 04/28 (focus is on case merging, separate PRD)
  - Davis code audit commit b2ac0fb (state shape, existing primitives)
**Owner:** Ralph overnight · Davis review AM following day

---

## 1 · Background

**Two testers gave the same model from different angles.**

- **Lish:** "Pause is for interruptions; awaiting is parking until required information is received. Pause will also be used for when we add the multiple/concurrent cases."
- **Wanda:** "I want to pause a case and then work on at least one other case or process at the same time, and would also like awaiting information for longer term pauses."

The unified model:

| State | Duration | Reason | UX |
|---|---|---|---|
| **Active** | — | Agent currently working this case | Timer ticks, full action set |
| **Pause** | Short (minutes) | Agent switching focus / interruption | Timer stops, case stays in list, easy resume |
| **Awaiting** | Long (hours/days) | Customer-blocked, parked until reply | Timer stops, status persisted to DB, less prominent in list |

**Pause and Awaiting are semantically distinct** and must both exist.

**Multicase:** Agents need to work multiple cases concurrently. The frontend already supports this — `cases` is an array, `caseTimers` is a map keyed by case id, multiple timers can already tick. What's missing is the UX for working with multiple cases and the bookmarklet behavior for adding new ones to an active session.

---

## 2 · Audit findings (carried from earlier sessions)

**State already in place:**
- `cases` is an array in `CtApp.jsx` state. Multicase-capable today.
- `caseTimers = useRef({})` is a map keyed by session id. Each case gets its own `setInterval`. Multiple timers can already tick simultaneously.
- Each case object has `paused`, `awaiting`, and `elapsed` fields.
- `focusedCaseId` exists and selects which case actions target.
- `MinimizedStrip` renders multiple cases. The tray auto-opens at 3+ cases (existing behavior).

**State that needs work:**
- `case.paused` and `case.awaiting` flags are toggled together today (lines 607, 614, 875). They must become independent.
- Existing `handlePauseCase` / `handleResumeCase` (lines 601-615) write `status: 'awaiting'` — misnamed.
- Vestigial `handleAwaitingCase` at line 868 is a functional duplicate. To be deleted.
- The Awaiting button in MinimizedStrip is icon-only with no tooltip. Discoverability gap.
- Per Davis observation: pause-for-cases is functionally working today (Wanda uses it), but is mislabeled. Rename + tooltip + flag separation is the cleanup.

**Architecture constraint:**
- CT and MPL are independent apps with independent state. This PRD does not bridge them. Process-pause ships on the MPL bar where MPL state lives.
- Bookmarklet payload changes are in scope but minimal — only what's needed to add cases to an existing session.

---

## 3 · Design decisions (locked)

These are the load-bearing decisions. Ralph: do not deviate without writing a blocker in progress.txt.

| # | Decision | Locked answer |
|---|---|---|
| 1 | Bookmarklet on a 2nd SF tab while case A is active | **Add B silently as a second active case. Focus B. A keeps ticking.** No prompt, no auto-pause, no toast. |
| 2 | Multicase visual layout | **Adaptive.** 1 case = current single-card layout. 2 cases = side-by-side (or stacked if width-constrained — Ralph chooses based on available width). 3+ cases = tabs/pills with one expanded. |
| 3 | Pause + focus relationship | **Independent and deliberate.** Pause is a separate explicit action. Focusing case B does NOT pause case A. Pausing case A does NOT auto-focus another case. Two clicks to switch (pause A, focus B) is intended. |
| 4 | Pause vs. Awaiting | **Distinct states with mutual exclusion.** A case is exactly one of: active, paused, awaiting. Pausing while awaiting clears awaiting first; setting awaiting while paused clears paused first. |
| 5 | Both cases ticking simultaneously | **Allowed and expected.** True multicase. Both cases accumulate elapsed time until pause is explicitly triggered. |
| 6 | Process-pause scope | **MPL bar only.** `MinimizedStrip` ghost buttons remain ghosts (cross-app bridge is out of scope). |

---

## 4 · Wave 1A — Case-pause cleanup (CT)

### 4.1 Database

Check `ct_cases.status` column type before deciding migration shape.

- **If text/varchar:** No migration. Just write the new value.
- **If enum:** `ALTER TYPE ... ADD VALUE 'paused';` in next available migration number after 027.

### 4.2 Handlers in `CtApp.jsx`

**Critical: existing state shape.** Today `case.paused` and `case.awaiting` move together. Every handler that sets one sets the other. **This must be undone.**

After §4.2 changes, valid case state shapes:
- `paused: false, awaiting: false` → active
- `paused: true,  awaiting: false` → paused (agent-side)
- `paused: false, awaiting: true`  → awaiting (customer-blocked)
- `paused: true,  awaiting: true`  → **invalid going forward.** Treat legacy DB rows with both as awaiting-only on hydration.

**Action:**

1. **Rename** existing `handlePauseCase` / `handleResumeCase` → `handleAwaitingCase` / `handleResumeAwaitingCase`. Update writes to set `{ paused: false, awaiting: true }` only. (These currently write `status: 'awaiting'` — the new names match what they actually do.) Delete the duplicate `handleAwaitingCase` at line 868. Verify no other call sites broken.

2. **Create new** `handleTruePauseCase(id)` / `handleResumeFromPauseCase(id)`:
   - Pause: write `status: 'paused'`, call `stopCaseTimer(id)`, set `{ paused: true, awaiting: false }`.
   - Resume: write `status: 'active'`, set `{ paused: false, awaiting: false }`, call `startCaseTimer(id)`.

3. **Mutual exclusion enforcement.** When `handleTruePauseCase` fires on a case where `awaiting === true`, clear `awaiting` first (write `status: 'paused'` overrides). Symmetric for awaiting-on-paused.

4. **Case-load mapper.** Find where cases hydrate from `ct_cases` into local state (search for the function reading `status`):
   - `status === 'awaiting'` → `{ paused: false, awaiting: true }`
   - `status === 'paused'`   → `{ paused: true,  awaiting: false }`
   - `status === 'active'`   → `{ paused: false, awaiting: false }`
   - Legacy: any row with both flags from earlier writes — treat as awaiting (safest fallback).

### 4.3 Buttons + tooltips in MinimizedStrip

The focused case row needs **two distinct buttons**:

- **Pause** (icon: ⏸) `title="Pause (agent stepped away)"` — calls `handleTruePauseCase`
- **Awaiting** (icon: ⏳) `title="Awaiting customer reply"` — calls `handleAwaitingCase`

When a case is in either state, the corresponding button becomes Resume:
- Paused → Pause button shows ▶ with `title="Resume from pause"`
- Awaiting → Awaiting button shows ▶ with `title="Resume from awaiting"`

`MinimizedStrip` already has `onPauseCase` / `onResumeCase` props plumbed. Add `onAwaitingCase` / `onResumeAwaitingCase` props for the awaiting flow. Wire in CtPipBar AND CtApp.

---

## 5 · Wave 1B — Multicase UX (CT)

### 5.1 Bookmarklet behavior on second SF tab

When the bookmarklet fires on a SF case page and the widget already has an active case A:

1. Resolve the case from the page (existing logic).
2. If the case id matches an existing case in the array → focus that case, no other change. (Refocus, not duplicate.)
3. If the case id is new → append to `cases` array, set `focusedCaseId` to the new case, start a timer for it. **Do not** modify case A's state. **Do not** show a toast.
4. Bookmarklet payload may need a new field indicating "add to existing session vs. start new session" — Ralph: investigate and add only if necessary. Existing `_meridianRefresh` path may already cover this.

**Out of scope:** Cross-tab synchronization. If the agent has the widget open in two browser tabs, this PRD does not handle that. One widget instance, multiple cases inside it.

### 5.2 Visual layout — adaptive

| # cases | Layout |
|---|---|
| 0 | Idle state (existing) |
| 1 | Single card layout (existing) |
| 2 | Side-by-side OR stacked vertical, Ralph chooses based on `CtPipBar` width. Both cases visible simultaneously. Each shows case number, elapsed time, status pill. Click selects focus. Action buttons appear on focused case only. |
| 3+ | Tab/pill row at top: one pill per case showing case number + small status indicator (active dot / pause icon / awaiting icon). Click pill to focus. Focused case expanded below with full action set. Existing tray-auto-open behavior at 3+ is preserved. |

**Width constraints for Ralph:** `CtPipBar` is 380px base. At 2 cases side-by-side, each case gets ~180px after padding/margins. If that's too tight for required content (case number + elapsed + status pill), fall back to vertical stack. Ralph: build it side-by-side first, test visually, fall back to stacked if it doesn't read well.

### 5.3 Focus model

- `focusedCaseId` is a single value (existing).
- Click a case anywhere in the layout to focus it.
- Action buttons (Resolve, Reclass, Pause, Awaiting, etc.) only appear on the focused case.
- Non-focused cases show their pill/card with status but no action buttons.
- Focusing does NOT change pause/awaiting state on any case.

### 5.4 Persistence

- `focusedCaseId` persists to localStorage. On reload, the previously focused case is re-focused.
- All cases' status (paused/awaiting/active) persists via DB writes (existing).
- Local React state (`paused`, `awaiting`) hydrates correctly from `ct_cases.status` per §4.2.4.

---

## 6 · Wave 1C — Process-pause on MPL bar (MPL)

### 6.1 Handlers in `MplApp.jsx`

New functions:

- `handleProcessPause(processId)`:
  1. Stop the local timer interval.
  2. Write `paused_at = now()` to `mpl_active_timers` for that process.
  3. Set `paused: true` on local state.

- `handleProcessResume(processId)`:
  1. Compute `(now - paused_at)` seconds, add to `mpl_active_timers.total_paused_seconds`. Clear `paused_at`.
  2. Restart the timer interval.
  3. Clear `paused: true` on local state.

**Schema requirement:** `mpl_active_timers.paused_at TIMESTAMPTZ NULL`. Migration if absent.

### 6.2 UI in `MplPipBar.jsx`

Add a Pause button to the active process pill. Mirror MinimizedStrip's icon swap (⏸ when running, ▶ when paused). Toggle on click.

### 6.3 The dual-parent landmine — CRITICAL

`MplPipBar` is rendered by both `MplApp.jsx` AND `DashboardApp.jsx`. Any new prop must be wired in both. Required verification:

```
grep -n "MplPipBar" src/mpl/MplApp.jsx src/DashboardApp.jsx
```

Both files must pass new props. Test process-pause on both `?mode=mpl-widget` and the default DashboardApp entry.

### 6.4 Dormant column risk

`mpl_active_timers.total_paused_seconds` has been dormant since migration 009. Before writing:

```
grep -rn "total_paused_seconds" src/
```

If read sites exist, audit them for non-zero handling. If unclear, use a new column `pause_seconds_v2` instead.

---

## 7 · Out of scope (do not touch)

- Cross-app state bridge between CT and MPL. MinimizedStrip ghost buttons stay ghosts.
- Case merging (Carlos's separate PRD).
- Quick Log timer-not-stopping bug (separate fix).
- Pause logging in `case_events` (deferred to Insights Tier II).
- `case_events` schema changes of any kind.
- Renaming the `'awaiting'` database value.
- Anything in `src/mpl/` other than `MplApp.jsx` and `MplPipBar.jsx`.
- Migrations below 027.
- Cross-tab synchronization (multiple widget instances in different browser tabs).
- Any file outside `src/ct/`, `src/mpl/`, `src/components/MinimizedStrip.jsx`, `public/ct-widget.js` (only if bookmarklet behavior requires it), and a single new migration file.

---

## 8 · Testing requirements before declaring done

**Wave 1A — Case-pause cleanup:**
- [x] Pause and Awaiting are distinct buttons on the focused case row, both with tooltips.
- [x] Pausing a case stops its timer; resuming restarts it; elapsed advances by zero during pause.
- [x] Awaiting a case stops its timer; resuming restarts it.
- [x] `paused` and `awaiting` flags are independent (verify via React DevTools: `{paused: true, awaiting: false}` is a valid state).
- [x] Mutual exclusion: setting one clears the other.
- [x] Case-load mapper correctly hydrates `status: 'paused'` → `{paused: true, awaiting: false}`.
- [x] Both states persist across tab close/reopen.

**Wave 1B — Multicase UX:**
- [ ] Bookmarklet on tab 2 with case A active adds case B as second active case. Focus shifts to B. A keeps ticking.
- [ ] Bookmarklet on tab 2 with case B already in the array refocuses B (no duplicate).
- [ ] At 1 case: single-card layout (existing).
- [ ] At 2 cases: both visible simultaneously, focus is clickable, action buttons only on focused.
- [ ] At 3+ cases: tab/pill row, focused expanded, click pill to switch focus.
- [ ] Both case timers tick simultaneously when both are active (verify with React DevTools).
- [ ] Focus changes do not modify pause/awaiting state.
- [ ] `focusedCaseId` persists across reload.

**Wave 1C — Process-pause:**
- [ ] Pause button appears on MPL bar active process pill.
- [ ] Process-pause stops MPL timer; resume restarts.
- [ ] `total_paused_seconds` (or `pause_seconds_v2`) accumulates correctly across multiple cycles.
- [ ] **MplPipBar dual-parent verified** — works on `?mode=mpl-widget` AND default DashboardApp.

**System-wide:**
- [ ] No regression in existing stats panels (dashboard renders, no NaN, no broken queries).
- [ ] No regression in Awaiting flow (pre-existing testers' behavior unchanged).
- [ ] `npm run build` passes clean.
- [ ] No untracked files at completion.

---

## 9 · Failure modes to avoid

- **Don't bridge CT and MPL state.** MinimizedStrip ghost buttons remain ghosts.
- **Don't auto-pause case A when bookmarklet adds case B.** Decision is locked: A keeps ticking.
- **Don't add a prompt or toast on bookmarklet handoff.** Decision is locked: silent.
- **Don't couple pause and focus.** They are independent; coupling them violates Decision 3.
- **Don't ship without verifying both MplPipBar parents.** Most common silent-failure mode.
- **Don't rename `'awaiting'` database value.** Awaiting must continue to work unchanged.
- **Don't refactor unrelated code.** Strict file scope per §7.

---

## 10 · Progress log requirements

Maintain `progress.txt` (current run section) with:
- Each iteration started/completed (matching the project's existing iteration format)
- Each migration number used
- Each file edited (full path)
- Any decisions Ralph made when the PRD was ambiguous (so Davis can review)
- Any blockers — STOP if blocked, do not guess

---

## 11 · Definition of done

- All §8 tests pass.
- progress.txt is complete and committed in matching iteration format.
- Branch is `feat/multicase-pause-v2.2` off green main.
- Build is green.
- No untracked files.
- PR description references this PRD.
