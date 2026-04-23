# Meridian Unified Start — Detect-At-Click PRD

## Project Overview

Moves mode detection from **bookmarklet-click time** to **Start-button-click time**. Today the bookmarklet reads the page and bakes `mode: 'single' | 'mass'` into `MERIDIAN_PAYLOAD`; the widget commits to a mode on injection and can't change it without being closed and re-opened. Post-change, the bookmarklet stops detecting mode entirely. The widget injects with one neutral idle state and one Start button. When the user clicks Start, the widget reads the current page context and dispatches to the single-case flow or the mass flow based on what's on screen at that instant.

**Why this is better:** matches the user's mental model ("Start tracking whatever I'm doing right now"), eliminates mode-drift when navigating with the widget open, removes the two-click mode-switch gotcha, and kills a whole family of timing bugs around when mode gets "frozen in."

**Stack:** vanilla JS shadow-DOM overlay (`public/ct-widget.js`), bookmarklet trigger (`public/meridian-trigger.js`), Supabase RPCs unchanged. No database changes.

**Success criteria:**
1. A user clicks the Meridian bookmarklet on any SF page. The widget appears with a neutral idle bar: `[M° logo] [Start] [N Resolved] [N Reclass] [N Calls] [N Total] [▼] [×]`. Same on record pages, list views, and other SF pages.
2. Clicking **Start** on a case record page (`/lightning/r/Case/500.../view`) behaves exactly like today's `handleStartCase`: scrapes case number + type + subtype + sf_case_id + account, starts the single-case timer.
3. Clicking **Start** on a case list view with N rows checked behaves exactly like today's `handleStartMass`: collects checked rows via deep-walk, shows the confirm sub-state.
4. Clicking **Start** on a case list view with 0 rows checked shows a toast: `"No cases selected. Check rows, then click Start."` Widget stays in idle.
5. Clicking **Start** on a page that's neither (account page, report, etc.) shows a toast: `"Open a Salesforce case or list view to start tracking."` Widget stays in idle.
6. A user can click the bookmarklet on a list view, see the widget, navigate to a case record page, click Start — and the single-case flow fires. No close-and-reopen cycle.

---

## Architecture & Key Decisions

**These decisions are locked. Do NOT relitigate during execution.**

- **Mode detection moves from the trigger to the widget's Start handler.** `meridian-trigger.js` no longer computes or passes `mode`. `MERIDIAN_PAYLOAD.mode` becomes unused (Task 1 removes it). The widget's `handleStart()` function (new, unified) reads `window.location.pathname` and the current DOM at click time.
- **The widget has one idle state, period.** `renderMass()`'s separate idle sub-state goes away. Both single and mass flows start from the SAME neutral idle bar produced by `renderSingle()` (which is renamed to `renderIdle()` for semantic clarity, since it now serves both flows).
- **`state.mode` becomes a post-Start-click flag.** Before Start: `state.mode === 'idle'`. After Start: `'single'` (timer running) or `'mass'` (confirm panel, etc). `state.mode === 'idle'` renders the new unified idle bar. `state.mode === 'single'` with `state.caseNumber` set renders the active-case bar. `state.mode === 'mass'` renders the mass sub-states (confirm / submitting / success / error).
- **Widget appearance is identical on every page before Start is clicked.** No pre-peek, no mode hint on the button label. Just "Start." Davis's explicit design call.
- **Ambiguous page detection falls back to a toast.** If `handleStart()` can't confidently determine either mode, it shows a toast and stays in idle. Davis's explicit design call.
- **Existing `handleStartCase` and `handleStartMass` stay as separate functions.** They're well-scoped and correct. The new `handleStart()` is a thin dispatcher on top of them. Do NOT merge their bodies.
- **`_meridianRefresh` simplifies.** It no longer needs to propagate `mode` from the payload because the payload no longer carries it. It just updates the userId / relay reference and re-renders.
- **No migration. No Supabase changes. No relay changes.** This is a pure client refactor.
- **Branch: `feat/detect-at-start`**, off current `main`.

---

## File Structure

**Modified files:**
```
public/meridian-trigger.js
  — remove detectMode() function and the MERIDIAN_PAYLOAD.mode = detectMode()
    line. Trigger becomes mode-blind.

public/ct-widget.js
  — rename renderSingle to renderIdle + renderSingleActive (or keep renderSingle
    for the active case render and break out renderIdle); remove renderMass's
    idle sub-state; add handleStart() dispatcher; rewire the Start button's
    data-action to "start" (unified) with event-delegation routing to
    handleStart; add detectModeAtStart() function; tighten _meridianRefresh.
```

**NOT modified:**
```
public/meridian-relay.html            — no changes
src/mpl/MplApp.jsx                    — no changes
src/hooks/usePendingTriggers.js       — no changes
All supabase/migrations/*             — never edit existing migrations
src/ components/ etc.                 — no React changes
src/components/onboarding/Step3Bookmarklet.jsx — bookmarklet HREF stays as-is
```

---

## Environment & Setup

- Already-deployed RPCs from migration 022 (`bulk_reclassify_cases(p_user_id, p_case_refs)`, `undo_mass_reclass_batch(p_user_id, p_batch_id)`) — unchanged.
- Supabase project ref: `wluynppocsoqjdbmwass`.
- Bookmarklet HREF is unchanged — it still fetches `meridian-trigger.js` via the relay.
- Relay (`meridian-relay.html`) is unchanged — it still supports all four actions (SUPABASE_INSERT_TRIGGER, SUPABASE_POST, SUPABASE_GET, SUPABASE_RPC, FETCH_CODE).

---

## Tasks

### Phase 0: Branch setup

- [x] **Task 0: Create branch off current main**
  - Run: `git checkout main && git pull && git checkout -b feat/detect-at-start`
  - Test: `git branch --show-current` returns `feat/detect-at-start`.
  - Test: `git log --oneline -1` shows `94cc98b Merge fix/mass-mode-visual-parity into main` or later.

### Phase 1: Strip mode detection from the trigger

- [x] **Task 1: Remove detectMode from meridian-trigger.js**
  - View `public/meridian-trigger.js`. Find `function detectMode()` (~line 57) and the line `MERIDIAN_PAYLOAD.mode = detectMode();` (~line 89).
  - Delete the entire `function detectMode() { ... }` block.
  - Delete the `MERIDIAN_PAYLOAD.mode = detectMode();` line.
  - Also delete the `walkShadow` helper at the top of the IIFE (lines ~19-31) — it was only used by `detectMode`'s fallback. If `walkShadow` is referenced anywhere else in the trigger, keep it and only remove the `detectMode` function.
  - Update the comment block at the top of the file (lines 1-13) that describes `MERIDIAN_PAYLOAD` contents — remove the `mode:` line from the comment.
  - Test: `node -c public/meridian-trigger.js` exits 0.
  - Test: `grep -c "function detectMode" public/meridian-trigger.js` returns `0`.
  - Test: `grep -c "MERIDIAN_PAYLOAD.mode" public/meridian-trigger.js` returns `0`.
  - Test: `wc -l public/meridian-trigger.js` returns a number smaller than the current line count (file should shrink by ~25-30 lines).

### Phase 2: Restructure widget state and render dispatch

- [x] **Task 2: Change state.mode default and semantics in ct-widget.js**
  - View `public/ct-widget.js` lines 47-70 (the state object literal).
  - Change the default for `mode` from reading `MERIDIAN_PAYLOAD.mode || 'single'` to just `'idle'`:
    ```js
    mode: 'idle',
    ```
  - Also update the top-of-file comment (line 4) that describes `MERIDIAN_PAYLOAD` — remove the `mode:` entry (widget no longer reads it from payload).
  - In `_meridianRefresh` (around line 893), remove the line `if (payload && payload.mode) state.mode = payload.mode;`. The refresh handler no longer propagates mode from the payload. The mode is controlled entirely by the Start button click now.
  - Test: `node -c public/ct-widget.js` exits 0.
  - Test: `grep -c "mode: 'idle'" public/ct-widget.js` returns `1`.
  - Test: `grep -c "MERIDIAN_PAYLOAD.mode" public/ct-widget.js` returns `0`.

- [x] **Task 3: Update render() dispatcher to route three modes**
  - Find the `render()` dispatcher function (~line 865):
    ```js
    function render() {
      if (state.mode === 'mass') renderMass();
      else renderSingle();
    }
    ```
  - Replace with a three-way dispatch:
    ```js
    function render() {
      if (state.mode === 'mass') renderMass();
      else if (state.mode === 'single') renderSingle();
      else renderIdle();
    }
    ```
  - `renderIdle` is a new function added in Task 4.
  - Test: `grep -c "renderIdle\|renderSingle\|renderMass" public/ct-widget.js` returns at least `6` (dispatcher + three declarations, each mentioned at least twice).

### Phase 3: Extract the idle state and add detectModeAtStart

- [x] **Task 4: Add renderIdle() as the neutral pre-Start bar**
  - The current `renderSingle()` handles TWO sub-states internally: idle (no case) around lines 670-690, and active (case loaded) below it. Keep `renderSingle()` but simplify it to ONLY render the active-case case — the idle branch moves to a new `renderIdle()` function.
  - Add a new function `renderIdle()` near `renderSingle()`. The body renders the exact same bar the current `renderSingle()` idle branch renders, with one change: the Start button's `data-action` becomes `"start"` (unified) instead of `"startcase"`.
  - Target implementation:
    ```js
    function renderIdle() {
      var total = state.stats.resolved + state.stats.reclass + state.stats.calls;

      // ── Shell primitives (copy from renderSingle, same pattern) ─────────
      var mLogo =
        '<div data-action="dashboard" title="Open Meridian Dashboard" style="' +
          'width:28px;height:28px;border-radius:7px;background:#003087;' +
          'display:flex;align-items:center;justify-content:center;' +
          'cursor:pointer;flex-shrink:0;' +
        '"><img src="' + MERIDIAN_ICON_B64 + '" alt="Meridian" style="' +
          'width:20px;height:20px;display:block;pointer-events:none;' +
        '"/></div>';

      var statPills =
        '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
          '<button style="' +
            'height:26px;padding:0 10px;border-radius:6px;border:none;' +
            'background:#22c55e;color:#fff;font-size:11px;font-weight:700;cursor:default;' +
          '">' + state.stats.resolved + ' Resolved</button>' +
          '<button style="' +
            'height:26px;padding:0 10px;border-radius:6px;border:none;' +
            'background:#ef4444;color:#fff;font-size:11px;font-weight:700;cursor:default;' +
          '">' + state.stats.reclass + ' Reclass</button>' +
          '<button style="' +
            'height:26px;padding:0 10px;border-radius:6px;border:none;' +
            'background:#3b82f6;color:#fff;font-size:11px;font-weight:700;cursor:default;' +
          '">' + state.stats.calls + ' Calls</button>' +
          '<button style="' +
            'height:26px;padding:0 10px;border-radius:6px;border:none;' +
            'background:#6b7280;color:#fff;font-size:11px;font-weight:700;cursor:default;' +
          '">' + total + ' Total</button>' +
        '</div>';

      var divider = '<div style="width:1px;height:20px;background:rgba(255,255,255,0.1);flex-shrink:0;"></div>';
      var spacer  = '<div style="flex:1;"></div>';
      var minBtn  = '<button data-action="minimize" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:12px;cursor:pointer;padding:0 2px;flex-shrink:0;">';
      var closeBtn =
        '<button data-action="close" style="' +
          'background:none;border:none;color:rgba(255,255,255,0.4);' +
          'font-size:14px;cursor:pointer;padding:0 2px;flex-shrink:0;' +
        '">\u00d7</button>';

      var barStyle =
        'height:44px;background:' + T.bg + ';' +
        'border:1px solid ' + T.border + ';border-radius:10px;' +
        'display:flex;align-items:center;gap:6px;padding:0 10px;' +
        'box-shadow:0 4px 16px rgba(0,0,0,0.4);' +
        'font-family:' + T.font + ';cursor:move;user-select:none;';

      var toastHtml = state.toastMsg
        ? '<div style="' +
            'position:absolute;bottom:-28px;left:50%;transform:translateX(-50%);' +
            'background:#065f46;color:#fff;padding:4px 12px;border-radius:6px;' +
            'font-size:11px;font-weight:600;white-space:nowrap;' +
            'box-shadow:0 2px 8px rgba(0,0,0,0.3);pointer-events:none;' +
          '">' + state.toastMsg + '</div>'
        : '';

      // ── Minimized ────────────────────────────────────────────────────────
      if (state.isMinimized) {
        shadow.innerHTML =
          '<div id="ct-header" style="' + barStyle + '">' +
            mLogo +
            spacer +
            minBtn + '\u25b2</button>' +
            closeBtn +
          '</div>';
        return;
      }

      // ── Idle bar ─────────────────────────────────────────────────────────
      shadow.innerHTML =
        '<div id="ct-header" style="position:relative;' + barStyle + '">' +
          mLogo +
          '<button data-action="start" style="' +
            'height:26px;padding:0 12px;border-radius:6px;border:none;' +
            'background:#E8540A;color:#fff;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;' +
          '">Start</button>' +
          divider +
          statPills +
          spacer +
          minBtn + '\u25bc</button>' +
          closeBtn +
          toastHtml +
        '</div>';
    }
    ```
  - Stat pills in idle state are display-only (no `data-action`, `cursor:default`) — they show day totals but aren't interactive before any session has started. This matches mass-mode's visual-parity decision.
  - Test: `grep -c "function renderIdle" public/ct-widget.js` returns `1`.
  - Test: `grep -c "data-action=\"start\"" public/ct-widget.js` returns at least `1`.
  - Test: `node -c public/ct-widget.js` exits 0.

- [x] **Task 5: Simplify renderSingle() to handle only the active-case state**
  - `renderSingle()` currently has an internal `if (!isActive)` branch that produces the idle bar. That branch is now duplicated in `renderIdle()`. Remove it from `renderSingle()` — the function should only render the active-case bar. If `render()` is called with `state.mode === 'single'` but `state.caseNumber` is empty (shouldn't happen in practice), fall back to `renderIdle()`.
  - Replace the top of `renderSingle()` with a guard:
    ```js
    function renderSingle() {
      if (!state.caseNumber) { renderIdle(); return; }  // defensive
      var total = state.stats.resolved + state.stats.reclass + state.stats.calls;
      var isActive = true;
      // ... rest of existing body, starting from `var mLogo = ...`
      // ... KEEP the "Active (case loaded)" render block at the bottom.
      // ... DELETE the "Minimized" block (that's now in renderIdle when state.mode === 'idle';
      //     if renderSingle is called with a case loaded AND minimized, it still needs a
      //     minimized variant — see next bullet).
    }
    ```
  - The `state.isMinimized` branch inside `renderSingle()` today shows the case number + timer in a compact form. Keep that — when a single-case timer is running AND the widget is minimized, we want the compact case-plus-timer readout. This minimized branch stays in `renderSingle()`.
  - The `if (!isActive)` idle branch inside `renderSingle()` — delete it entirely.
  - Test: `grep -c "function renderSingle" public/ct-widget.js` returns `1`.
  - Test: `grep -c "if (!isActive)" public/ct-widget.js` returns `0`.
  - Test: `grep -c "data-action=\"startcase\"" public/ct-widget.js` returns `0` (old data-action gone).
  - Test: `node -c public/ct-widget.js` exits 0.

- [x] **Task 6: Remove renderMass's idle sub-state**
  - View `renderMass()`. It currently has an `if (sub === 'idle')` block that produces the mass-mode idle bar with "Start" button and "N Cases Selected" badge.
  - Remove that entire `if (sub === 'idle')` block. The `renderMass` function should now ONLY handle sub-states `confirm`, `submitting`, `success`, `error`, and `minimized`.
  - Add a defensive fallback at the top: if `state.mode === 'mass'` but `state.massSubState === 'idle'` (shouldn't happen post-refactor), render the idle bar instead:
    ```js
    function renderMass() {
      if (state.massSubState === 'idle') { renderIdle(); return; }  // defensive
      // ... rest of existing body ...
    }
    ```
  - Test: `grep -c "function renderMass" public/ct-widget.js` returns `1`.
  - Test: `grep -c "data-action=\"start-mass\"" public/ct-widget.js` returns `0` (old data-action gone — the Start button now lives only in renderIdle and uses data-action="start").
  - Test: `grep -c "Cases Selected" public/ct-widget.js` returns `0` (old idle-state badge text gone — the count now only appears in the confirm sub-state as part of "Reclassify N cases?").
  - Test: `node -c public/ct-widget.js` exits 0.

### Phase 4: Add the unified dispatcher

- [x] **Task 7: Add detectModeAtStart() function**
  - Insert a new function near the other helpers (after `walkShadowLocal` and before `collectSelectedCasesFromDom` is a natural spot). The function reads the current page and returns `'single'`, `'mass'`, or `'none'`:
    ```js
    function detectModeAtStart() {
      // Single-case record page: /lightning/r/Case/500.../view
      if (window.location.pathname.indexOf('/lightning/r/Case/') === 0) {
        return 'single';
      }
      // Case list view: /lightning/o/Case/list
      if (window.location.pathname.indexOf('/lightning/o/Case/list') === 0) {
        return 'mass';
      }
      // Fallback: if any checked case rows exist in the DOM, treat as mass
      var foundCheckedRow = false;
      try {
        walkShadowLocal(document.documentElement, function (n) {
          if (foundCheckedRow) return;
          if (!n.getAttribute) return;
          var kv = n.getAttribute('data-row-key-value');
          if (!kv || kv.indexOf('500') !== 0) return;
          var cb = n.querySelector && n.querySelector('input[type="checkbox"]');
          if (cb && cb.checked) foundCheckedRow = true;
        });
      } catch (e) {}
      if (foundCheckedRow) return 'mass';
      // Last fallback: if the document title has an 8+ digit number, treat as single
      if (document.title && /\d{8,}/.test(document.title)) return 'single';
      return 'none';
    }
    ```
  - The fallback logic matters: on a record page even if the URL doesn't match `/lightning/r/Case/` exactly (console mode variants etc.), the page title will contain the case number. On a list view without an exact URL match, checked rows are the tell.
  - Test: `grep -c "function detectModeAtStart" public/ct-widget.js` returns `1`.
  - Test: `node -c public/ct-widget.js` exits 0.

- [x] **Task 8: Add handleStart() dispatcher**
  - Insert `handleStart` near the other handlers (after `handleStartCase` and `handleStartMass`). It's a thin dispatcher:
    ```js
    function handleStart() {
      var mode = detectModeAtStart();
      if (mode === 'single') {
        state.mode = 'single';
        handleStartCase();     // existing — scrapes case + starts timer
        return;
      }
      if (mode === 'mass') {
        // Check before committing to mass mode — if no rows checked, stay in idle.
        var cases = collectSelectedCasesFromDom();
        if (!cases.length) {
          showWidgetToast('No cases selected. Check rows, then click Start.');
          return;
        }
        state.mode = 'mass';
        state.massCases = cases;
        state.massSubState = 'confirm';
        render();
        return;
      }
      // mode === 'none'
      showWidgetToast('Open a Salesforce case or list view to start tracking.');
    }
    ```
  - Note that this **replaces** the existing `handleStartMass` flow for entering mass mode. `handleStartMass` itself stays on the file but is no longer called directly from a button — `handleStart` now does its job (collect cases + transition to confirm). Keep `handleStartMass` for now as dead code; Task 9 deletes it cleanly.
  - Note `handleStart` sets `state.mode = 'single'` explicitly BEFORE calling `handleStartCase` so the render() dispatcher picks the right branch after the timer starts.
  - Test: `grep -c "function handleStart\b" public/ct-widget.js` returns `1`.
  - Test: `grep -c "function handleStart\|function handleStartCase\|function handleStartMass" public/ct-widget.js` returns at least `3`.
  - Test: `node -c public/ct-widget.js` exits 0.

- [ ] **Task 9: Delete now-dead handleStartMass**
  - Remove the `function handleStartMass()` declaration and body. `handleStart` does its job now; `handleStartMass` has no callers.
  - Test: `grep -c "function handleStartMass" public/ct-widget.js` returns `0`.
  - Test: `grep -c "handleStartMass" public/ct-widget.js` returns `0` (no callers remain).
  - Test: `node -c public/ct-widget.js` exits 0.

### Phase 5: Wire the event delegation

- [ ] **Task 10: Update event delegation to route data-action="start" to handleStart**
  - View the shadow `click` event handler (around line 912). It currently routes `data-action="startcase"` to `handleStartCase` and `data-action="start-mass"` to... something (probably `handleStartMass`).
  - Change:
    - Add: `else if (action === 'start') { handleStart(); }`
    - Remove: the `action === 'startcase'` branch (the data-action is gone from the render functions — any stale references are safe to remove).
    - Remove: the `action === 'start-mass'` branch (same rationale).
    - Keep all other data-action routes unchanged: `resolve`, `reclass`, `call`, `awaiting`, `dismisscase`, `minimize`, `close`, `dashboard`, `confirm-mass`, `cancel-mass`, `undo-mass`, `dismiss-mass`.
  - Test: `grep -c "action === 'start'" public/ct-widget.js` returns `1`.
  - Test: `grep -c "action === 'startcase'" public/ct-widget.js` returns `0`.
  - Test: `grep -c "action === 'start-mass'" public/ct-widget.js` returns `0`.
  - Test: `grep -c "action === 'confirm-mass'\|action === 'cancel-mass'\|action === 'undo-mass'\|action === 'dismiss-mass'" public/ct-widget.js` returns at least `4` (the mass sub-state actions stay).
  - Test: `node -c public/ct-widget.js` exits 0.

### Phase 6: Verification

- [ ] **Task 11: Run the full test matrix**
  - Build: `npx vite build 2>&1 | tail -10` — no errors.
  - Syntax: `node -c public/ct-widget.js` and `node -c public/meridian-trigger.js` — both exit 0.
  - HTML structure sanity: grep `public/meridian-relay.html` to confirm we didn't touch it: `git diff --stat public/meridian-relay.html` should be empty.
  - Scope check:
    ```bash
    git diff --stat main...HEAD
    ```
    Expected: only two modified files — `public/ct-widget.js` and `public/meridian-trigger.js`. Plus PRD.md and progress.txt (tracking files). Anything else appearing in the diff is a bug.

- [ ] **Task 12: Commit summary**
  - Run `git log --oneline main..HEAD`. Append the commit list to `progress.txt` under "Detect-at-Start — final commits".
  - Append a "Davis: manual steps" section:
    1. Review `git diff main...feat/detect-at-start`.
    2. Push branch, open PR, merge.
    3. Vercel auto-deploys. Hard-refresh SF tab.
    4. Test Scenario A: On a case record page, click bookmarklet → widget appears with Start button. Click Start → single-case timer starts with case populated. Verify `ct_cases` row has case_type, case_subtype, sf_case_id, account_id.
    5. Test Scenario B: On a case list view with 3 rows checked, click bookmarklet → widget appears with Start button (same appearance as Scenario A). Click Start → confirm panel expands showing 3 case numbers. Confirm → success state.
    6. Test Scenario C (mode switch): widget open in mass-confirm state → click Cancel to return to idle → navigate to a case record page → click Start → single-case timer starts. No close-and-reopen needed.
    7. Test Scenario D (empty list): On a list view with 0 rows checked, click bookmarklet → widget appears. Click Start → toast: "No cases selected. Check rows, then click Start." Widget stays in idle.
    8. Test Scenario E (unrecognized page): On an account page or random SF page, click bookmarklet → widget appears. Click Start → toast: "Open a Salesforce case or list view to start tracking." Widget stays in idle.

---

## Testing Strategy

- **Primary build check:** `npx vite build 2>&1 | tail -10` after every `public/` change.
- **Syntax:** `node -c` on both `public/ct-widget.js` and `public/meridian-trigger.js`.
- **No new migrations, so no SQL to apply.**
- **Browser testing is out of scope for Ralph.** Davis does the five scenarios manually after merge.

---

## Out of Scope

- Adding a `MutationObserver` or URL-change listener that auto-detects navigation. Davis's direction: detection at Start-click only.
- Pre-peek mode hints on the Start button label (e.g. "Start (3 cases)"). Davis's direction: identical always.
- Any change to `public/meridian-relay.html`. It's correct and unchanged.
- Any change to Supabase migrations, RPCs, or schema.
- Any change to `MplApp.jsx`, `DashboardApp.jsx`, or React-side code.
- Any change to `handleStartCase`'s body — the scrape logic stays.
- Any change to `collectSelectedCasesFromDom` or `walkShadowLocal` — both stay as-is; they're called by `detectModeAtStart` and `handleStart`.
- Modifying the bookmarklet HREF in `Step3Bookmarklet.jsx`.
- Refactoring the render functions beyond what's specified. Do NOT consolidate shell primitives into a shared helper; keep the existing "each render defines its own primitives" pattern.

---

## Notes for Ralph

- **The widget on the SF page is vanilla JS inside an IIFE.** No React, no framework. State is a plain mutable object. After mutating state, call `render()` to repaint. This is the existing pattern; do not change it.
- **`handleStart` must set `state.mode` BEFORE calling the downstream handler** so `render()` picks the right branch on subsequent renders.
- **`handleStartCase` already sets single-case state and calls `render()` at the end.** `handleStart` sets `state.mode = 'single'` and then calls `handleStartCase` — that's sufficient. Do NOT duplicate state mutations.
- **`handleStart` handles the mass-mode path inline** (collecting cases, setting `massSubState = 'confirm'`) instead of calling `handleStartMass`. This is why `handleStartMass` becomes dead code and gets deleted in Task 9. The logic isn't lost — it's just moved into `handleStart`.
- **Do NOT call `detectModeAtStart` from any code path other than `handleStart`.** The widget should not peek at mode before Start is clicked — that's the whole point of the refactor.
- **The existing minimized sub-state logic is split across two renders now:** `renderIdle` handles minimized when `state.mode === 'idle'` (shows just M° + minimize/close); `renderSingle` handles minimized when a case is loaded (shows M° + case number + timer); `renderMass` handles minimized when in a mass sub-state (not idle — shows just M° + minimize/close). Each render function owns its own minimized branch. Do NOT try to unify them.
- **Commit style:** one commit per task. Message format: `detect-at-start: [task N] <short description>`.
- **If a grep assertion fails, the task is not done.** Revisit the code. Do NOT loosen the grep.

---

## Order of Operations

1. Task 0 — branch.
2. Task 1 — strip trigger. No dependencies.
3. Task 2 — state change. Must precede Tasks 3-10.
4. Task 3 — dispatcher. Must precede Task 4 (which adds the renderIdle it dispatches to).
5. Task 4 — renderIdle. New function.
6. Task 5 — renderSingle simplification. After Task 4.
7. Task 6 — renderMass simplification. Independent of Tasks 4/5.
8. Task 7 — detectModeAtStart helper.
9. Task 8 — handleStart dispatcher. Depends on Task 7.
10. Task 9 — delete handleStartMass. After Task 8.
11. Task 10 — event delegation. Depends on Tasks 8 and 9.
12. Task 11 — verification. Must run after all code changes.
13. Task 12 — summary. Last.
