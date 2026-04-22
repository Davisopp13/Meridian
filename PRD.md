# Meridian SF Direct Link PRD

## Project Overview

Make every case number in Meridian's UI a **one-click link to the live case in Salesforce**. Today, `case_number` renders as a static monospace label; tomorrow, it reveals a small external-link icon on row hover (matching CT 1.0's documented pattern — *"SF link icon on case # only appears on hover — less visual noise at rest"*) that opens the case in a new tab.

The important constraint: Salesforce routes by **record Id** (a 15- or 18-character alphanumeric starting with `500` for the Case object), not by the 8-digit display `CaseNumber`. So the real work is split into three layers:

1. **Capture** the SF case record Id at log time via the existing bookmarklet relay scrape.
2. **Persist** it through the widget → Supabase data layer on every relevant table.
3. **Render** a deep-link icon in the UI surfaces that show case numbers.

Success = clicking the icon next to `130971881` in Meridian's Activity Log opens `https://hlag.lightning.force.com/lightning/r/Case/500AbC…/view` in a new tab, scoped only to cases logged **after this PRD ships**. Historical entries (no `sf_case_id`) render without the icon — they're not broken, just not linkable until backfill lands as a follow-up.

---

## Architecture & Key Decisions

Do not question or change these. They're established by the audit + prior architecture work.

- **Salesforce identifiers:** Case `Id` is 15 or 18 chars, starts with prefix `500`. Scrape pattern: `/500[a-zA-Z0-9]{12,15}/`. The same shadow-DOM walker the bookmarklet already uses for `001…` account IDs (`Step3Bookmarklet.jsx` line 18) is the model.
- **URL pattern:** `https://hlag.lightning.force.com/lightning/r/Case/{sf_case_id}/view`. Host is the Hapag-Lloyd Lightning instance; do not hardcode anywhere except `src/lib/salesforce.js`.
- **Rendering pattern:** Match CT 1.0 — icon hidden at rest, appears on row hover in a fixed-width slot so layout doesn't shift. Modeled after the existing edit pencil (✎) in `ActivityLog.jsx` line 714.
- **Token consolidation PRD must land first.** This PRD references new CSS tokens (`--focus-ring`, `--motion-fast`) that the token PRD introduces. If for some reason the token PRD hasn't run, this one will fail build. Do not attempt without it.
- **Backfill is out of scope.** Pre-existing `ct_cases` and `case_events` rows have `sf_case_id = NULL` and will simply not render the icon. A separate track will map historical case_numbers → SF IDs via Power Query or direct SF API.
- **No new dependencies.** Use Lucide (`ExternalLink` icon) — already in use in `Dashboard.jsx`.
- **Inline styles stay.** House pattern. Don't refactor.
- **Privacy:** `sf_case_id` is a Salesforce internal identifier, not PII. Fine to store and transmit via RLS-protected rows.

---

## Environment & Setup

Ralph should assume:
- Working directory: the local `Meridian 1.0` checkout.
- The **token consolidation PRD has already run and committed** (`var(--focus-ring)` and `var(--motion-fast)` exist in `src/index.css`).
- Supabase project `wluynppocsoqjdbmwass` is live; Davis runs migrations manually via the Supabase SQL editor.
- Primary build check: `npx vite build`.
- Widget changes (`public/ct-widget.js`) take effect without a Vite rebuild since they ship as static files.

---

## Pre-existing Context

Things the codebase already has that this PRD builds on:

- The bookmarklet (`buildCtBmHref` in `Step3Bookmarklet.jsx`) **already walks the SF shadow DOM** and scrapes the account ID via pattern `/001[a-zA-Z0-9]{12,15}/`. The Case ID scrape is a near-identical addition.
- The widget (`public/ct-widget.js`) **already posts `ct_cases`** with rich metadata (`case_type`, `case_subtype`, `duration_s`, etc.). Adding `sf_case_id` is one line per relevant insert.
- The `ct_calls` table schema **already has a `case_id` column** (line 308 of `ct-widget.js` writes `case_id: null` today). The naming is inconsistent with what we want — Ralph will add `sf_case_id` as a new column on `ct_cases` and `case_events`, and leave `ct_calls.case_id` alone for now (separate concern — it's a FK, not an SF ID).
- `ActivityLog.jsx` has a **hover-only edit pencil at the end of every row** (line 714) that's the exact interaction pattern to mirror for the SF link icon.

---

## Tasks

### Phase 0 — Data layer

- [x] **Task 0.1: Migration — add `sf_case_id` to `ct_cases` and `case_events`**

  Create `supabase/migrations/007_sf_case_id.sql`:

  ```sql
  -- 007_sf_case_id.sql
  -- Adds Salesforce Case record Id column to enable deep-linking from Meridian
  -- into the live SF case. Nullable because pre-existing rows don't have it,
  -- and because non-SF pages (MPL) don't produce case IDs.

  ALTER TABLE public.ct_cases
    ADD COLUMN IF NOT EXISTS sf_case_id TEXT;

  ALTER TABLE public.case_events
    ADD COLUMN IF NOT EXISTS sf_case_id TEXT;

  -- Basic shape check — SF Case IDs start with '500' and are 15 or 18 chars.
  -- Enforced as CHECK rather than a type because we want NULLs to pass freely.
  ALTER TABLE public.ct_cases
    DROP CONSTRAINT IF EXISTS ct_cases_sf_case_id_shape,
    ADD CONSTRAINT ct_cases_sf_case_id_shape
      CHECK (
        sf_case_id IS NULL
        OR sf_case_id ~ '^500[a-zA-Z0-9]{12,15}$'
      );

  ALTER TABLE public.case_events
    DROP CONSTRAINT IF EXISTS case_events_sf_case_id_shape,
    ADD CONSTRAINT case_events_sf_case_id_shape
      CHECK (
        sf_case_id IS NULL
        OR sf_case_id ~ '^500[a-zA-Z0-9]{12,15}$'
      );

  -- Index on case_events for the common lookup:
  -- "give me this agent's recent activity with SF links resolvable"
  CREATE INDEX IF NOT EXISTS idx_case_events_sf_case_id
    ON public.case_events (sf_case_id)
    WHERE sf_case_id IS NOT NULL;

  -- Grants, in case a DROP SCHEMA CASCADE has stripped them historically.
  GRANT SELECT, INSERT, UPDATE ON public.ct_cases TO anon, authenticated, service_role;
  GRANT SELECT, INSERT, UPDATE ON public.case_events TO anon, authenticated, service_role;
  ```

  **Do NOT run this migration from Ralph.** Davis runs it manually in the Supabase SQL editor, then pastes the summary output back. Ralph's job is to write the file and commit it.

  **Acceptance:**
  - File exists: `ls supabase/migrations/007_sf_case_id.sql`
  - `grep -c "ADD COLUMN IF NOT EXISTS sf_case_id" supabase/migrations/007_sf_case_id.sql` returns `2`.
  - `grep -c "ADD CONSTRAINT" supabase/migrations/007_sf_case_id.sql` returns `2`.
  - Commit: `migration: add sf_case_id to ct_cases and case_events`.

---

### Phase 1 — Capture (bookmarklet + widget)

- [x] **Task 1.1: Scrape `sf_case_id` in the bookmarklet**

  Open `src/components/onboarding/Step3Bookmarklet.jsx`. Locate `buildCtBmHref(userId)` (line 17). Inside the IIFE string, the shadow-DOM walker already captures account ID. Add case ID capture alongside it.

  Find this block (inside the bookmarklet string, currently inside the `w()` walker):

  ```js
  if (!aN && n.tagName === 'A') {
    var href = n.getAttribute('href');
    if (href && href.startsWith('/lightning/r/Account/001')) {
      var ai = href.match(/001[a-zA-Z0-9]{12,15}/);
      if (ai && ai[0]) aN = ai[0];
    }
  }
  ```

  Add a sibling block for Case IDs:

  ```js
  if (!cID && n.tagName === 'A') {
    var hrefC = n.getAttribute('href');
    if (hrefC && hrefC.startsWith('/lightning/r/Case/500')) {
      var ci = hrefC.match(/500[a-zA-Z0-9]{12,15}/);
      if (ci && ci[0]) cID = ci[0];
    }
  }
  ```

  Initialize `cID` next to `aN` at the top of the walker (where `var aN='', typeVal='', subtypeVal='';` is declared): change to `var aN='', cID='', typeVal='', subtypeVal='';`.

  **Pass `cID` to the widget.** The existing code passes `MERIDIAN_PAYLOAD` to the widget via relay; extend the payload. Find where the widget is invoked after trigger response — the payload already carries `userId` and `relayFrame`. Inject `sfCaseId: cID` into that payload so the widget sees it on launch.

  The bookmarklet code is a minified IIFE string. Be careful with escaping: single quotes inside the string must stay escaped. If the resulting string breaks the JS template literal, roll the change back and log in `progress.txt` — this task may need CC's hand rather than Ralph's.

  **Acceptance:**
  - `grep -c "500\[a-zA-Z0-9\]" src/components/onboarding/Step3Bookmarklet.jsx` returns at least `1`.
  - `grep -c "sfCaseId\|cID" src/components/onboarding/Step3Bookmarklet.jsx` returns at least `2`.
  - `npx vite build` passes.

- [x] **Task 1.2: Receive and persist `sf_case_id` in the widget**

  Open `public/ct-widget.js`. At line 4 (the MERIDIAN_PAYLOAD doc comment), update to reflect the new field:

  ```js
  // MERIDIAN_PAYLOAD = { userId, relayFrame, caseNumber, caseType, caseSubtype, accountId, sfCaseId }
  ```

  At line 45, where `state` is declared, add `sfCaseId: ''`:

  ```js
  state = {
    userId:       '',
    caseNumber:   '',
    caseType:     '',
    caseSubtype:  '',
    accountId:    '',
    sfCaseId:     '',   // ← new
    // … rest of state …
  }
  ```

  Find the initial payload hydration block (line 484):

  ```js
  if (MERIDIAN_PAYLOAD.caseNumber) {
    state.caseNumber  = MERIDIAN_PAYLOAD.caseNumber;
  ```

  Add a sibling line:

  ```js
  if (MERIDIAN_PAYLOAD.sfCaseId) {
    state.sfCaseId  = MERIDIAN_PAYLOAD.sfCaseId;
  }
  ```

  Also find the re-trigger handler around line 495 (`if (payload && payload.caseNumber)`) and add the same for `sfCaseId`.

  In `handleResolved()` (line 224) and `handleReclass()` (line 264):
  - Change the `relayPost('ct_cases', { … })` call to include `sf_case_id: state.sfCaseId || null,` alongside the existing `case_type`, `case_subtype`, etc.
  - Change the `relayPost('case_events', { … })` call to include `sf_case_id: state.sfCaseId || null,` alongside `type`.

  In `handleCall()` (line 304), add the same `sf_case_id` to the `case_events` insert (not `ct_calls` — `ct_calls.case_id` is a different column, leave it alone).

  In `handleStartCase()` (line 330), after setting `state.caseNumber = m[1]`, note that the SF Case ID is NOT scraped here from `document.title` — it's only available via the bookmarklet's shadow-DOM walker. If `state.sfCaseId` is already set from the original payload, keep it. If not, leave blank and the activity just won't be linkable. This is fine.

  In `handleDismissCase()` and the reset blocks inside `handleResolved`/`handleReclass` (lines 252, 292), reset `state.sfCaseId = ''` alongside the other case fields.

  **Acceptance:**
  - `grep -c "sfCaseId\|sf_case_id" public/ct-widget.js` returns at least `12`.
  - No compilation via Vite is needed (static file), but the file must still be valid JS: `node -c public/ct-widget.js` returns exit 0.
  - Manual smoke test (Davis will do this): open a SF case, click bookmarklet, confirm widget opens. Resolve the case. Query Supabase: `select case_number, sf_case_id from ct_cases order by ended_at desc limit 1;` — should show both values.

---

### Phase 2 — Render

- [ ] **Task 2.1: Add `src/lib/salesforce.js` — single source of SF URL truth**

  Create `src/lib/salesforce.js`:

  ```js
  // Single source of truth for Salesforce deep links.
  // Any time we want to open a case or account in SF, we route through this module.
  // The host is hardcoded here and nowhere else — when SF migrates (sandboxes,
  // org changes, etc.), there's exactly one line to update.

  const SF_HOST = 'https://hlag.lightning.force.com';

  /**
   * Build a deep link to a Salesforce Case record by its 15/18-char Id.
   * Returns null if id is falsy or malformed — callers should treat a null
   * return as "no link available" and skip rendering the link affordance.
   */
  export function caseUrl(sfCaseId) {
    if (!sfCaseId) return null;
    if (!/^500[a-zA-Z0-9]{12,15}$/.test(sfCaseId)) return null;
    return `${SF_HOST}/lightning/r/Case/${sfCaseId}/view`;
  }

  /**
   * Build a deep link to a Salesforce Account record by its 15/18-char Id.
   * Mirrors caseUrl — future-friendly for when we surface account context.
   */
  export function accountUrl(sfAccountId) {
    if (!sfAccountId) return null;
    if (!/^001[a-zA-Z0-9]{12,15}$/.test(sfAccountId)) return null;
    return `${SF_HOST}/lightning/r/Account/${sfAccountId}/view`;
  }
  ```

  **Acceptance:**
  - File exists with two exported functions.
  - `grep -c "^export function" src/lib/salesforce.js` returns `2`.
  - `npx vite build` passes.

- [ ] **Task 2.2: Add `src/components/CaseLink.jsx` — one component, every surface**

  Create `src/components/CaseLink.jsx`:

  ```jsx
  import { ExternalLink } from 'lucide-react';
  import { caseUrl } from '../lib/salesforce.js';

  /**
   * Renders a small external-link icon next to a case number.
   * - If sfCaseId is missing or malformed, renders nothing (graceful).
   * - If showOnHover is true (the default), the icon is invisible at rest
   *   and revealed when the parent row is hovered. Parent must set the
   *   CSS class `case-link-host` OR pass showOnHover={false}.
   * - Clicking opens the case in a new tab; stopPropagation on click so
   *   the parent row's click handler (if any) doesn't also fire.
   */
  export default function CaseLink({ sfCaseId, showOnHover = true, size = 12 }) {
    const href = caseUrl(sfCaseId);
    if (!href) return null;

    const baseStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
      marginLeft: 6,
      borderRadius: 3,
      color: 'var(--text-dim)',
      opacity: showOnHover ? 0 : 1,
      transition: 'opacity var(--motion-fast), color var(--motion-fast), background var(--motion-fast)',
      flexShrink: 0,
      cursor: 'pointer',
      textDecoration: 'none',
    };

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="case-link-icon"
        title="Open in Salesforce"
        aria-label="Open case in Salesforce"
        style={baseStyle}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-mmark)';
          e.currentTarget.style.background = 'var(--hover-surface)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-dim)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <ExternalLink size={size} strokeWidth={2} />
      </a>
    );
  }
  ```

  **Acceptance:**
  - File exists.
  - Default export is a component named `CaseLink`.
  - `grep -n "from 'lucide-react'" src/components/CaseLink.jsx` returns 1.
  - `npx vite build` passes.

- [ ] **Task 2.3: Add the `case-link-host` hover reveal CSS rule**

  Open `src/index.css`. At the bottom, add:

  ```css
  /* Case link icon — appears only when its parent row is hovered.
     Parent must carry `case-link-host` class, or `showOnHover` must be false. */
  .case-link-host .case-link-icon {
    opacity: 0;
  }
  .case-link-host:hover .case-link-icon,
  .case-link-host:focus-within .case-link-icon {
    opacity: 1;
  }
  ```

  **Acceptance:**
  - `grep -c "case-link-host\|case-link-icon" src/index.css` returns at least `4`.
  - `npx vite build` passes.

- [ ] **Task 2.4: Wire `CaseLink` into `ActivityLog.jsx` row**

  Open `src/components/ActivityLog.jsx`.

  First, **extend the data layer** to carry `sf_case_id`:
  - Find where `useActivityData` is consumed and where `case_events` rows are normalized into the `entry` shape. The normalization step (if not already mapping `sf_case_id`) needs to include it so `entry.sf_case_id` is available to the render.
  - The mock entries around lines 28–100 don't need to change (they're for dev render), but add a few of them with a realistic `sf_case_id` like `'500abc123def4567890'` for visual verification.

  Second, **render** the link:
  - Find the case number render block around line 669–681. Replace:

    ```jsx
    <div style={{ width: 96, flexShrink: 0, overflow: 'hidden' }}>
      <span style={{...}}>{entry.case_number || 'Manual'}</span>
    </div>
    ```

  - With:

    ```jsx
    <div style={{ width: 116, flexShrink: 0, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      <span style={{...}}>{entry.case_number || 'Manual'}</span>
      {entry.case_number && <CaseLink sfCaseId={entry.sf_case_id} />}
    </div>
    ```

  - Note: width changes from 96 → 116 to accommodate the 20px icon slot. Adjust neighboring widths only if visual inspection shows misalignment.

  - Add `import CaseLink from './CaseLink.jsx';` at the top.

  - On the **row wrapper `<div>`** (the outermost element of each activity row, currently the element that hosts the `onMouseEnter` that toggles the edit icon's visibility), add `className="case-link-host"` to opt into the hover reveal. If the row already has a className, append it.

  Also update the **edit modal header** render around line 357–361: where `#{entry.case_number}` is displayed, pass the icon too but with `showOnHover={false}` since the modal isn't a row-hover context:

  ```jsx
  {entry.case_number && (
    <>
      <span style={{ color: MC.textMuted, fontSize: 12, fontFamily: 'monospace' }}>
        #{entry.case_number}
      </span>
      <CaseLink sfCaseId={entry.sf_case_id} showOnHover={false} />
    </>
  )}
  ```

  **Acceptance:**
  - `grep -c "CaseLink\|case-link-host" src/components/ActivityLog.jsx` returns at least `3`.
  - `grep -c "sf_case_id" src/components/ActivityLog.jsx` returns at least `2`.
  - `npx vite build` passes.
  - Visual check: hovering a row with `sf_case_id` reveals the icon; rows without one show no icon; layout width does not shift on hover.

- [ ] **Task 2.5: Wire `CaseLink` into the recent-activity preview in `Dashboard.jsx` (if applicable)**

  Check whether `Dashboard.jsx` renders case numbers directly. If it does, apply the same treatment. If it only delegates to `<ActivityLog />`, this task is a no-op — mark complete after confirming.

  ```bash
  grep -n "case_number\|caseNumber" src/components/Dashboard.jsx
  ```

  If the grep returns nothing, mark the task done with a note in `progress.txt`: `Task 2.5 no-op — Dashboard delegates to ActivityLog.`

  **Acceptance:**
  - Either: Dashboard imports `CaseLink` and renders it everywhere a case number appears; or `progress.txt` notes the no-op.
  - `npx vite build` passes.

---

### Phase 3 — Query + verification

- [ ] **Task 3.1: Ensure the activity data hook selects `sf_case_id`**

  Open `src/hooks/useActivityData.js` (or wherever the activity feed's Supabase query lives). Find the `.select(...)` call against `case_events` and `ct_cases`. Confirm `sf_case_id` is in the selection; if using `select('*')` it's automatic; if the fields are enumerated, add it.

  **Acceptance:**
  - `grep -n "sf_case_id\|select(" src/hooks/useActivityData.js` shows `sf_case_id` is either explicitly selected or the query is `select('*')`.
  - `npx vite build` passes.

- [ ] **Task 3.2: Final grep + build sweep**

  ```bash
  # CaseLink is imported from the lib, not reinvented elsewhere
  grep -rn "lightning/r/Case/500\|lightning/r/Case/\${" src/ --include="*.jsx" --include="*.js" | grep -v "src/lib/salesforce.js"
  # ↑ Expect zero matches. The only place that hardcodes the URL is salesforce.js.

  # No leftover hardcoded SF hosts
  grep -rn "hlag.lightning.force.com" src/ --include="*.jsx" --include="*.js" | grep -v "src/lib/salesforce.js"
  # ↑ Expect zero matches.

  # CaseLink used in at least two surfaces
  grep -rn "<CaseLink " src/components/ --include="*.jsx" | wc -l
  # ↑ Expect ≥ 2.

  # Build
  npx vite build
  ```

  If any grep returns unexpected matches, open the file and migrate to use `caseUrl(…)` from the lib. If build fails, debug the last task's change.

  **Acceptance:** all three grep checks produce expected output. Build passes. Commit with message: `feat: SF direct-link icon on case numbers (data + render layers)`.

---

## Out of Scope

These are deliberately excluded so this PRD stays small and reviewable:

- ❌ Backfilling `sf_case_id` on historical `ct_cases` / `case_events` rows. Those render without the icon for now; that's fine. A future track (probably Power Query + Salesforce Objects connector) will map `case_number` → SF record Id and backfill.
- ❌ MPL entries. Processes don't have a Salesforce case by definition. Leave `mpl_entries` alone.
- ❌ Calls surface (`ct_calls.case_id`). It's a different concern and the column is already wired to a different purpose. Do not touch.
- ❌ Changing the widget's **visual** rendering of the case number. The bar still shows the display number; only the downstream Supabase write changes.
- ❌ CT 1.0 row parity — this PRD does not modify `src/ct/` or legacy CT 1.0 code. Only Meridian ActivityLog and downstream.
- ❌ Account deep links. The `accountUrl` helper in `salesforce.js` is infrastructure for a future track, not exercised here.
- ❌ Tests. Meridian doesn't have a unit-test suite; grep + build + manual smoke is the verification standard established by prior PRDs.
- ❌ Copy updates, tooltips beyond the `title="Open in Salesforce"` attribute, keyboard-shortcut surfacing.

---

## Testing Strategy

**Per-task:**
- `grep` acceptance in each task.
- `npx vite build` passes cleanly.
- For widget tasks: `node -c public/ct-widget.js` (syntax-only check).

**End-to-end (Davis runs manually after all tasks commit):**

1. Run migration 007 in Supabase SQL editor; confirm output shows `ALTER TABLE … ADD COLUMN` without errors.
2. Confirm `\d ct_cases` and `\d case_events` in `psql` (or the Supabase table editor) both show a new `sf_case_id text` column.
3. In a Salesforce case page, click the CT bookmarklet. Widget should appear as before. Resolve the case.
4. Query Supabase:
   ```sql
   select case_number, sf_case_id
   from ct_cases
   order by ended_at desc
   limit 3;
   ```
   The most-recent row should show a `500…` value in `sf_case_id`. Older rows will have NULL.
5. Open Meridian's Activity Log. Hover the row for the case just logged — the external-link icon appears at the right of the case number. Hover the icon, cursor becomes pointer, color shifts to Hapag Orange.
6. Click the icon. A new tab opens to `https://hlag.lightning.force.com/lightning/r/Case/500…/view` and renders the case. ✅
7. Hover a row with no `sf_case_id` (historical) — no icon appears. ✅
8. Tab through the Activity Log with keyboard — focus ring appears on rows and on the icon when it's revealed.

---

## Notes for Ralph

- **Task 1.1 is the hairiest task.** The bookmarklet is a single-line minified IIFE inside a template literal. Escaping is brittle. If the string breaks, roll back and log for Davis — don't try to be clever. The file must remain parseable by JS.
- **Do NOT run any SQL.** Migration files are committed, not executed. Davis handles every database change manually.
- **The edit-modal surface (Task 2.4) uses `showOnHover={false}`.** This is deliberate. Inside a modal, the icon is always visible because there's no row-hover context.
- **Column widths are fragile.** The activity row uses fixed-width zones for alignment (see CT 1.0 design note: *"Fixed-width zones — type label is 110px, case # is 96px, so every row aligns perfectly"*). When the case# slot grows from 96 → 116 to accommodate the icon, visually verify the rest of the row still aligns. If it doesn't, don't fight it — put the icon in a separate dedicated slot instead.
- **If Task 3.1 reveals that `useActivityData` selects specific fields instead of `*`**, the absence of `sf_case_id` will silently render no icons even on new entries. This is the most likely cause of "feature looks broken but build passes."
- **Commit per-task.** Davis wants rollback granularity.
- **If any task fails or feels wrong, log it in `progress.txt` and move on.** Ralph shipping four of five tasks correctly is better than five of five with a broken one.

---
