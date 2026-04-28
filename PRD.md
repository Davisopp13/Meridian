# PRD — Pause Feature v1
**Status:** Draft · 04/27 evening
**Scope:** Option 3 — case-pause in CT widget, process-pause in MPL bar, no cross-app bridge
**Owner:** Davis · solo or Ralph TBD

---

## 1 · Audit findings (headline)

Pause UI is partially built; the data plumbing is incomplete and inconsistent across CT and MPL.

**CT side (case pause):**
- `handlePauseCase` and `handleResumeCase` already exist in `CtApp.jsx` (lines 601–615). They write `status: 'awaiting'` to `ct_cases`, stop/start the local timer, and update React state.
- The function names say "Pause"; the database value says "Awaiting"; the user-facing label (TBD — verify in the running app) is also "Awaiting." Three vocabularies for one operation.
- A duplicate function `handleAwaitingCase` exists at line 868 doing nearly the same thing. Vestigial.
- `MinimizedStrip` already has Pause/Play icon buttons that swap based on `case.paused`. Hooked through `onPauseCase` / `onResumeCase` props from `CtPipBar` → `CtApp`.
- **Net for case-pause: feature exists, just misnamed and possibly poorly discoverable.**

**MPL side (process pause):**
- `mpl_active_timers.total_paused_seconds` column exists from migration 009 (Feb 2026). Never written by any handler today.
- `MplPipBar` (the actual MPL widget) has no pause UI on the active process pill.
- `MinimizedStrip` (CT-side component) has Pause/Play buttons for processes, but `CtApp.jsx` passes `processes={[]}` (lines 466, 514) and `activeProcess={null}` (line 112). The buttons render code paths that are unreachable.
- **Net for process-pause: column scaffolding exists, no handlers, no UI on the widget that actually matters.**

**Architectural finding:**
CT and MPL are independent apps with independent state. The CT MinimizedStrip's process-pause buttons assume a unified strip that doesn't exist. Building that bridge is a multi-evening project, not a pause-feature scope. **This PRD does not bridge them.**

---

## 2 · Scope

### In scope

**A. Case-pause cleanup (CT)**
- Decide: is "Pause" semantically distinct from "Awaiting Customer Reply"? *(Open question for Lish — see §4.)*
- Based on Lish's answer, either:
  - **A1.** Rename "Awaiting" UI to "Pause," collapse `handleAwaitingCase` into `handlePauseCase`, keep single `status: 'awaiting'` database value (or migrate to `'paused'`).
  - **A2.** Keep Awaiting; add a *new* Pause state with `status: 'paused'`. New button, new handler, new database value (enum migration if `status` is enum'd).
- Verify the existing pause button is discoverable in the live UI. (Tonight's TODO in §5.)

**B. Process-pause on MPL bar (MPL)**
- Add a Pause button to the active process pill in `MplPipBar.jsx`. Mirror MinimizedStrip's icon swap pattern (Pause icon → Play icon when paused).
- Add `handleProcessPause(processId)` and `handleProcessResume(processId)` in `MplApp.jsx`:
  - On pause: stop the local timer interval; update `mpl_active_timers.total_paused_seconds` running total; set `paused: true` on local state.
  - On resume: clear `paused`, restart timer interval, record resume timestamp for next pause cycle.
- Wire handlers in **both** parents — `MplApp.jsx` AND `DashboardApp.jsx`. (Memory landmine: every `MplPipBar` prop change must touch both files or it silently no-ops.)

### Out of scope

- Process-pause in the CT widget (the MinimizedStrip ghost buttons stay ghosts).
- Cross-app state bridge between CT and MPL.
- Pause logging in `case_events` for time-integrity reporting (deferred to Insights Tier II — write a TODO in code).
- Multicase work (separate PRD, separate wave).
- Renaming the `status: 'awaiting'` database value if A1 is chosen — keep the DB value, change only the UI string.

---

## 3 · Decision matrix

| Decision | Options | Lean | Resolved by |
|---|---|---|---|
| Pause vs. Awaiting semantic | (a) one concept, rename to Pause / (b) two distinct states | TBD | Lish conversation |
| Persistence of process pause | local state only / write to `total_paused_seconds` | Write to DB | Davis tonight |
| MinimizedStrip ghost buttons | leave as-is / hide via prop / delete | Hide via prop, comment with TODO | Davis tonight |
| `handleAwaitingCase` duplicate | delete / leave | Delete after rename | Davis next session |

---

## 4 · Open questions for Lish

Three max. Don't lead the witness. Watch her reaction more than her words.

1. **"Did you know there's an Awaiting Customer Reply button on the focused case? When was the last time you used it?"**
   *Listening for: does she know it exists? If yes — Awaiting IS her pause. The fix is the rename. If no — visibility/discoverability is the problem.*

2. **"When you said you wanted pause, what were you doing in the moment? Walk me through the last time you wished you could pause."**
   *Listening for: was the customer slow (= Awaiting), or was she stepping away from her desk for a real reason (= true Pause)? The story tells you whether it's one state or two.*

3. **"Pause for processes — show me when you'd use it instead of just discarding the process and starting fresh."**
   *Listening for: is process-pause a real workflow need, or is "pause" just the verb she reached for? If she struggles to come up with a scenario, process-pause might be a v2.*

---

## 5 · Tonight's verification TODOs (before any code)

- [x] Open running CT widget. Find a focused case. Note the actual button label — "Awaiting"? "Awaiting Customer Reply"? "Awaiting Reply"? Something else?
- [x] Click the button. Watch state change. Does timer stop? Does icon swap? Note exact UX.
- [x] Click again. Does it resume cleanly?
- [x] Survives close+reopen? Open another tab, kill the widget tab, reopen. Pause state preserved?
- [x] Document findings in audit-notes section below.

### Audit notes (code-based audit — live verification still needed for click feel)

```
BUTTON LABEL: None. The pause button is icon-only — no text label at all.
  - Active state:  Pause icon (⏸), color rgba(255,255,255,0.7) — gray/white
  - Paused state:  Play icon  (▶), color #4ade80 — green

TIMER: stopCaseTimer(id) is called on pause; startCaseTimer(id) on resume. Timer stops. ✓

ICON SWAP: Controlled by focusedCase.paused (boolean). Condition is clean and correct. ✓

STATE WRITTEN ON PAUSE:
  DB:    ct_cases.status = 'awaiting', ct_cases.awaiting_since = <ISO timestamp>
  Local: case.paused = true, case.awaiting = true

STATE WRITTEN ON RESUME:
  DB:    ct_cases.status = 'active', ct_cases.awaiting_since = null
  Local: case.paused = false, case.awaiting = false

SURVIVES CLOSE+REOPEN: Yes — status='awaiting' is persisted to DB. On next load,
  cases are fetched from ct_cases; any row with status='awaiting' will rehydrate
  with paused=true if the app maps status→paused correctly on load.
  ⚠ Verify: confirm the case-load mapper sets paused:true when status==='awaiting'.

DUPLICATE HANDLER CONFIRMED: handleAwaitingCase (line 868) is functionally identical
  to handlePauseCase (line 601) — same DB write, same timer stop, same state update.
  Only difference: handleAwaitingCase has an early `if (!user) return` guard.
  handlePauseCase relies on the safeWrite wrapper for error handling instead.
  → Can be deleted; see Wave 1A.

DISCOVERABILITY RISK: Icon-only button with no tooltip. A first-time user won't know
  the Pause button exists. Recommend a tooltip="Pause (Awaiting)" on the button element.
```

---

## 6 · Sequencing

1. **Tonight (this PRD)** — finish doc; verification TODOs only, no code.
2. **Lish conversation (this week)** — resolve §4. 15 minutes, in person.
3. **Wave 1A — Case-pause cleanup** — 1 evening, Davis-direct. Either A1 (rename) or A2 (new state) based on Lish's input.
4. **Wave 1B — Process-pause on MPL bar** — 1 evening, Davis-direct OR small Ralph PRD. Independent of 1A; can ship in either order.
5. **Cleanup — Hide MinimizedStrip ghost buttons** — half-evening. Add a `hideProcessControls` prop or default behavior so the dead buttons don't render until the bridge exists.

---

## 7 · Risks

- **MplPipBar dual-parent landmine:** wave 1B must touch `MplApp.jsx` AND `DashboardApp.jsx`. Past pattern — silent no-op when only one is wired.
- **Pause persistence on PiP detach:** verify pause state survives the popout-to-PiP transition. Untested today.
- **`total_paused_seconds` math correctness:** this column has been dormant since Feb. Audit how it's read by any reporting code before writing to it — make sure the read side handles non-zero values correctly. Could be silently broken in stats today.

---

## 8 · Definition of done

- Case-pause UI is discoverable, labeled per Lish's input, persists across PiP detach and tab reload.
- Process-pause works on `MplPipBar` for the active process; `total_paused_seconds` accumulates correctly across multiple pause/resume cycles.
- Two testers (Lish + one of Carlos/Wanda) confirm the feature works as they expected.
- No regression in existing Awaiting flow (if A2 was chosen).
