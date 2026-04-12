# CT Overlay Widget PRD

## Project Overview

Replace the CT popup window widget (`?mode=ct-widget`) with an **injected vanilla JS overlay** that lives directly inside Salesforce pages — modeled after Case Tracker 1.0's floating widget. The bookmarklet injects a self-contained widget (no React, no build step) that floats over the SF page, scrapes case data from the DOM, runs a timer, and writes to Supabase via the existing relay iframe.

**Stack:** Vanilla JS (no React), Supabase REST via relay iframe, injected into host page DOM  
**Repo:** Meridian (same repo)  
**Success:** Agent clicks CT bookmarklet on SF case page → floating CT widget appears on the page with case number, timer, resolve/reclass/call buttons, and stat counts. Widget writes to `ct_activity_log` via relay. Vite build still passes (widget is a static `.js` file in `public/`).

## Architecture & Key Decisions

- **Vanilla JS only.** The widget is a single IIFE in `public/ct-widget.js`. No React, no JSX, no build step. It's loaded by the relay and executed on the SF page via `new Function()`.
- **Relay iframe is the Supabase proxy.** SF CSP blocks direct `fetch()` to Supabase. The widget sends `postMessage` to the relay iframe, which proxies all Supabase REST calls. The relay (`public/meridian-relay.html`) already supports `SUPABASE_INSERT_TRIGGER` — we add new action types for reads and generic inserts.
- **Shadow DOM isolation.** The widget mounts inside a shadow root to prevent SF's CSS from bleeding in. All styles are inline within the shadow DOM.
- **No pending_triggers.** The old CT bookmarklet inserted a `pending_triggers` row and a separate popup window reacted. The new widget IS the CT surface — it reads the case number from the DOM directly and renders the UI inline. No separate window, no Realtime subscription needed for case starts.
- **Write to ct_activity_log directly.** When the agent resolves/reclassifies/calls, the widget writes to `ct_activity_log` via the relay (not `ct_cases`). Same table the dashboard reads.
- **Stats from ct_activity_log.** On load, the widget queries today's activity counts via the relay.
- **Single active case.** One case at a time in the overlay. Agent navigates to a new case page → clicks bookmarklet → widget refreshes with new case number.
- **Timer is client-side.** `setInterval` in the widget IIFE. Elapsed seconds stored in widget state, sent as `time_spent_seconds` on log.
- **Do NOT touch src/ files.** The CtApp.jsx, CtPipBar.jsx, and all React code from the previous PRD remain untouched. The overlay widget is an independent vanilla JS file.
- **Do NOT touch MplApp or MPL widget.** MPL stays as a popup window — only CT gets the overlay treatment.

## File Structure

```
public/
├── ct-widget.js                ← NEW: vanilla JS widget (loaded by relay, injected into SF page)
├── meridian-relay.html         ← MODIFY: add SUPABASE_GET and SUPABASE_POST actions for widget
├── meridian-trigger.js         ← MODIFY: on SF case pages, load ct-widget.js instead of inserting pending_trigger
src/
├── components/
│   └── onboarding/
│       └── Step3Bookmarklet.jsx ← MODIFY: CT bookmarklet no longer opens popup, just injects relay
```

## Environment & Setup

- Same Supabase project: `https://wluynppocsoqjdbmwass.supabase.co`
- Same anon key (baked into relay and widget)
- Relay at `https://meridian-hlag.vercel.app/meridian-relay.html`
- Widget JS at `https://meridian-hlag.vercel.app/ct-widget.js`
- No env vars needed — keys are hardcoded in the files (same pattern as existing)
- `ct_activity_log` table columns: `id`, `user_id`, `type`, `case_number`, `case_type`, `case_subtype`, `notes`, `is_rfc`, `time_spent_seconds`, `timer_was_used`, `entry_date`, `source`, `created_at`
- `type` values: `'Resolved'`, `'Reclassified'`, `'incoming_call'`, `'Awaiting_Info'`
- `entry_date` format: `'YYYY-MM-DD'` in America/New_York timezone
- `source` value for widget entries: `'widget'`

## Tasks

### Phase 1: Relay Upgrades

- [x] **Task 1: Add SUPABASE_GET and SUPABASE_POST actions to relay**
  - What: Modify `public/meridian-relay.html` to handle two new action types alongside the existing `SUPABASE_INSERT_TRIGGER`
  - **SUPABASE_POST action:**
    ```js
    // Message format:
    { relay: 'MERIDIAN_TRIGGER', id: '...', action: 'SUPABASE_POST', payload: { table: 'ct_activity_log', body: {...} } }
    ```
    - Relay does: `POST /rest/v1/{table}` with anon key, `Prefer: return=minimal`, JSON body
    - Returns: `{ relay: 'MERIDIAN_TRIGGER_RESPONSE', id, success: true }` or `{ ..., success: false, error }`
  - **SUPABASE_GET action:**
    ```js
    // Message format:
    { relay: 'MERIDIAN_TRIGGER', id: '...', action: 'SUPABASE_GET', payload: { table: 'ct_activity_log', query: 'user_id=eq.xxx&entry_date=eq.2026-04-12&select=type' } }
    ```
    - Relay does: `GET /rest/v1/{table}?{query}` with anon key
    - **Important:** GET requests need the `Authorization: Bearer {user_access_token}` header, NOT the anon key for auth. BUT we don't have the user's session token in the relay context. So we use the anon key for auth AND the GET must work with anon-level RLS. This means `ct_activity_log` needs a SELECT policy for anon that filters by user_id. **WAIT — we can't change RLS (out of scope).** Alternative: the widget passes the user's access_token (from a Supabase auth session stored in the widget's state or localStorage) via the payload. The relay uses that token for the GET.
    - Actually, simpler approach: **The widget tracks stats client-side.** Every time the widget logs an action, it increments a local counter. Stats don't need a GET query at all — just count what was logged during this session. For historical stats (today's total), the widget can query on initial load.
    - For the initial stats fetch: the payload includes `token` field. Relay uses it as the Authorization Bearer. If no token provided, relay uses anon key.
    - Relay code for GET:
      ```js
      if (action === 'SUPABASE_GET') {
        const token = payload.token || SUPABASE_ANON_KEY;
        const resp = await fetch(SUPABASE_URL + '/rest/v1/' + payload.table + '?' + payload.query, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + token,
          }
        });
        if (!resp.ok) throw new Error(resp.status + ': ' + await resp.text());
        result = await resp.json();
      }
      ```
  - Keep the existing `SUPABASE_INSERT_TRIGGER` handler unchanged
  - Files: `public/meridian-relay.html`
  - Test: `npx vite build 2>&1 | tail -8` — no errors (relay is static HTML, build just copies it)

### Phase 2: CT Widget (Vanilla JS)

- [ ] **Task 2: Create ct-widget.js — Core structure and UI rendering**
  - What: Create `public/ct-widget.js` — a vanilla JS IIFE that renders a floating CT widget inside a shadow DOM
  - **Double-injection guard:** Check `document.getElementById('meridian-ct-widget')`. If exists, toggle visibility and refresh case data. Return early.
  - **Shadow DOM setup:**
    ```js
    var host = document.createElement('div');
    host.id = 'meridian-ct-widget';
    host.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;';
    document.body.appendChild(host);
    var shadow = host.attachShadow({ mode: 'closed' });
    ```
  - **Widget state object:**
    ```js
    var state = {
      userId: MERIDIAN_PAYLOAD.userId,
      relay: MERIDIAN_PAYLOAD.relayFrame,
      caseNumber: '',
      caseType: '',
      caseSubtype: '',
      accountId: '',
      elapsed: 0,
      timerRunning: false,
      timerId: null,
      isMinimized: false,
      stats: { resolved: 0, reclass: 0, calls: 0 },
      toastMsg: null,
      toastTimer: null,
    };
    ```
  - **MERIDIAN_PAYLOAD** is injected by the trigger code (same pattern as existing `meridian-trigger.js`). It contains `{ userId, relayFrame }`.
  - **Render function** `render()`: Rebuilds the widget HTML from state and sets `shadow.innerHTML`. Called after every state change.
  - **Widget layout** (all inline styles, dark theme matching Meridian design tokens):
    - **Header bar** (48px): Meridian M logo (just a styled div with "M"), case number display (monospace, orange), timer display (mm:ss, white), minimize button (—), close button (×)
    - **Action buttons row** (hidden when minimized): Resolved (green), Reclassified (red), Call (teal), Awaiting (amber)
    - **Stats row** (always visible): "R: 3 | RC: 1 | C: 2" — compact stat line
    - **Minimized state**: Just the header bar with case number + timer, no action buttons
  - **Design tokens** (hardcoded, matching Meridian):
    ```js
    var T = {
      bg: '#1a1a2e',
      bgDeep: '#0f0f1e',
      blue: '#003087',
      orange: '#E8540A',
      resolved: '#22c55e',
      reclass: '#ef4444',
      calls: '#0d9488',
      awaiting: '#f59e0b',
      textPri: 'rgba(255,255,255,0.92)',
      textSec: 'rgba(255,255,255,0.55)',
      textDim: 'rgba(255,255,255,0.3)',
      border: 'rgba(255,255,255,0.12)',
      divider: 'rgba(255,255,255,0.08)',
      font: '"Segoe UI", system-ui, -apple-system, sans-serif',
    };
    ```
  - **Widget dimensions:** ~320px wide, auto height. Minimized: ~320×48. Expanded: ~320×140.
  - **Draggable:** The header bar is draggable. On mousedown on header, track mousemove, update `host.style.left/top`. Save position to localStorage key `meridian-ct-pos`.
  - **Toast:** Small toast div at bottom of widget for success/error messages, auto-dismisses after 2s.
  - This task creates the file with render() and UI only — no Supabase calls yet. Timer, logging, and stats are wired in subsequent tasks.
  - Files: Create `public/ct-widget.js`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [ ] **Task 3: Wire timer functionality**
  - What: Add timer start/stop/display to `public/ct-widget.js`
  - **Auto-start on injection:** When the widget loads and `state.caseNumber` is found (scraped from page title by the trigger code), start the timer immediately: `state.timerRunning = true; state.timerId = setInterval(tick, 1000);`
  - **tick():** Increments `state.elapsed++` and calls `render()` (or just updates the timer display element directly for performance — find the timer span in shadow DOM and update textContent)
  - **Awaiting Info button:** Pauses timer (`clearInterval`, `state.timerRunning = false`). Shows "▶ Resume" button. On resume, restarts interval.
  - **Timer display format:** `mm:ss` — `String(Math.floor(elapsed/60)).padStart(2,'0') + ':' + String(elapsed%60).padStart(2,'0')`
  - **Timer resets** on new case (when bookmarklet re-injects with different case number)
  - Files: Modify `public/ct-widget.js`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [ ] **Task 4: Wire relay communication helpers**
  - What: Add `relayPost(table, body)` and `relayGet(table, query, token)` helper functions to `public/ct-widget.js`
  - These functions send postMessage to `state.relay` (the relay iframe's contentWindow) and return a Promise that resolves with the response.
  - **relayPost(table, body):**
    ```js
    function relayPost(table, body) {
      return new Promise(function(resolve, reject) {
        var msgId = 'ct_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
        function onResponse(e) {
          if (!e.data || e.data.relay !== 'MERIDIAN_TRIGGER_RESPONSE') return;
          if (e.data.id !== msgId) return;
          window.removeEventListener('message', onResponse);
          if (e.data.success) resolve(e.data.data);
          else reject(new Error(e.data.error || 'Unknown error'));
        }
        window.addEventListener('message', onResponse);
        state.relay.postMessage({
          relay: 'MERIDIAN_TRIGGER',
          id: msgId,
          action: 'SUPABASE_POST',
          payload: { table: table, body: body }
        }, '*');
        setTimeout(function() { window.removeEventListener('message', onResponse); reject(new Error('Timeout')); }, 10000);
      });
    }
    ```
  - **relayGet(table, query):** Same pattern but with `action: 'SUPABASE_GET'`
  - Files: Modify `public/ct-widget.js`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [ ] **Task 5: Wire action buttons — Resolved, Reclassified, Call**
  - What: Add click handlers for the three main action buttons in `public/ct-widget.js`
  - **handleResolved():**
    - Stop timer
    - Call `relayPost('ct_activity_log', { user_id: state.userId, type: 'Resolved', case_number: state.caseNumber, case_type: state.caseType, case_subtype: state.caseSubtype, time_spent_seconds: state.elapsed, timer_was_used: true, entry_date: getTodayNY(), source: 'widget' })`
    - On success: `state.stats.resolved++`, show toast "✓ Resolved — Case {num}", reset timer to 0, `render()`
    - On error: show toast with error message
  - **handleReclass():** Same as resolved but `type: 'Reclassified'`, increments `state.stats.reclass`, toast "↩ Reclassified — Case {num}"
  - **handleCall():**
    - Does NOT stop the timer (calls happen while working a case)
    - Call `relayPost('ct_activity_log', { user_id: state.userId, type: 'incoming_call', case_number: state.caseNumber || null, time_spent_seconds: null, timer_was_used: false, entry_date: getTodayNY(), source: 'widget' })`
    - On success: `state.stats.calls++`, show toast "📞 Call logged", `render()`
  - **getTodayNY()** helper: Returns today's date in `YYYY-MM-DD` format, America/New_York timezone:
    ```js
    function getTodayNY() {
      return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    }
    ```
  - **Event binding:** After each `render()`, query shadow DOM for buttons by id and bind click handlers. OR use event delegation on the shadow root.
  - **Important:** Use event delegation on the shadow root to avoid re-binding after every render:
    ```js
    shadow.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'resolve') handleResolved();
      if (action === 'reclass') handleReclass();
      // etc.
    });
    ```
    Set this up once after shadow DOM is created, not inside render().
  - Files: Modify `public/ct-widget.js`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [ ] **Task 6: Wire stats display**
  - What: Show today's stats in the widget and update them on each log action
  - **Client-side tracking:** The widget tracks `state.stats = { resolved: 0, reclass: 0, calls: 0 }` and increments on each successful log. This gives accurate counts for the current session.
  - **Stats display in render():** Show a compact stats row below the action buttons:
    ```html
    <div style="...">
      <span style="color:#22c55e;font-weight:700;">{resolved}</span> Res
      <span style="color:rgba(255,255,255,0.15);margin:0 4px;">|</span>
      <span style="color:#ef4444;font-weight:700;">{reclass}</span> Rec
      <span style="color:rgba(255,255,255,0.15);margin:0 4px;">|</span>
      <span style="color:#0d9488;font-weight:700;">{calls}</span> Call
    </div>
    ```
  - **No initial stats fetch for now.** Stats start at 0 each time the bookmarklet is clicked. This is the same behavior as CT 1.0. A future enhancement could fetch today's existing counts on load, but it requires auth token management which adds complexity. Skip for now.
  - Files: Modify `public/ct-widget.js`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

### Phase 3: Trigger Code & Bookmarklet Updates

- [ ] **Task 7: Update meridian-trigger.js to inject CT widget on SF pages**
  - What: Modify `public/meridian-trigger.js` so that on SF case pages, instead of inserting a `pending_triggers` row, it injects the CT widget directly
  - **Current behavior (SF + case detected):** Inserts `pending_triggers` row with `MERIDIAN_CASE_START` → separate popup reacts
  - **New behavior (SF + case detected):**
    1. Scrape case data from DOM (keep existing scraping logic — `extractAccountId()`, `extractCaseTypeSubtype()`)
    2. Set `MERIDIAN_PAYLOAD.caseNumber`, `MERIDIAN_PAYLOAD.caseType`, `MERIDIAN_PAYLOAD.caseSubtype`, `MERIDIAN_PAYLOAD.accountId`
    3. Fetch `ct-widget.js` from the relay origin: the trigger code is already running via `new Function('MERIDIAN_PAYLOAD', code)` from the relay. So `MERIDIAN_PAYLOAD.relayOrigin` should contain the relay origin URL. Fetch `MERIDIAN_PAYLOAD.relayOrigin + '/ct-widget.js?v=' + Date.now()`
    4. Execute the widget code via `new Function('MERIDIAN_PAYLOAD', widgetCode)(MERIDIAN_PAYLOAD)`
    5. Remove the `pending_triggers` insert for the SF case path entirely
  - **For SF + no case detected:** Show toast "Meridian: No case detected on this page". Do NOT inject widget. Do NOT insert `pending_triggers`.
  - **For non-SF pages:** Leave unchanged — the non-SF path was already updated by the previous PRD to do nothing (CT bookmarklet on non-SF pages just opens the popup). Actually, check the current code — the previous PRD's Task 9 removed the fetch from non-SF branch. The non-SF branch should now just show a toast. If it still does something else, just ensure it shows a toast and returns.
  - **Add relayOrigin to MERIDIAN_PAYLOAD:** The bookmarklet (in Step3Bookmarklet.jsx) passes the relay origin. But we shouldn't modify Step3Bookmarklet.jsx in this task — instead, derive it from the relay iframe's src in the trigger code:
    ```js
    // The relay iframe's origin is the same as where this trigger code was loaded from
    // We can use the relay reference to determine the origin
    var relayOrigin = 'https://meridian-hlag.vercel.app'; // hardcode for now, same as NS_HOST
    ```
  - **Loading ct-widget.js:** The trigger code runs on the SF page. It can't fetch from `meridian-hlag.vercel.app` directly (CSP blocks it). Instead, send a message to the relay asking it to fetch the widget code:
    - Add a new message type to the relay: `FETCH_WIDGET_CODE`
    - OR — simpler — have the relay load ct-widget.js the same way it loads meridian-trigger.js. Modify `meridian-relay.html` to support `?load=ct-widget` which fetches `/ct-widget.js` and sends the code back via postMessage.
    - The trigger code, after detecting a case, sends a message to the relay requesting the widget code, then executes it.
    - Actually, simplest approach: **chain the loading.** The bookmarklet loads the relay, the relay loads meridian-trigger.js and sends it back. meridian-trigger.js runs, detects SF case, then asks the relay to load ct-widget.js and send it back. Two round-trips but it works within CSP.
  - **Implementation:**
    1. In meridian-trigger.js, after detecting SF case, send message to relay: `relay.postMessage({ relay: 'MERIDIAN_TRIGGER', id: msgId, action: 'FETCH_CODE', payload: { file: 'ct-widget.js' } }, '*')`
    2. Wait for response with the code
    3. Execute: `(new Function('MERIDIAN_PAYLOAD', code))(MERIDIAN_PAYLOAD)` — MERIDIAN_PAYLOAD now includes `caseNumber`, `caseType`, etc.
  - Files: Modify `public/meridian-trigger.js`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [ ] **Task 8: Add FETCH_CODE action to relay**
  - What: Modify `public/meridian-relay.html` to handle `FETCH_CODE` action
  - When relay receives `{ action: 'FETCH_CODE', payload: { file: 'ct-widget.js' } }`:
    ```js
    if (action === 'FETCH_CODE') {
      const resp = await fetch('/' + payload.file + '?v=' + Date.now());
      if (!resp.ok) throw new Error('Failed to fetch ' + payload.file + ': ' + resp.status);
      const code = await resp.text();
      // Send code back
      event.source.postMessage({
        relay: 'MERIDIAN_TRIGGER_RESPONSE',
        id: id,
        success: true,
        data: { code: code }
      }, '*');
    }
    ```
  - Files: Modify `public/meridian-relay.html`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

- [ ] **Task 9: Update CT bookmarklet to remove popup window.open**
  - What: Modify `buildCtBmHref(userId)` in `src/components/onboarding/Step3Bookmarklet.jsx`
  - **Remove** the `window.open('...?mode=ct-widget', 'meridian-ct', ...)` call. The CT bookmarklet no longer opens a popup. It only injects the relay iframe (on SF pages) or shows a toast (on non-SF pages).
  - **SF path stays the same:** Insert relay iframe → relay loads meridian-trigger.js → trigger code runs → (now) injects ct-widget.js overlay instead of pending_trigger
  - **Non-SF path:** Just show toast "Meridian: Open a Salesforce case page to use Case Tracker". No popup, no fetch.
  - The bookmarklet becomes simpler — just the relay injection on SF, toast on non-SF.
  - Files: Modify `src/components/onboarding/Step3Bookmarklet.jsx`
  - Test: `npx vite build 2>&1 | tail -8` — no errors

### Phase 4: Cleanup & Verification

- [ ] **Task 10: Final build verification and sanity checks**
  - What: Run full build, verify all files are correct
  - Verify: `npx vite build 2>&1 | tail -8` — clean build
  - Verify: `public/ct-widget.js` exists and is valid JS (no syntax errors): `node -c public/ct-widget.js`
  - Verify: `public/meridian-relay.html` handles all four actions: `SUPABASE_INSERT_TRIGGER`, `SUPABASE_POST`, `SUPABASE_GET`, `FETCH_CODE`
  - Verify: `public/meridian-trigger.js` on SF+case path loads ct-widget.js via relay, does NOT insert pending_triggers
  - Verify: `grep -c 'pending_triggers' public/meridian-trigger.js` — should return 0 or only in comments (no active pending_triggers inserts on the SF case path)
  - Verify: CT bookmarklet in Step3Bookmarklet.jsx does NOT contain `window.open.*ct-widget`
  - Files: Any files with issues
  - Test: All checks above pass

## Testing Strategy

- Primary: `npx vite build 2>&1 | tail -8` — must build with no errors
- JS syntax: `node -c public/ct-widget.js` — must parse without errors
- Relay completeness: `grep -c 'SUPABASE_POST\|SUPABASE_GET\|FETCH_CODE\|SUPABASE_INSERT_TRIGGER' public/meridian-relay.html` — should return 4+ matches
- No popup in CT bookmarklet: `grep -c 'ct-widget.*popup\|mode=ct-widget' src/components/onboarding/Step3Bookmarklet.jsx` — should return 0
- Widget isolation: `grep -c 'attachShadow' public/ct-widget.js` — should return 1

## Out of Scope

- No React changes to CtApp.jsx or CtPipBar.jsx (those remain as fallback/unused)
- No Supabase schema or RLS changes
- No MPL widget changes
- No dashboard changes
- No auth token management (stats start at 0 per session)
- No RFC (Resolved First Contact) flow — can be added later
- No swimlane tray / multiple simultaneous cases — one case at a time
- No notes modal — can be added later
- No PiP mode
- No widget persistence across page navigations (dies on nav, re-injected by bookmarklet)

## Notes for Ralph

### Critical patterns:

1. **MERIDIAN_PAYLOAD is the bridge.** The trigger code (`meridian-trigger.js`) already receives this object via `new Function('MERIDIAN_PAYLOAD', code)(payload)`. The CT widget will receive the same object, extended with case data. Fields: `userId`, `relayFrame`, `caseNumber`, `caseType`, `caseSubtype`, `accountId`.

2. **Relay postMessage pattern.** Every relay call uses: `{ relay: 'MERIDIAN_TRIGGER', id: uniqueId, action: '...', payload: {...} }`. Response comes back as: `{ relay: 'MERIDIAN_TRIGGER_RESPONSE', id: sameId, success: true/false, data/error }`. Match on `id` to correlate request/response.

3. **Shadow DOM for style isolation.** SF's CSS is aggressive. Without shadow DOM, SF styles will break the widget layout. Use `attachShadow({ mode: 'closed' })` — closed mode prevents SF JS from reaching into the widget.

4. **Event delegation on shadow root.** Don't re-bind click handlers after every render(). Set up one delegated listener on the shadow root, use `data-action` attributes on buttons to dispatch.

5. **`Prefer: return=minimal` for all POSTs.** The anon key can INSERT but can't SELECT. `return=representation` would fail.

6. **CT 1.0 widget reference:** The original CT 1.0 widget in `public/bookmarklet-widget.js` on the `case-tracker-app.vercel.app` repo is the design reference. It had: orange header, case number display, timer, resolution dropdown, log button, stats cards, notes modal, toast notifications, draggable header, minimize/close buttons. The new widget should have the same core features but with Meridian's dark theme design language.

7. **Double-injection toggle:** If the bookmarklet is clicked while the widget is already on the page, toggle its visibility. Check `document.getElementById('meridian-ct-widget')`. If found: toggle display, update case number from current page title if different. If not found: inject fresh.

8. **Timer continues across minimize/maximize.** The interval keeps running when minimized — only the display is hidden.

9. **ct-widget.js is loaded via relay, not directly.** The flow is: bookmarklet → relay iframe → relay loads trigger.js → trigger.js asks relay to load ct-widget.js → relay sends code back → trigger.js executes ct-widget.js with payload. Two relay round-trips total.

10. **The relay iframe persists on the page.** After injection, the relay iframe stays in the DOM (hidden) so the widget can use it for Supabase calls throughout its lifetime. Don't remove it on a timer like the current trigger code does.
