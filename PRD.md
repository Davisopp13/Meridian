# Meridian Unified Start Button PRD

## Project Overview

Replaces the in-PiP mass-reclassify modal flow with a unified in-widget Start Button pattern on the Salesforce page. The existing CT overlay widget (`public/ct-widget.js`) learns a second mode: `single` (today's behavior — scrape a single case, time it, resolve/reclass/call it) and `mass` (new — scrape N checked cases from a list view, show compact count + Start, expand to confirmation list on Start, bulk-reclassify via RPC).

**The Start button becomes the single "capture happens now" moment for both modes.** The bookmarklet detects context and passes a mode hint. The widget does the actual DOM scraping at Start-click time, not at bookmarklet-click time — this matches user mental model and guarantees fresh data.

**Secondary outcome:** mass-reclass no longer depends on the PiP window being open. Confirmation lives on the SF page itself.

**Stack:** Vite + React 18 (dashboard app), vanilla JS shadow-DOM overlay (ct-widget.js on SF pages), Supabase (Postgres + RPC + RLS), Vercel.

**Success criteria:**
1. On an SF case record page, the CT widget opens in single mode (current behavior preserved). Clicking Start scrapes case number + type/subtype + sf_case_id + account_id and starts the timer with all four fields populated.
2. On an SF case list view with N rows checked, the CT widget opens in mass mode, compact, showing "N cases selected — Start". Clicking Start expands an inline panel listing the N case numbers with a Confirm button. Clicking Confirm calls the `bulk_reclassify_cases` RPC, writes N rows with `source='bulk'`, shows an undo window for 10 seconds.
3. Neither flow requires the PiP window to be open.
4. No regression in existing single-case behavior (bookmarklet on a case page, widget injects, case number populated from `MERIDIAN_PAYLOAD`, Start button not needed unless user navigated away — unchanged from today).

---

## Architecture & Key Decisions

**These decisions are locked. Do NOT relitigate them during execution.**

- **One widget file, two modes.** `public/ct-widget.js` learns a `state.mode` of either `'single'` (default) or `'mass'`. No new widget file, no separate mass-reclass file. Mode is added to `MERIDIAN_PAYLOAD` by the bookmarklet.
- **Context detection lives in the widget, not in the bookmarklet or trigger.** The bookmarklet passes raw context hints (the URL, the fact that a list-view-like DOM exists); the widget reads its own environment at init time and decides its mode. Rationale from Davis: keeping detection in a single file makes it easier to reason about, and lets the trigger stay minimal.
- **Capture (DOM scrape) happens at Start-click time in both modes.** In single mode, `handleStartCase` scrapes case_number / case_type / case_subtype / sf_case_id / account_id via the same shadow-DOM walk the bookmarklet uses. In mass mode, `handleStartMass` runs a deep walk to collect checked rows and their case numbers + sf_case_ids. The bookmarklet's initial payload only provides hints for display; the Start click is the source of truth.
- **The bookmarklet walks twice.** Once at bookmarklet-click to get a display count (mass mode) or a pre-filled payload (single mode, existing behavior). Once at Start-click in the widget to get fresh data. This is intentional — the first walk populates the UI hint ("3 cases selected"), the second walk is the real capture. Agents may change their selection between clicks.
- **Mass confirmation lives on the SF page.** The widget's mass mode has two sub-states: `mass-idle` (compact: "N cases selected — Start") and `mass-confirm` (expanded: case list + Confirm + Cancel). The Confirm button fires the `bulk_reclassify_cases` RPC via the relay. No `pending_triggers` row is ever written for mass-reclass.
- **All mass-reclass infrastructure built on `feat/mass-reclass` that depends on `pending_triggers` is deleted or superseded.** Specifically: `MERIDIAN_MASS_RECLASS` trigger type routing in `usePendingTriggers.js`, `useMassReclass.js` hook, `MassReclassModal.jsx`, and the `MERIDIAN_MASS_RECLASS` branch in `meridian-trigger.js` — all removed. Migration 021 (constraint expansion to allow `MERIDIAN_MASS_RECLASS`) is left in place — harmless, and reverting migrations is more risk than the cosmetic benefit. Migration 020 stays in full — the `bulk_reclassify_cases` and `undo_mass_reclass_batch` RPCs are reused verbatim; the `source='bulk'` constraint and `batch_id` columns are reused verbatim.
- **The relay gains one action: `SUPABASE_RPC`.** The widget needs to call `bulk_reclassify_cases` through the relay (SF CSP blocks direct calls to Supabase). The relay today supports `SUPABASE_INSERT_TRIGGER`, `SUPABASE_POST`, `SUPABASE_GET`, and `FETCH_CODE`. Adding `SUPABASE_RPC` is a new action that POSTs to `/rest/v1/rpc/{function_name}` with a JSON body.
- **Auth: the RPC call from the widget uses the anon key, not a user session JWT.** `bulk_reclassify_cases` is SECURITY DEFINER with `auth.uid()` guard. Because the widget has no user JWT (it uses the relay's anon key pattern like everything else from the SF page), `auth.uid()` will be null and the RPC will throw. **This PRD modifies the RPC to accept an explicit `p_user_id uuid` parameter instead of relying on `auth.uid()`.** The widget passes `state.userId` (baked in via `MERIDIAN_PAYLOAD`). Same pattern already used by `pending_triggers` inserts — user_id is trusted from the baked bookmarklet identity. This is a migration change (021 was already used by the branch, so the new RPC change goes in migration 022).
- **Single mode is untouched visually.** The Start button already exists in the widget for single mode (`handleStartCase` at line 374 of ct-widget.js today). Its *behavior* gets upgraded to scrape type/subtype/sf_case_id/account_id in addition to case_number (the fix queued separately in the earlier CC prompt becomes part of this PRD instead). No new UI for single mode.
- **Compact-first mass mode.** When the widget opens in mass mode, it shows "N cases selected — Start" in the same bar footprint as single mode. Start click expands the widget downward with the confirmation list. This matches Davis's answer (#3) — compact first, expand on Start. Swim-lane styling is deferred.
- **Undo behavior.** After a successful `bulk_reclassify_cases` call, the widget shows a third sub-state: `mass-success`, a 10-second countdown with an Undo button. Auto-dismisses at 0. Undo calls `undo_mass_reclass_batch` via the relay (also modified in migration 022 to accept `p_user_id`).
- **Branch: `feat/unified-start-button`.** New branch, off `main`. The `feat/mass-reclass` branch is NOT the base — too much of its code is being deleted to branch from it. Start fresh from `main` and cherry-pick only what survives (migration 020, the relay `SUPABASE_POST` action if it predates `feat/mass-reclass`).

---

## File Structure

**New files:**
```
supabase/migrations/022_unified_start_rpc_user_id.sql
   — drop+recreate bulk_reclassify_cases and undo_mass_reclass_batch
     with explicit p_user_id parameter instead of auth.uid().
```

**Modified files:**
```
public/ct-widget.js
   — add state.mode; add handleStartMass; expand handleStartCase to scrape
     type/subtype/sf_case_id/account_id; split render() into renderSingle()
     and renderMass(); add sub-state machine for mass-idle/mass-confirm/
     mass-success; add relayRpc() helper.

public/meridian-trigger.js
   — detect list-view context; pass mode='single' or mode='mass' to the
     widget via MERIDIAN_PAYLOAD; in mass mode, also pre-count checked rows
     for the initial display hint. Delete the SUPABASE_INSERT_TRIGGER path
     for MERIDIAN_MASS_RECLASS.

public/meridian-relay.html
   — add SUPABASE_RPC action that POSTs to /rest/v1/rpc/{fn_name} and
     returns the response body.

src/components/onboarding/Step3Bookmarklet.jsx
   — no change expected (the bookmarklet href just loads meridian-trigger.js
     which now handles mode detection itself). Leave the scrape logic in the
     href alone — it's still used for the single-case initial payload.
```

**Deleted files:**
```
src/hooks/useMassReclass.js
src/components/MassReclassModal.jsx
```

**Modified files (deletions within):**
```
src/hooks/usePendingTriggers.js
   — remove the MERIDIAN_MASS_RECLASS branch entirely. The remaining
     handlers (handleCaseStart, handleProcessStart) are untouched.

src/mpl/MplApp.jsx
   — remove the useMassReclass import, hook call, and MassReclassModal
     render. The remaining PiP content is untouched.
```

**NOT modified (protect these):**
```
src/ct/CtApp.jsx                 — CT dashboard view, unrelated
supabase/migrations/001-021      — all existing migrations, NEVER edit
src/lib/api.js                   — data layer wrappers, unrelated
```

---

## Environment & Setup

- Supabase project ref: `wluynppocsoqjdbmwass` (Meridian, live).
- Relay URL: `https://meridian-hlag.vercel.app/meridian-relay.html`. Hosted alongside `ct-widget.js` and `meridian-trigger.js` on Vercel.
- Bookmarklet anon key is baked into `meridian-relay.html` as `SUPABASE_ANON_KEY` (line ~27 of that file). Same key is used by the new SUPABASE_RPC action.
- `bulk_reclassify_cases` and `undo_mass_reclass_batch` were created in migration 020 with `auth.uid()` guards. Migration 022 in this PRD REPLACES both with versions that take `p_user_id uuid` as an explicit parameter.
- `ct_cases.source` CHECK constraint already allows `'bulk'` (migration 020). `batch_id uuid` columns on `ct_cases` and `case_events` already exist. No further schema changes needed beyond 022.
- `pending_triggers_type_check` constraint still lists `MERIDIAN_MASS_RECLASS` (migration 021). Harmless, unused after this PRD ships. Do NOT remove.
- Vercel auto-deploys `main`. Merging this branch to main is how the new trigger and widget code reach production.

---

## Tasks

### Phase 0: Branch setup

- [x] **Task 0: Create clean branch off main**
  - Run: `git checkout main && git pull && git checkout -b feat/unified-start-button`
  - Verify HEAD is at the latest main commit, NOT on `feat/mass-reclass`.
  - Test: `git log --oneline -1` shows the latest main commit. `git branch --show-current` returns `feat/unified-start-button`.

### Phase 1: Database migration

- [x] **Task 1: Create migration 022 with user_id-parameterized RPCs**
  - Create `supabase/migrations/022_unified_start_rpc_user_id.sql` with the following contents (one transaction):
    ```sql
    -- ============================================================
    -- 022_unified_start_rpc_user_id.sql
    -- Replace bulk_reclassify_cases and undo_mass_reclass_batch
    -- to accept explicit p_user_id instead of relying on auth.uid().
    -- Needed because the widget invokes these via the relay using the
    -- anon key — auth.uid() would be null.
    -- The widget passes state.userId (baked in at bookmarklet install
    -- via MERIDIAN_PAYLOAD), same trust model as pending_triggers inserts.
    -- ============================================================

    DROP FUNCTION IF EXISTS public.bulk_reclassify_cases(jsonb);
    DROP FUNCTION IF EXISTS public.undo_mass_reclass_batch(uuid);

    CREATE OR REPLACE FUNCTION public.bulk_reclassify_cases(
      p_user_id uuid,
      p_case_refs jsonb
    )
    RETURNS TABLE (batch_id uuid, case_count int)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
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
      IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'bulk_reclassify_cases: p_user_id is required';
      END IF;
      -- Sanity: user_id must exist in platform_users to prevent spoofing
      IF NOT EXISTS (SELECT 1 FROM platform_users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'bulk_reclassify_cases: unknown user_id %', p_user_id;
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
          p_user_id, v_case_number, v_sf_case_id,
          v_now, v_now, NULL,
          'closed', 'reclassified', false, 'bulk',
          v_today, v_reopen_count, v_batch_id
        )
        RETURNING id INTO v_new_case_id;

        INSERT INTO public.case_events (
          session_id, user_id, type, excluded, rfc, sf_case_id, batch_id
        ) VALUES (
          v_new_case_id, p_user_id, 'reclassified', false, false, v_sf_case_id, v_batch_id
        );

        v_inserted := v_inserted + 1;
      END LOOP;

      RETURN QUERY SELECT v_batch_id, v_inserted;
    END;
    $$;

    CREATE OR REPLACE FUNCTION public.undo_mass_reclass_batch(
      p_user_id uuid,
      p_batch_id uuid
    )
    RETURNS int
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_deleted int;
    BEGIN
      IF p_user_id IS NULL OR p_batch_id IS NULL THEN
        RAISE EXCEPTION 'undo_mass_reclass_batch: p_user_id and p_batch_id required';
      END IF;

      DELETE FROM public.case_events
      WHERE batch_id = p_batch_id AND user_id = p_user_id;

      DELETE FROM public.ct_cases
      WHERE batch_id = p_batch_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;

      RETURN v_deleted;
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.bulk_reclassify_cases(uuid, jsonb) TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.undo_mass_reclass_batch(uuid, uuid) TO anon, authenticated;

    SELECT proname, pronargs
    FROM pg_proc
    WHERE proname IN ('bulk_reclassify_cases', 'undo_mass_reclass_batch');
    ```
  - Test: `node -e "const s=require('fs').readFileSync('supabase/migrations/022_unified_start_rpc_user_id.sql','utf8'); if(s.length>500 && s.includes('p_user_id')) console.log('ok')"` prints `ok`.
  - Ralph does NOT apply the migration. Davis applies manually.

### Phase 2: Relay — add SUPABASE_RPC action

- [ ] **Task 2: Extend meridian-relay.html with SUPABASE_RPC action**
  - View `public/meridian-relay.html` lines 46-135 to see the message-relay handler pattern.
  - Add a new `else if (action === 'SUPABASE_RPC')` branch BEFORE the `else if (action === 'FETCH_CODE')` branch. Pattern:
    ```js
    else if (action === 'SUPABASE_RPC') {
      const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + payload.function, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload.args || {})
      });
      if (!resp.ok) {
        var errText = await resp.text();
        throw new Error(resp.status + ': ' + errText);
      }
      result = await resp.json();
    }
    ```
  - Do NOT modify the existing `SUPABASE_INSERT_TRIGGER`, `SUPABASE_POST`, `SUPABASE_GET`, or `FETCH_CODE` branches.
  - Do NOT change the outer message handler structure (the `relay: 'MERIDIAN_TRIGGER_RESPONSE'` response envelope stays identical).
  - Test: `grep -c "action === 'SUPABASE_RPC'" public/meridian-relay.html` returns `1`.
  - Test: `grep -c "/rest/v1/rpc/" public/meridian-relay.html` returns `1`.
  - Note: HTML files have no `node -c` check available. Verify structure by reading the file back and confirming the new branch is syntactically inside the async message handler.

### Phase 3: Bookmarklet trigger — mode detection

- [ ] **Task 3: Simplify and re-scope meridian-trigger.js**
  - Modify `public/meridian-trigger.js`. The goal: detect whether we're on a case record page or a list view, and pass the mode to the widget.
  - **Keep** the existing `walkShadow` helper (lines 19-31 today), the `isSalesforce` check, the `!userId` guard, the `!isSalesforce` toast branch, the `!relay` guard, the `FETCH_CODE` / widget-load flow, and the `showToast` UI at the bottom.
  - **Remove** the entire `isListView` / `handleListViewContext` / `collectSelectedCases` / `SUPABASE_INSERT_TRIGGER` mass-reclass flow (current lines ~55-167). The list-view detection and collection logic is MOVING INTO the widget file itself (Task 5), not deleted.
  - **Add** a small context-probe function that runs before the widget fetch:
    ```js
    function detectMode() {
      // Single-case record page: URL like /lightning/r/Case/500.../view
      if (window.location.pathname.indexOf('/lightning/r/Case/') === 0) {
        return 'single';
      }
      // List view: URL like /lightning/o/Case/list OR DOM has checked case rows
      if (window.location.pathname.indexOf('/lightning/o/Case/list') === 0) {
        return 'mass';
      }
      // Fallback: if walkShadow finds any tr[data-row-key-value^="500"], treat as mass
      var foundCaseRow = false;
      try {
        walkShadow(document.documentElement, function (n) {
          if (foundCaseRow) return;
          if (!n.getAttribute) return;
          var kv = n.getAttribute('data-row-key-value');
          if (kv && kv.indexOf('500') === 0) foundCaseRow = true;
        });
      } catch (e) {}
      return foundCaseRow ? 'mass' : 'single';
    }
    ```
  - Inject the detected mode into the widget via `MERIDIAN_PAYLOAD`. Look at the existing line `(new Function('MERIDIAN_PAYLOAD', e.data.data.code))(MERIDIAN_PAYLOAD)` — the payload object passed is the same `MERIDIAN_PAYLOAD` the bookmarklet href originally built. Just before calling `new Function(...)`, add: `MERIDIAN_PAYLOAD.mode = detectMode();`
  - Verify the trigger file is now significantly shorter than before (rough target: under 130 lines vs. 205 today).
  - Test: `node -c public/meridian-trigger.js` exits 0.
  - Test: `grep -c "function detectMode" public/meridian-trigger.js` returns `1`.
  - Test: `grep -c "MERIDIAN_MASS_RECLASS" public/meridian-trigger.js` returns `0` (all references removed).
  - Test: `grep -c "SUPABASE_INSERT_TRIGGER" public/meridian-trigger.js` returns `0` (trigger no longer writes pending_triggers rows from this flow).
  - Test: `grep -c "handleListViewContext\|collectSelectedCases" public/meridian-trigger.js` returns `0` (logic moved to widget).

### Phase 4: Widget — add mode + mass-mode rendering

- [ ] **Task 4: Add mode to ct-widget.js state**
  - View `public/ct-widget.js` lines 45-65 to see the state object.
  - Add a new field to the state object literal: `mode: MERIDIAN_PAYLOAD.mode || 'single',`
  - Also add these new fields (for mass-mode state machine):
    ```js
    massSubState: 'idle',   // 'idle' | 'confirm' | 'success' | 'error'
    massCases:    [],        // collected at Start click, array of {case_number, sf_case_id}
    massBatchId:  null,      // returned by bulk_reclassify_cases on success
    massError:    null,      // error message string on error
    massCountdown: 10,       // seconds remaining in undo window
    massCountdownTimer: null // interval id for countdown
    ```
  - Also refresh the MERIDIAN_PAYLOAD comment at the top of the file (line 4) to include `mode` in the destructure comment.
  - Test: `node -c public/ct-widget.js` exits 0.
  - Test: `grep -c "state.mode\|mode:.*MERIDIAN_PAYLOAD.mode" public/ct-widget.js` returns `>= 2`.

- [ ] **Task 5: Add handleStartMass function + deep-walk collector**
  - In `public/ct-widget.js`, add a new function `collectSelectedCasesFromDom()` near the existing helpers. Use the same deep-walk pattern established in Task 3 of the previous Mass Reclass PRD — the specific version that correctly pierces `<lightning-primitive-custom-cell>` shadow roots:
    ```js
    function walkShadowLocal(root, visitor) {
      var stack = [root];
      while (stack.length) {
        var node = stack.pop();
        visitor(node);
        if (node.shadowRoot) stack.push(node.shadowRoot);
        var children = node.childNodes || [];
        for (var ci = children.length - 1; ci >= 0; ci--) {
          stack.push(children[ci]);
        }
      }
    }

    function collectSelectedCasesFromDom() {
      var cases = [];
      walkShadowLocal(document.documentElement, function (node) {
        if (!node.getAttribute) return;
        var kv = node.getAttribute('data-row-key-value');
        if (!kv || kv.indexOf('500') !== 0) return;
        var checkbox = node.querySelector && node.querySelector('input[type="checkbox"]');
        if (!checkbox || !checkbox.checked) return;

        // Deep-walk the Case Number <th> to pierce the custom-cell shadow root.
        var caseNumber = null;
        var caseCell = node.querySelector('th[data-label="Case Number"]');
        if (caseCell) {
          walkShadowLocal(caseCell, function (inner) {
            if (caseNumber) return;
            if (!inner.getAttribute) return;
            var t = inner.getAttribute('title');
            if (t && /^\d{8,}$/.test(t)) caseNumber = t;
          });
        }

        if (caseNumber) cases.push({ case_number: caseNumber, sf_case_id: kv });
      });
      return cases;
    }
    ```
  - Add a new function `handleStartMass()`:
    ```js
    function handleStartMass() {
      var cases = collectSelectedCasesFromDom();
      if (!cases.length) {
        showWidgetToast('No cases selected. Check rows in the list, then Start.');
        return;
      }
      state.massCases = cases;
      state.massSubState = 'confirm';
      render();
    }
    ```
  - Add `handleConfirmMass()`, which calls the RPC via the relay:
    ```js
    function handleConfirmMass() {
      state.massSubState = 'submitting';
      render();
      relayRpc('bulk_reclassify_cases', {
        p_user_id: state.userId,
        p_case_refs: state.massCases
      }).then(function (rows) {
        var batchId = (rows && rows[0] && rows[0].batch_id) || null;
        if (!batchId) throw new Error('RPC returned no batch_id');
        state.massBatchId = batchId;
        state.massSubState = 'success';
        state.massCountdown = 10;
        render();
        // Start countdown
        state.massCountdownTimer = setInterval(function () {
          state.massCountdown -= 1;
          if (state.massCountdown <= 0) {
            clearInterval(state.massCountdownTimer);
            state.massCountdownTimer = null;
            handleDismissMass();
          } else {
            render();
          }
        }, 1000);
      }).catch(function (err) {
        state.massSubState = 'error';
        state.massError = err.message || 'Unknown error';
        render();
      });
    }
    ```
  - Add `handleUndoMass()`:
    ```js
    function handleUndoMass() {
      if (!state.massBatchId) return;
      if (state.massCountdownTimer) {
        clearInterval(state.massCountdownTimer);
        state.massCountdownTimer = null;
      }
      relayRpc('undo_mass_reclass_batch', {
        p_user_id: state.userId,
        p_batch_id: state.massBatchId
      }).then(function () {
        handleDismissMass();
      }).catch(function (err) {
        state.massError = 'Undo failed: ' + (err.message || 'Unknown error');
        state.massSubState = 'error';
        render();
      });
    }
    ```
  - Add `handleDismissMass()` — resets mass state back to idle:
    ```js
    function handleDismissMass() {
      state.massCases = [];
      state.massBatchId = null;
      state.massError = null;
      state.massSubState = 'idle';
      state.massCountdown = 10;
      if (state.massCountdownTimer) {
        clearInterval(state.massCountdownTimer);
        state.massCountdownTimer = null;
      }
      render();
    }
    ```
  - Add `handleCancelConfirm()` — from confirm sub-state back to idle without firing:
    ```js
    function handleCancelConfirm() {
      state.massCases = [];
      state.massSubState = 'idle';
      render();
    }
    ```
  - Test: `node -c public/ct-widget.js` exits 0.
  - Test: `grep -c "function handleStartMass\|function handleConfirmMass\|function handleUndoMass\|function handleDismissMass\|function handleCancelConfirm\|function collectSelectedCasesFromDom" public/ct-widget.js` returns `>= 6`.

- [ ] **Task 6: Add relayRpc helper to ct-widget.js**
  - Study the existing `relayPost` and `relayGet` patterns in `public/ct-widget.js` (search for `function relayPost`, `function relayGet`). Match that pattern exactly for `relayRpc`.
  - Add a new helper:
    ```js
    function relayRpc(fnName, args) {
      return new Promise(function (resolve, reject) {
        if (!state.relay) { reject(new Error('No relay available')); return; }
        var id = 'rpc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        function onResponse(e) {
          if (!e.data || e.data.relay !== 'MERIDIAN_TRIGGER_RESPONSE') return;
          if (e.data.id !== id) return;
          window.removeEventListener('message', onResponse);
          if (e.data.success) resolve(e.data.data);
          else reject(new Error(e.data.error || 'Unknown relay error'));
        }
        window.addEventListener('message', onResponse);
        state.relay.postMessage({
          relay: 'MERIDIAN_TRIGGER',
          id: id,
          action: 'SUPABASE_RPC',
          payload: { function: fnName, args: args }
        }, '*');
        setTimeout(function () {
          window.removeEventListener('message', onResponse);
          reject(new Error('Relay RPC timeout'));
        }, 15000);
      });
    }
    ```
  - Test: `grep -c "function relayRpc" public/ct-widget.js` returns `1`.
  - Test: `node -c public/ct-widget.js` exits 0.

- [ ] **Task 7: Upgrade handleStartCase to scrape type/subtype/sf_case_id/account_id**
  - View the existing `handleStartCase` (around line 374 today). It only scrapes `document.title` for the case number. Replace its body with a version that does a shadow-DOM walk for the other fields.
  - Target implementation (replaces the function body, keeps the name/signature):
    ```js
    function handleStartCase() {
      var m = document.title.match(/(\d{8,})/);
      if (!m) {
        showWidgetToast('No case detected on this page');
        return;
      }
      var typeVal = '', subtypeVal = '', accountId = '', sfCaseId = '';
      function scrape(n, d) {
        if (d > 50) return;
        if (!typeVal && n.classList && n.classList.contains('slds-p-around_small')) {
          var tt = (n.textContent || '').trim();
          if (tt.indexOf('Type / Sub-Type') === 0) {
            var v = tt.replace('Type / Sub-Type', '').trim();
            var p = v.split(' / ');
            typeVal = p[0] || '';
            subtypeVal = p[1] || '';
          }
        }
        if (n.tagName === 'A') {
          var href = n.getAttribute && n.getAttribute('href');
          if (href) {
            if (!accountId && href.indexOf('/lightning/r/Account/001') === 0) {
              var ai = href.match(/001[a-zA-Z0-9]{12,15}/);
              if (ai && ai[0]) accountId = ai[0];
            }
            if (!sfCaseId && href.indexOf('/lightning/r/Case/500') === 0) {
              var ci = href.match(/500[a-zA-Z0-9]{12,15}/);
              if (ci && ci[0]) sfCaseId = ci[0];
            }
          }
        }
        if (n.shadowRoot) {
          var sroots = n.shadowRoot.children || [];
          for (var i = 0; i < sroots.length; i++) scrape(sroots[i], d + 1);
        }
        var kids = n.children || [];
        for (var j = 0; j < kids.length; j++) scrape(kids[j], d + 1);
      }
      try { scrape(document.body, 0); } catch (e) { /* non-fatal */ }

      state.caseNumber  = m[1];
      state.caseType    = typeVal || '';
      state.caseSubtype = subtypeVal || '';
      state.accountId   = accountId || '';
      state.sfCaseId    = sfCaseId || '';
      state.sessionId   = newSessionId();
      state.elapsed     = 0;
      state.isAwaiting  = false;
      startTimer();
      render();
    }
    ```
  - Test: `grep -c "function handleStartCase" public/ct-widget.js` returns `1`.
  - Test: `grep -c "Type / Sub-Type" public/ct-widget.js` returns `>= 1`.
  - Test: `node -c public/ct-widget.js` exits 0.

- [ ] **Task 8: Split render() into renderSingle() and renderMass(), add dispatcher**
  - The existing `render()` function (around line 402) is ~120 lines of innerHTML assembly for the single-case widget. Rename it to `renderSingle()`.
  - Add a new `renderMass()` that produces the mass-mode UI across its sub-states:
    - **idle sub-state:** compact bar, same footprint as single mode. Contents: `[M° logo] 3 cases selected  [Start]  [×]`. The Start button has `data-action="start-mass"`. The × has `data-action="close"` (reuses existing close handler).
    - **confirm sub-state:** expanded panel. Contents: `[M° logo] Reclassify 3 cases?` (top row, compact), followed by a scrollable list (max-height 180px) of case numbers, followed by a row with `[Cancel] [Confirm Reclassify]` buttons. Cancel has `data-action="cancel-mass"` (fires `handleCancelConfirm`). Confirm has `data-action="confirm-mass"` (fires `handleConfirmMass`).
    - **submitting sub-state:** compact: `[M° logo] Working…` with a simple text placeholder (no spinner animation — keep it simple, no CSS keyframes needed). No buttons.
    - **success sub-state:** compact: `[M° logo] Reclassified 3 cases. [Undo (10s)]  [Dismiss]`. Countdown is read from `state.massCountdown` and rendered as `(10s)`, `(9s)`, etc. Undo has `data-action="undo-mass"`. Dismiss has `data-action="dismiss-mass"` (fires `handleDismissMass`).
    - **error sub-state:** compact: `[M° logo] Error: <message>. [Retry]  [Close]`. Retry fires `handleConfirmMass` again. Close fires `handleDismissMass`.
  - Use inline styles in the same style as `renderSingle()` — same colors, same height (`28px` buttons, `#22c55e` for confirm button green, `#ef4444` for cancel red if needed, white text, dark bg). The mass mode should FEEL like the single mode, just with different buttons.
  - Add a new top-level `render()` that dispatches:
    ```js
    function render() {
      if (state.mode === 'mass') renderMass();
      else renderSingle();
    }
    ```
  - Add event-delegation entries in the existing shadow-DOM click handler at line ~567 for the new `data-action` values: `start-mass`, `cancel-mass`, `confirm-mass`, `undo-mass`, `dismiss-mass`. Each routes to the corresponding handler.
  - Test: `grep -c "function renderSingle\|function renderMass\|function render\b" public/ct-widget.js` returns `>= 3`.
  - Test: `grep -c "data-action=\"start-mass\"\|data-action=\"confirm-mass\"\|data-action=\"undo-mass\"" public/ct-widget.js` returns `>= 3`.
  - Test: `node -c public/ct-widget.js` exits 0.
  - Test: `npx vite build 2>&1 | tail -10` — no errors.
  - **Optional visual verification** (manual, Ralph cannot run a browser): the final artifact of this task is that the widget file still opens and renders single-mode correctly. Ralph should skip any visual check and trust the grep assertions.

### Phase 5: Delete dead mass-reclass code

- [ ] **Task 9: Delete useMassReclass hook and MassReclassModal component**
  - Delete `src/hooks/useMassReclass.js`.
  - Delete `src/components/MassReclassModal.jsx`.
  - Test: `ls src/hooks/useMassReclass.js 2>&1 | grep -c "No such"` returns `1`.
  - Test: `ls src/components/MassReclassModal.jsx 2>&1 | grep -c "No such"` returns `1`.

- [ ] **Task 10: Remove MERIDIAN_MASS_RECLASS routing from usePendingTriggers.js**
  - View `src/hooks/usePendingTriggers.js`. Remove the entire `else if (trigger.type === 'MERIDIAN_MASS_RECLASS')` branch and its body. Keep the existing `handleCaseStart` and `handleProcessStart` branches intact.
  - Remove the `shouldDelete` flag pattern introduced by that branch IF it's no longer needed (i.e., if all remaining branches use the default immediate delete). If the flag is still structurally useful for something else, leave it — it's harmless.
  - Remove `onMassReclass` from the JSDoc handlers type declaration.
  - Test: `grep -c "MERIDIAN_MASS_RECLASS\|onMassReclass" src/hooks/usePendingTriggers.js` returns `0`.
  - Test: `npx vite build 2>&1 | tail -10` — no errors.

- [ ] **Task 11: Remove mass-reclass wiring from MplApp.jsx**
  - View `src/mpl/MplApp.jsx`. Remove:
    - The `import useMassReclass from '../hooks/useMassReclass'` line.
    - The `import MassReclassModal from '../components/MassReclassModal'` line.
    - The `const massReclass = useMassReclass()` call.
    - The `onMassReclass: ...` key in the `usePendingTriggers` options object.
    - The `<MassReclassModal .../>` element in the render tree.
  - Leave everything else in `MplApp.jsx` completely untouched.
  - Test: `grep -c "useMassReclass\|MassReclassModal" src/mpl/MplApp.jsx` returns `0`.
  - Test: `npx vite build 2>&1 | tail -10` — no errors.

### Phase 6: Verification

- [ ] **Task 12: Regression check — protected files**
  - Run `git diff --stat main...HEAD` and verify the modified/created/deleted file list matches the PRD's File Structure section exactly.
  - Files expected in the diff:
    - MODIFIED: `public/ct-widget.js`, `public/meridian-trigger.js`, `public/meridian-relay.html`, `src/hooks/usePendingTriggers.js`, `src/mpl/MplApp.jsx`
    - CREATED: `supabase/migrations/022_unified_start_rpc_user_id.sql`
    - DELETED: `src/hooks/useMassReclass.js`, `src/components/MassReclassModal.jsx`
  - NOT expected in the diff:
    - `src/ct/CtApp.jsx` (protected)
    - `supabase/migrations/020_mass_reclass.sql`, `021_expand_pending_triggers_types.sql` (existing migrations, never touched)
    - `src/lib/api.js` (unrelated)
    - `src/components/onboarding/Step3Bookmarklet.jsx` (bookmarklet href unchanged)
  - If any unexpected file appears, investigate and revert before committing.
  - Test: Save the full `git diff --stat main...HEAD` output to `scripts/unified-start-button-scope-check.txt` for Davis's review.

- [ ] **Task 13: Final build check**
  - Run `npx vite build 2>&1 | tail -20`. Must complete without errors.
  - Run `node -c public/meridian-trigger.js`. Exit 0.
  - Run `node -c public/ct-widget.js`. Exit 0.
  - Confirm `public/meridian-relay.html` is well-formed HTML (no truncation, closing `</script>` and `</body>` and `</html>` tags intact).

- [ ] **Task 14: Commit summary**
  - Run `git log --oneline main..HEAD`. Log the commit list to `progress.txt` under a heading "Unified Start Button — final commits".
  - Append a "Davis: manual steps to ship" section to `progress.txt`:
    1. Review the branch diff.
    2. Apply `supabase/migrations/022_unified_start_rpc_user_id.sql` via Supabase SQL Editor. The verification `SELECT` at the bottom of the migration should return two rows (one for each RPC) with `pronargs = 2` each.
    3. Push `feat/unified-start-button`, open PR against main.
    4. Merge. Vercel auto-deploys.
    5. Hard-refresh both the Salesforce tab and any Meridian tab.
    6. Test single-case flow: open an SF case record page, click bookmarklet. Widget injects in single mode. Click Start Case. Verify `ct_cases` row has `case_type`, `case_subtype`, `sf_case_id`, `account_id` populated.
    7. Test mass flow: open an SF case list view, check 3 rows. Click bookmarklet. Widget injects in mass mode showing "3 cases selected — Start". Click Start. Confirmation panel expands. Click "Confirm Reclassify". See success state with "Reclassified 3 cases. Undo (10s)". Verify 3 `ct_cases` rows with `source='bulk'` and matching `batch_id`.
    8. Test undo: do the mass flow again, click Undo within the countdown. Verify the `ct_cases` rows are gone.

---

## Testing Strategy

- **Primary build check:** `npx vite build 2>&1 | tail -10` after every `src/` or `public/` change.
- **Vanilla JS syntax:** `node -c public/ct-widget.js`, `node -c public/meridian-trigger.js`. These files are NOT transformed by Vite — syntax errors will only surface at runtime without this check.
- **No test suite exists.** Do not invent tests. Rely on grep assertions and build + node -c.
- **Migrations are not auto-applied.** Ralph verifies file existence and content; Davis applies manually.
- **Browser testing is out of scope for Ralph.** Visual verification happens during Davis's manual test pass after merge.

---

## Out of Scope

**Do NOT do any of the following, even if they seem related or better:**

- Autolaunching the PiP window from the bookmarklet. Out of scope per Davis's direction — that's a separate product conversation about non-SF MPL capture.
- Modifying `src/ct/CtApp.jsx` or any dashboard route. The dashboard has nothing to do with this flow.
- Modifying `src/components/onboarding/Step3Bookmarklet.jsx` or the bookmarklet HREF. The bookmarklet is unchanged — it still loads `meridian-trigger.js` via the relay. The trigger has gained mode detection; the href is unchanged.
- Adding new tables, columns, or constraints beyond what's in migration 022.
- Rolling back or modifying migrations 020 or 021. They stay in place — 020's `source='bulk'` and `batch_id` columns are reused; 021's constraint expansion is harmless dead weight.
- Adding spinner animations, keyframes, or any CSS beyond inline styles matching the existing widget.
- Implementing swim-lanes or mass-mode visual variants beyond the four sub-states specified (idle / confirm / submitting / success / error).
- Improving or refactoring `renderSingle()` — this is a move/rename only.
- Implementing concurrent-case tracking, pause-resume, or any other feature from Davis's roadmap.
- "While we're in here" cleanups of unrelated code.

---

## Notes for Ralph

- **Ground truth of the widget file is ~646 lines with a clear structure.** State at top (~45), host+shadow setup (~66), helpers (~100), action handlers (~255), handleStartCase (~374), handleDismissCase (~388), render (~402), click delegation (~567). Use these line numbers as rough orientation, but always re-view before editing — they will shift as you add code.
- **The click handler uses event delegation on the shadow root** (around line 567). All new `data-action` values must be wired there. Look at how existing values like `resolve`, `reclass`, `call`, `start`, `dismiss`, `close`, `minimize` are routed — add new entries in the same switch/if-else pattern.
- **The widget lives in shadow DOM.** All new DOM must be emitted as innerHTML strings inside `renderMass()`. Do not use `createElement`. Do not attach external event listeners. Let the existing click-delegation pattern handle routing.
- **The `showWidgetToast` helper exists** (search for it in the file). Use it for user-facing messages like "No cases selected." Do NOT create a second toast system.
- **State is a plain object, mutated directly.** No reactivity, no setState. After mutating state, call `render()` to repaint.
- **Carousel of truth for "how to scrape SF":** the version inside `handleStartCase` after Task 7, and `collectSelectedCasesFromDom` from Task 5, are the two scrapers. They are deliberately independent — `handleStartCase` walks the whole body for four fields, `collectSelectedCasesFromDom` walks specifically to find checked rows + their case numbers. Do not try to unify them into one.
- **Commit style:** one commit per task. Message format: `unified-start: [task N] <short description>`.
- **If a task's grep check fails**, the task is not done. Revisit the code. Do NOT loosen the grep assertion.
- **If `npx vite build` fails**, revert the task's changes and retry. Do NOT commit a broken build.
- **When in doubt about UI details in renderMass()**, keep it minimal and functional over polished. Davis can hand-tune visuals after the plumbing works.

---

## Order of Operations

1. Task 0 — branch setup. Must be first.
2. Task 1 — migration file. No dependencies; can run anytime before Task 14.
3. Task 2 — relay SUPABASE_RPC action. Required before Task 6 can be tested end-to-end but build-wise independent.
4. Task 3 — trigger simplification and mode detection. Depends on nothing.
5. Task 4 — state fields. Must come before Tasks 5, 6, 7, 8 (they reference the new state fields).
6. Task 5 — mass handlers. Depends on Task 4.
7. Task 6 — relayRpc helper. Depends on Task 4 (`state.relay` access).
8. Task 7 — handleStartCase scrape upgrade. Independent but conceptually part of the widget refactor.
9. Task 8 — render split. Depends on Tasks 4, 5, 6 (handlers + state must exist for the render to dispatch to them).
10. Tasks 9, 10, 11 — dead-code removal. Independent; can interleave with the widget tasks.
11. Task 12 — regression check. Must run after all file changes are committed.
12. Task 13 — final build. Must run last before Task 14.
13. Task 14 — summary. Final.
