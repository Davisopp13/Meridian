# Meridian Mass Reclass PRD

## Project Overview

Adds a "mass reclassify" feature to Meridian that lets agents select multiple cases in a Salesforce list view, click the existing Meridian bookmarklet, and bulk-log them all as reclassified in one action. Eliminates the need to open each case individually to reclassify it.

**Success criteria:** An agent on a Salesforce case list view with 3+ rows checked can click the Meridian bookmarklet, see a confirmation modal in their Meridian PiP window listing the selected case numbers, click Confirm, and have matching `ct_cases` + `case_events` rows written — all without opening any individual case page. Existing single-case bookmarklet behavior on record pages remains unchanged.

**Stack:** Vite + React 18, Supabase (Postgres + Realtime + RPC), vanilla JS overlay widget on Salesforce pages, Node 18+, npm.

---

## Architecture & Key Decisions

**These decisions are locked. Do NOT relitigate them during execution.**

- **Bookmarklet stays one bookmarklet.** The existing bookmarklet becomes context-aware: record page → existing single-case widget flow (unchanged); list view with ≥1 checked row → mass reclass flow. No second bookmarklet, no new onboarding step.
- **DOM scraping on the SF list view.** Case numbers and SF Case IDs are read from the native SLDS datatable DOM. Primary selector: `tr[data-row-key-value]` for the SF Case ID and `th[data-label="Case Number"] span[title]` for the case number. Fallback selector: any `<span title>` in the row whose value matches `/^\d{8,}$/`. The primary signal for "is this row selected" is the native `<input type="checkbox">` inside each row — use `.checked`, NOT the `aria-selected` attribute on the `<tr>` (it lies).
- **Shadow DOM walk reuses the existing `dS()`-style recursive traversal pattern** from the current bookmarklet. The `<lightning-datatable>` renders rows inside a shadow root, so a non-recursive `document.querySelectorAll` will not find them.
- **Confirmation UI lives in the existing PiP window**, not on the SF page. The bookmarklet inserts a `pending_triggers` row with `action='mass_reclass'`; the PiP window's existing `usePendingTriggers` hook receives the Realtime event and opens a new `MassReclassModal` component. Reuses all existing trigger plumbing.
- **Batch writes via a Supabase RPC**, not a client loop. The RPC `bulk_reclassify_cases(p_case_refs jsonb)` accepts an array of `{ case_number, sf_case_id }` objects and writes N `ct_cases` rows + N `case_events` rows in a single transaction. Computes `reopen_count` server-side via a subquery per case_number.
- **Bulk rows carry `source = 'bulk'`** — a NEW enum value added to the `ct_cases.source` CHECK constraint in this migration. `duration_s` is `NULL` on bulk rows (they have no session). `started_at` = `ended_at` = `now()`.
- **Undo window of 10 seconds** after the batch completes. The confirmation modal's success state shows a countdown toast with an Undo button. Undo deletes the exact rows written (tracked by a `batch_id` UUID stamped on both `ct_cases` and `case_events`).
- **No widget changes on SF record pages.** The existing single-case widget file `public/ct-widget.js` is NOT modified in this PRD. Only `public/meridian-trigger.js` is modified, to add the list-view branch.

---

## File Structure

**New files:**
```
supabase/migrations/020_mass_reclass.sql   ← migration: source enum + RPC + batch_id columns
src/components/MassReclassModal.jsx        ← PiP-rendered confirmation + undo UI
src/hooks/useMassReclass.js                ← handler for action='mass_reclass' triggers
```

**Modified files:**
```
public/meridian-trigger.js                 ← add list-view detection + mass-reclass branch
src/hooks/usePendingTriggers.js            ← route action='mass_reclass' to useMassReclass
src/mpl/MplApp.jsx                         ← wire MassReclassModal into the PiP render tree
```

**NOT modified (protect these):**
```
public/ct-widget.js                        ← single-case widget, untouched
public/meridian-relay.html                 ← relay, untouched
src/ct/CtApp.jsx                           ← CT dashboard view, untouched
supabase/migrations/001-019                ← existing migrations, never edit
```

---

## Environment & Setup

- Supabase project ref: `wluynppocsoqjdbmwass` (Meridian, live).
- `ct_cases.source` CHECK constraint currently allows `'pip'` and `'manual'`. Migration 020 adds `'bulk'`.
- `pending_triggers` is already in the `supabase_realtime` publication. No publication changes needed.
- `ct_cases.reopen_count` column already exists (migration 002b era). The RPC stamps it per-row based on count of prior `resolution='resolved'` or `resolution='reclassified'` rows for the same `case_number`.
- `case_events` already allows `type='reclassified'` (migration 008 expanded the enum).
- The relay iframe at `meridian-relay.html` already exposes `SUPABASE_INSERT_TRIGGER` for inserts to `pending_triggers`. This is the mechanism the bookmarklet uses. No relay changes needed.
- Anon-key RLS on `pending_triggers` allows inserts with `WITH CHECK (true)` (established in prior tracks). The bookmarklet continues to use the anon key via the relay.
- The PiP window is implemented in `src/mpl/MplApp.jsx` (despite the filename, this is the unified PiP surface post-refactor). New modals render inside its component tree.

---

## Tasks

### Phase 1: Database Migration

- [x] **Task 1: Create migration 020_mass_reclass.sql**
  - Create `supabase/migrations/020_mass_reclass.sql` with the following SQL, all in one transaction:
  - **Add `'bulk'` to the source CHECK constraint on `ct_cases`:**
    ```sql
    ALTER TABLE public.ct_cases DROP CONSTRAINT IF EXISTS ct_cases_source_check;
    ALTER TABLE public.ct_cases ADD CONSTRAINT ct_cases_source_check
      CHECK (source IN ('pip', 'manual', 'bulk'));
    ```
  - **Add `batch_id` columns** to `ct_cases` and `case_events` for undo tracking:
    ```sql
    ALTER TABLE public.ct_cases ADD COLUMN IF NOT EXISTS batch_id uuid;
    ALTER TABLE public.case_events ADD COLUMN IF NOT EXISTS batch_id uuid;
    CREATE INDEX IF NOT EXISTS idx_ct_cases_batch_id ON public.ct_cases(batch_id) WHERE batch_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_case_events_batch_id ON public.case_events(batch_id) WHERE batch_id IS NOT NULL;
    ```
  - **Create the RPC `bulk_reclassify_cases`:**
    ```sql
    CREATE OR REPLACE FUNCTION public.bulk_reclassify_cases(p_case_refs jsonb)
    RETURNS TABLE (batch_id uuid, case_count int)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_user_id uuid := auth.uid();
      v_batch_id uuid := gen_random_uuid();
      v_now timestamptz := now();
      v_today date := (now() AT TIME ZONE 'America/New_York')::date;
      v_ref jsonb;
      v_case_number text;
      v_sf_case_id text;
      v_reopen_count int;
      v_new_case_id uuid;
      v_inserted int := 0;
    BEGIN
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'bulk_reclassify_cases: not authenticated';
      END IF;
      IF jsonb_typeof(p_case_refs) <> 'array' THEN
        RAISE EXCEPTION 'bulk_reclassify_cases: p_case_refs must be a JSON array';
      END IF;

      FOR v_ref IN SELECT * FROM jsonb_array_elements(p_case_refs)
      LOOP
        v_case_number := v_ref->>'case_number';
        v_sf_case_id  := v_ref->>'sf_case_id';
        CONTINUE WHEN v_case_number IS NULL OR v_case_number = '';

        SELECT COUNT(*) INTO v_reopen_count
        FROM public.ct_cases
        WHERE case_number = v_case_number
          AND resolution IN ('resolved', 'reclassified');

        INSERT INTO public.ct_cases (
          user_id, case_number, sf_case_id,
          started_at, ended_at, duration_s,
          status, resolution, is_rfc, source,
          entry_date, reopen_count, batch_id
        ) VALUES (
          v_user_id, v_case_number, v_sf_case_id,
          v_now, v_now, NULL,
          'closed', 'reclassified', false, 'bulk',
          v_today, v_reopen_count, v_batch_id
        )
        RETURNING id INTO v_new_case_id;

        INSERT INTO public.case_events (
          session_id, user_id, type, excluded, rfc, sf_case_id, batch_id
        ) VALUES (
          v_new_case_id, v_user_id, 'reclassified', false, false, v_sf_case_id, v_batch_id
        );

        v_inserted := v_inserted + 1;
      END LOOP;

      RETURN QUERY SELECT v_batch_id, v_inserted;
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.bulk_reclassify_cases(jsonb) TO authenticated;
    ```
  - **Create the RPC `undo_mass_reclass_batch`:**
    ```sql
    CREATE OR REPLACE FUNCTION public.undo_mass_reclass_batch(p_batch_id uuid)
    RETURNS int
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_user_id uuid := auth.uid();
      v_deleted int;
    BEGIN
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'undo_mass_reclass_batch: not authenticated';
      END IF;

      DELETE FROM public.case_events
      WHERE batch_id = p_batch_id AND user_id = v_user_id;

      DELETE FROM public.ct_cases
      WHERE batch_id = p_batch_id AND user_id = v_user_id;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;

      RETURN v_deleted;
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.undo_mass_reclass_batch(uuid) TO authenticated;
    ```
  - Test: `node -e "require('fs').readFileSync('supabase/migrations/020_mass_reclass.sql', 'utf8').length > 0 && console.log('ok')"` prints `ok`.
  - Note: Ralph does NOT apply this migration to the live database. Davis applies it manually via Supabase SQL Editor after reviewing the commit. Do not `supabase db push` or similar.

### Phase 2: Bookmarklet Context Detection

- [x] **Task 2: Add list-view detection to `meridian-trigger.js`**
  - Modify `public/meridian-trigger.js`. After the existing `isSalesforce` check and BEFORE the relay FETCH_CODE postMessage for `ct-widget.js`, add a list-view detection branch.
  - Detect list view using BOTH signals (either one is sufficient):
    - URL match: `window.location.pathname.includes('/lightning/o/Case/list')`
    - DOM presence: a `tr` element with a `data-row-key-value` attribute starting with `500` (SF Case Id prefix), found via the recursive shadow-DOM walker added in Task 3.
  - If list view is detected, call a new function `handleListViewContext(relay, userId, showToast)` (implemented in Task 3). Do NOT fall through to the single-case widget flow in this case.
  - If NOT list view, keep the existing flow: ask relay to FETCH_CODE `ct-widget.js` exactly as today.
  - Test: `node -c public/meridian-trigger.js` exits 0 (syntax check).
  - Test: `grep -c "handleListViewContext" public/meridian-trigger.js` prints `>= 2` (declaration + invocation).

- [x] **Task 3: Implement list-view DOM scrape in `meridian-trigger.js`**
  - Add a recursive shadow-DOM walker `function walkShadow(root, visitor)` at the top of the IIFE. It calls `visitor(node)` for every descendant in both light DOM and shadow DOM, recursing into any `node.shadowRoot` it finds. Mirrors the `dS()` pattern from the original bookmarklet.
  - Add `function collectSelectedCases()`:
    - Walks the document via `walkShadow`, collecting every `tr` element that has a `data-row-key-value` attribute starting with `500`.
    - For each such `tr`:
      - Find its checkbox: `tr.querySelector('input[type="checkbox"]')`. If missing or `!checkbox.checked`, skip this row.
      - Extract `sf_case_id` from `tr.getAttribute('data-row-key-value')`.
      - Extract `case_number` via primary selector first: `tr.querySelector('th[data-label="Case Number"] span[title]')?.getAttribute('title')`. If missing, fallback: scan all `<span title>` elements in the row and return the first whose `title` matches `/^\d{8,}$/`.
      - If `case_number` is truthy, push `{ case_number, sf_case_id }` onto the result array.
    - Returns the array. May be empty.
  - Add `function handleListViewContext(relay, userId, showToast)`:
    - Calls `collectSelectedCases()`.
    - If empty: `showToast('Meridian: Select cases in the list, then click again.', 'info')` and returns.
    - If non-empty: builds a `pending_triggers` payload with:
      ```js
      {
        user_id: userId,
        type: 'MERIDIAN_MASS_RECLASS',      // matches existing 'type' column naming
        action: 'mass_reclass',              // for future-proofing / symmetry
        page_url: window.location.href,
        // Store the cases array as JSON text in case_number for now to reuse existing schema
        // (see Task 4 decision note)
        case_number: JSON.stringify(cases)
      }
      ```
      — and sends it to the relay via `relay.postMessage({ relay: 'MERIDIAN_TRIGGER', id, action: 'SUPABASE_INSERT_TRIGGER', payload })`.
    - On success response: `showToast('Meridian: Opened with ' + cases.length + ' cases', 'success')`.
    - On failure response: `showToast('Meridian: Failed — ' + err, 'error')`.
  - Test: `node -c public/meridian-trigger.js` exits 0.
  - Test: `grep -c "walkShadow\|collectSelectedCases\|handleListViewContext" public/meridian-trigger.js` prints `>= 6`.
  - Decision note to preserve in progress.txt: We reuse the existing `pending_triggers` schema (no migration for a new `payload` column) by stuffing the JSON cases array into `case_number`. The PiP-side handler parses it back out. This keeps the migration surface minimal. If a future trigger type needs richer payloads, a proper `payload jsonb` column is a separate track.

### Phase 3: Pending-Trigger Routing

- [x] **Task 4: Extend `usePendingTriggers.js` to route mass_reclass**
  - Modify `src/hooks/usePendingTriggers.js`. The hook currently subscribes to inserts on `pending_triggers` and dispatches based on the `type` field (existing types: `MERIDIAN_CASE_START`, etc.).
  - Add a new case for `type === 'MERIDIAN_MASS_RECLASS'`. When matched:
    - Parse `row.case_number` as JSON into an array `cases`.
    - If parsing fails or array is empty, log a warning and delete the trigger row.
    - If valid, call a new handler `onMassReclass(cases, row.id)` that must be provided to the hook via its options/handlers object (same pattern as existing `onCaseStart`).
  - Update the hook's TypeScript/JSDoc signature (if applicable) to include `onMassReclass` as an optional handler.
  - Keep all existing type routing behavior unchanged.
  - Test: `npx vite build 2>&1 | tail -10` contains no errors.
  - Test: `grep -c "MERIDIAN_MASS_RECLASS\|onMassReclass" src/hooks/usePendingTriggers.js` prints `>= 3`.

- [ ] **Task 5: Create `useMassReclass.js` hook**
  - Create `src/hooks/useMassReclass.js` exporting a default hook that manages mass-reclass modal state.
  - State shape:
    ```js
    {
      modalState: 'idle' | 'confirming' | 'submitting' | 'success' | 'error',
      cases: [{case_number, sf_case_id}],    // pending list
      batchId: null | string,                 // set on success
      error: null | string,
      triggerRowId: null | string,            // pending_triggers.id to delete on close
    }
    ```
  - Exposed actions:
    - `openModal(cases, triggerRowId)` — sets state to `confirming` with the given cases.
    - `confirm()` — sets state to `submitting`, calls `supabase.rpc('bulk_reclassify_cases', { p_case_refs: cases })`. On success: sets `batchId` from the returned row, state → `success`. On error: state → `error`, populate `error` message.
    - `undo()` — calls `supabase.rpc('undo_mass_reclass_batch', { p_batch_id: batchId })`. Resets state to `idle` on success.
    - `close()` — deletes the `pending_triggers` row (`supabase.from('pending_triggers').delete().eq('id', triggerRowId)`) and resets state to `idle`.
  - Uses the existing Supabase client import pattern from `src/lib/supabase.js` (or wherever the project already imports from — match existing hooks).
  - Test: `npx vite build 2>&1 | tail -10` contains no errors.
  - Test: `grep -c "bulk_reclassify_cases\|undo_mass_reclass_batch" src/hooks/useMassReclass.js` prints `>= 2`.

### Phase 4: UI

- [ ] **Task 6: Create `MassReclassModal.jsx`**
  - Create `src/components/MassReclassModal.jsx`. Takes props: `{ state, cases, batchId, error, onConfirm, onUndo, onClose }`.
  - Follow the existing design token system — use CSS variables (`--bg-card`, `--text-pri`, `--text-sec`, `--border`, `--color-accent`, etc.) rather than hardcoded hex. Reference the existing `RFCPrompt` component for styling patterns.
  - Renders as a modal overlay centered in the PiP window when `state !== 'idle'`. Four visual states:
    - **confirming:** Header "Reclassify selected cases?" · body lists the case numbers (scrollable if >10, capped max-height ~240px) · footer with two buttons: `Cancel` (calls `onClose`) and `Reclassify N cases` (primary, calls `onConfirm`, where N is `cases.length`).
    - **submitting:** Header "Working…" · body shows a spinner and "Reclassifying N cases" · no buttons.
    - **success:** Header "Reclassified N cases" · body "Undo within 10 seconds" with a live countdown (10 → 0) · footer with `Undo` button (calls `onUndo`) and a subtle `Dismiss` link (calls `onClose`). After the countdown hits 0, auto-calls `onClose`.
    - **error:** Header "Something went wrong" · body shows the error message · footer with a `Close` button (calls `onClose`) and a `Retry` button (calls `onConfirm` again).
  - Modal width ~ 360px on the PiP viewport. Respect the existing PiP width (widget sizing constants in `src/lib/constants.js` if present).
  - Countdown implementation: `useEffect` with `setInterval(1000)` that decrements a local `secondsLeft` state, cleared on unmount or state change.
  - Test: `npx vite build 2>&1 | tail -10` contains no errors.
  - Test: `grep -c "cases.length\|onConfirm\|onUndo" src/components/MassReclassModal.jsx` prints `>= 3`.

- [ ] **Task 7: Wire `useMassReclass` + `MassReclassModal` into `MplApp.jsx`**
  - Modify `src/mpl/MplApp.jsx`. Import `useMassReclass` and `MassReclassModal`.
  - Inside the `MplApp` component:
    - Call `const massReclass = useMassReclass()` near other hook calls.
    - Pass `onMassReclass: (cases, triggerRowId) => massReclass.openModal(cases, triggerRowId)` into the existing `usePendingTriggers` options object alongside `onCaseStart` etc.
    - Render `<MassReclassModal {...massReclass.modalProps} />` (or equivalent — if the hook exposes individual props, spread them explicitly) inside the main PiP render tree, AFTER the existing child content but BEFORE closing the root wrapper, so it overlays everything else.
  - Do NOT modify any existing trigger handlers, timer logic, or MPL state.
  - Test: `npx vite build 2>&1 | tail -10` contains no errors.
  - Test: `grep -c "MassReclassModal\|useMassReclass\|onMassReclass" src/mpl/MplApp.jsx` prints `>= 3`.

### Phase 5: Regression Guard

- [ ] **Task 8: Verify no changes to protected files**
  - Run these checks and fail the task if any produce output:
    - `git diff --stat HEAD~7..HEAD -- public/ct-widget.js` — must be empty (widget file untouched).
    - `git diff --stat HEAD~7..HEAD -- public/meridian-relay.html` — must be empty (relay untouched).
    - `git diff --stat HEAD~7..HEAD -- src/ct/CtApp.jsx` — must be empty (CT dashboard untouched).
  - If any of these files show changes, halt and log the violation to progress.txt. Do NOT attempt to revert — let Davis review.
  - Test: Write the check commands into `scripts/check-mass-reclass-scope.sh` and run it. Exit 0 means all protected files are clean.

- [ ] **Task 9: Final build + commit summary**
  - Run `npx vite build 2>&1 | tail -20`. Must complete without errors.
  - Run `git log --oneline HEAD~8..HEAD`. Log the full commit list to progress.txt under a "Mass Reclass: final commits" heading.
  - Append to progress.txt a "Davis: manual steps to ship" section listing:
    1. Review commits on the `feat/mass-reclass` branch.
    2. Apply `supabase/migrations/020_mass_reclass.sql` via Supabase SQL Editor.
    3. Verify RPCs exist: `SELECT proname FROM pg_proc WHERE proname IN ('bulk_reclassify_cases', 'undo_mass_reclass_batch');` should return 2 rows.
    4. Push branch, open PR, merge when ready.
    5. End-to-end test: check 3 cases in an SF list view, click Meridian bookmarklet, confirm in PiP modal, verify 3 `ct_cases` rows with `source='bulk'` and matching `batch_id`.

---

## Testing Strategy

- **Primary build check:** `npx vite build 2>&1 | tail -10` — run after every task that modifies `src/` or `public/`. No errors permitted.
- **Syntax check for public JS:** `node -c public/meridian-trigger.js` — run after Tasks 2 and 3. Must exit 0.
- **Migration validity:** Migration SQL is NOT applied automatically. Ralph only verifies the file exists and is non-empty. Davis applies it manually.
- **No `npm test` requirement:** This project does not have a Jest/Vitest suite. Do not invent tests; rely on build + grep assertions specified per task.

---

## Out of Scope

**These are explicitly NOT part of this PRD. Do NOT build them, even if they seem like natural extensions.**

- Mass *resolve* (only mass reclassify, per scope).
- Bulk actions triggered from the Meridian dashboard queue screen — that's a separate track.
- Any change to `public/ct-widget.js` (the single-case widget).
- Any change to `public/meridian-relay.html`.
- Changes to the bookmarklet href or onboarding flow — the bookmarklet code itself (the `javascript:...` string in `BookmarkletModal.jsx` etc.) is unchanged. Only the fetched `meridian-trigger.js` gains new behavior.
- Merge-case handling (separate feature, separate PRD).
- Concurrent cases / pause-resume (separate feature, separate PRD).
- Adding Mass Reclass to MPL side — MPL has no reclass concept.
- Reading any SF list-view column OTHER than checkbox state, `data-row-key-value`, and the Case Number cell.
- Modifying RLS policies on `ct_cases` or `case_events` (SECURITY DEFINER on the RPCs handles auth).

---

## Notes for Ralph

- **The existing shadow-DOM walker pattern is the reference.** Look at `public/ct-widget.js` lines ~100–110 for how shadow roots are attached and how the CT 1.0 bookmarklet style pattern works. You are not adding shadow roots; you are *traversing* SF's shadow roots to find the datatable. Read-only traversal.
- **The list-view DOM evidence (grabbed from a live SF case list view on April 22, 2026):**
  - Row element: `<tr ... data-row-key-value="500cz00000yTp3fAAC" aria-selected="false" ...>` — `data-row-key-value` holds the SF Case Id even when `aria-selected` is `"false"`. Do NOT trust `aria-selected`.
  - Case number cell: `<th data-label="Case Number" ...> ... <span title="137480795">137480795</span> ... </th>` — `data-label` and `title` are the anchors. The visible text and `title` attribute carry the same value; prefer `title` for robustness.
  - Checkbox: `<input type="checkbox" name="lgt-datatable-8-options-60" ...>` — native HTML input, `.checked` is trustworthy. The checkbox name includes a per-datatable prefix (`lgt-datatable-8-`), so do NOT match by name — match by `input[type="checkbox"]` scoped to the row.
- **PiP window context.** `MplApp.jsx` is the root component rendered inside the PiP window (via `documentPictureInPicture`). It is NOT the Salesforce page. CSS custom properties are injected into the PiP document's `<head>` at mount — this is already working, you do not need to re-inject for the modal. Just use the tokens.
- **Supabase client auth.** Inside `MplApp.jsx` and its hooks, the Supabase client is authenticated with the user's session (JWT). `auth.uid()` in the RPC resolves to the real user. This is different from the bookmarklet path, which uses the anon key via the relay. Do not conflate the two auth contexts.
- **If a task's grep assertion fails**, it means the task's implementation is incomplete — DO NOT loosen the grep. Revisit the code.
- **If the build fails after a task**, revert that task's changes (git stash / reset), re-read the task, try again. Do NOT commit a broken build.
- **Commit style:** one commit per task. Commit message format: `mass-reclass: [task N] <short description>`.
- **Branch:** work on `feat/mass-reclass`. Create it off `main` at start of run if not already there.

---

## Order of Operations

1. Task 1 (migration file) — can run first; no dependencies.
2. Tasks 2 and 3 (bookmarklet) — Task 3 depends on Task 2's skeleton.
3. Tasks 4 and 5 (trigger routing + hook) — Task 5 depends on Task 4 conceptually but files are independent.
4. Task 6 (modal) — depends on Task 5's hook shape being stable.
5. Task 7 (wire into MplApp) — depends on Tasks 5 and 6.
6. Task 8 (regression check) — always last before 9.
7. Task 9 (summary) — final.
