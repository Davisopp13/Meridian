# Notes Capture, Display & Search — PRD

## Project Overview

Add free-text notes to Meridian's CT and MPL widgets, surface them in the ActivityLog, and add a server-side search box that matches across case number, category name, and note text across all of the current user's logged activity.

This is **one cohesive feature shipped as 11 atomic tasks**. Each task is independently testable and committable. The feature is complete when all tasks are `[x]` and `npm run build` + `node -c public/ct-widget.js` both pass.

## Architecture & Key Decisions

**Do not question or change these.** They are locked.

- **Framework:** React 18 + Vite. Vanilla JS for `public/ct-widget.js` (runs on Salesforce pages, no bundler).
- **Database:** Supabase PostgreSQL. All migrations are numbered sequentially in `supabase/migrations/`. Latest existing migration is `022_unified_start_rpc_user_id.sql`. This PRD creates `023_` and `024_`.
- **Styling:** Inline styles + CSS variables from `src/lib/constants.js` (imported as `C`). Do not introduce Tailwind, CSS modules, or external stylesheets.
- **Capture-side data model:**
  - `case_events.note varchar(500)` — new column for case resolution/reclass/awaiting/not-a-case notes
  - `mpl_entries.note varchar(500)` — new column for MPL process notes
  - `ct_calls.notes varchar(500)` — **already exists**, do not recreate
- **Search architecture:** A single Postgres RPC (`search_user_activity`) that UNIONs `case_events` and `mpl_entries`, filters by user and ILIKE query, returns a unified result set with a `src` discriminator column. Hard limit of 50 results. Single round-trip.
- **Search UX:** One text input above the filter tabs in `ActivityLog.jsx`. 250ms debounce. Matches case number + category name + note text. Results replace the activity feed while a query is active; clearing the input restores the normal date-range view.
- **Note display:** Inline suffix on the category column in `EntryRow`. Format: `{category} — "{note}"` when note exists. Truncates with the category via `text-overflow: ellipsis`. Full note visible on hover via `title` attribute.

## File Structure

Files created or modified by this PRD:

```
supabase/migrations/
  023_notes_on_events_and_entries.sql       (new)
  024_search_user_activity_rpc.sql           (new)
src/lib/
  api.js                                     (modified — extend 2 wrappers, add 1)
src/hooks/
  useActivityData.js                         (modified — select note, map through)
src/components/
  ActivityLog.jsx                            (modified — search input, EntryRow note, EditModal note)
src/mpl/
  MplApp.jsx                                 (modified — pass note through to logMplEntry)
src/components/
  ManualEntryForm.jsx                        (modified — notes input, onLog carries note)
src/components/overlays/
  ProcessPicker.jsx                          (modified — notes input, onConfirm carries note)
public/
  ct-widget.js                               (modified — notes input in tray)
```

## Environment & Setup

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: already in `.env.local`. Do not modify env setup.
- Migrations are **not applied automatically**. Ralph only writes the `.sql` files. Davis applies them manually in Supabase SQL editor after review.
- There is no test runner. The verification command is `npm run build` and, for `ct-widget.js`, `node -c public/ct-widget.js`. Do not install vitest, jest, or any test framework.

## Relevant Existing Code Ralph Must Know

### `src/lib/api.js` — current wrapper signatures

```js
// Existing, to be extended
export async function logCaseEvent({ userId, type, sessionId = null, excluded = false, rfc = false }) {
  return supabase.from('case_events').insert({
    user_id: userId, type, session_id: sessionId, excluded, rfc,
  })
}

// Existing, to be extended
export async function logMplEntry({ userId, categoryId, subcategoryId, minutes, source = 'mpl_widget' }) {
  return supabase.from('mpl_entries').insert({
    user_id: userId, category_id: categoryId, subcategory_id: subcategoryId, minutes, source,
  })
}
```

### `src/hooks/useActivityData.js` — current selects

```js
// case events query (line ~89)
.select('id, user_id, type, rfc, timestamp, session_id, sf_case_id')

// mpl entries query (line ~94)
.select('id, user_id, minutes, created_at, category_id, subcategory_id, mpl_categories(name)')

// ct_cases join (line ~117)
.select('id, case_number, duration_s, sf_case_id')
```

### `src/components/overlays/ProcessPicker.jsx` — current confirm signature

```js
onConfirm(categoryId, subcategoryId, elapsed)
```

### `src/components/ManualEntryForm.jsx` — current log signature

```js
onLog(categoryId, subcategoryId, minutes)
```

### `src/components/ActivityLog.jsx` — `EntryRow` layout

Fixed 36px row height. Columns in order: 3px accent bar, Type label (110px), separator, Case # (116px), separator, Category (flex: 1), Duration, Time (68px), Edit icon (28px). The note suffix appends to the Category cell.

### `public/ct-widget.js` — state and tray

Vanilla JS. The widget's state object is initialized at the top of the file. The tray HTML is built as a template string inside the `render()` function. Action buttons trigger handlers like `handleResolved`, `handleReclassified`, `handleCall`. Calls write to **both** `ct_calls` and `case_events` — the note goes on BOTH rows (`ct_calls.notes` and `case_events.note`) so that the canonical record and the activity feed both carry the note. The dashboard reads from `case_events.note` so that's the user-facing copy.

## Tasks

### Phase 1: Schema

- [x] **Task 1: Create notes migration**
  - File: `supabase/migrations/023_notes_on_events_and_entries.sql`
  - Content:
    ```sql
    alter table case_events  add column if not exists note varchar(500);
    alter table mpl_entries  add column if not exists note varchar(500);

    comment on column case_events.note is 'Optional free-text note captured at log time. Max 500 chars.';
    comment on column mpl_entries.note is 'Optional free-text note captured at log time. Max 500 chars.';
    ```
  - **Do not apply the migration.** Only write the file.
  - Test: file exists at correct path. `grep -c 'add column if not exists note' supabase/migrations/023_notes_on_events_and_entries.sql` returns `2`.

- [ ] **Task 2: Create search RPC migration**
  - File: `supabase/migrations/024_search_user_activity_rpc.sql`
  - Content:
    ```sql
    -- Unified activity search across case_events and mpl_entries for a single user.
    -- Matches ILIKE on case_number (from joined ct_cases), category name, and note.
    -- Hard limit 50 rows. Ordered by timestamp desc.
    create or replace function search_user_activity(
      p_user_id uuid,
      p_query   text,
      p_limit   int default 50
    )
    returns table (
      id            uuid,
      src           text,         -- 'case' | 'mpl'
      type          text,
      case_number   text,
      sf_case_id    text,
      category_id   uuid,
      category_name text,
      duration_s    int,
      minutes       int,
      rfc           boolean,
      note          text,
      ts            timestamptz
    )
    language sql
    stable
    security invoker
    as $$
      with q as (select '%' || coalesce(p_query, '') || '%' as like_pat)
      -- Case events
      select
        ce.id,
        'case'::text as src,
        ce.type,
        cc.case_number,
        ce.sf_case_id,
        null::uuid as category_id,
        null::text as category_name,
        cc.duration_s,
        null::int as minutes,
        ce.rfc,
        ce.note,
        ce.timestamp as ts
      from case_events ce
      left join ct_cases cc on cc.id = ce.session_id
      cross join q
      where ce.user_id = p_user_id
        and (
          ce.note        ilike q.like_pat or
          cc.case_number ilike q.like_pat
        )

      union all

      -- MPL entries
      select
        me.id,
        'mpl'::text as src,
        'Process'::text as type,
        null::text as case_number,
        null::text as sf_case_id,
        me.category_id,
        mc.name as category_name,
        null::int as duration_s,
        me.minutes,
        false as rfc,
        me.note,
        me.created_at as ts
      from mpl_entries me
      left join mpl_categories mc on mc.id = me.category_id
      cross join q
      where me.user_id = p_user_id
        and (
          me.note ilike q.like_pat or
          mc.name ilike q.like_pat
        )

      order by ts desc
      limit p_limit
    $$;

    -- Lock down: only the authenticated user can search their own activity.
    -- RLS on the underlying tables already restricts row visibility by user_id,
    -- and security invoker means the RPC executes as the calling user.
    grant execute on function search_user_activity(uuid, text, int) to authenticated;
    ```
  - Test: file exists, `grep -c 'create or replace function search_user_activity' supabase/migrations/024_search_user_activity_rpc.sql` returns `1`.

### Phase 2: Wrappers

- [ ] **Task 3: Extend `logCaseEvent` and `logMplEntry` to accept `note`**
  - File: `src/lib/api.js`
  - Extend both wrappers. Default value `note = null` so existing callers keep working.
  - After:
    ```js
    export async function logCaseEvent({ userId, type, sessionId = null, excluded = false, rfc = false, note = null }) {
      return supabase.from('case_events').insert({
        user_id: userId, type, session_id: sessionId, excluded, rfc, note,
      })
    }

    export async function logMplEntry({ userId, categoryId, subcategoryId, minutes, source = 'mpl_widget', note = null }) {
      return supabase.from('mpl_entries').insert({
        user_id: userId, category_id: categoryId, subcategory_id: subcategoryId, minutes, source, note,
      })
    }
    ```
  - Test: `npm run build` passes. `grep -c 'note = null' src/lib/api.js` returns at least `2`.

- [ ] **Task 4: Add `searchUserActivity` wrapper**
  - File: `src/lib/api.js`
  - Add after `logMplEntry`:
    ```js
    export async function searchUserActivity(userId, query, limit = 50) {
      if (!userId || !query || query.trim().length === 0) return { data: [], error: null }
      return supabase.rpc('search_user_activity', {
        p_user_id: userId,
        p_query: query.trim(),
        p_limit: limit,
      })
    }
    ```
  - Test: `npm run build` passes. `grep -c 'searchUserActivity' src/lib/api.js` returns `1`.

### Phase 3: Capture — CT widget

- [ ] **Task 5: Add notes input to `public/ct-widget.js`**
  - The widget is vanilla JS with a Shadow DOM. The state object is defined at the top of the file. The tray is built as an HTML template string.
  - Add `note: ''` to the `state` object alongside existing keys.
  - In the render function, add an input element at the top of the action tray HTML (above the disposition buttons). Use inline styles matching the existing tray's dark-on-dark aesthetic. Constraints:
    - `<input type="text" id="ct-note-input" maxlength="500" placeholder="Optional note — press any action to log" style="...">`
    - Style should inherit the tray's background, have a subtle border, and a font size around 12px.
  - Add a delegated event listener (or extend the existing one) to sync input changes to `state.note`.
  - In `handleResolved`, `handleReclassified`, `handleAwaiting`, `handleNotACase`: include `note: state.note || null` in the `relayPost('case_events', {...})` payload.
  - In `handleCall`: include `notes: state.note || null` in the `relayPost('ct_calls', {...})` payload, AND include `note: state.note || null` in the `relayPost('case_events', {...})` payload on the same call. The `ct_calls` column is named `notes` (plural) and the `case_events` column is `note` (singular) — these are separate columns on separate tables, both holding the same value. The dashboard displays from `case_events.note`; `ct_calls.notes` is the canonical record.
  - After a successful log, clear `state.note = ''` and re-render so the input empties.
  - Test: `node -c public/ct-widget.js` exits 0. `grep -c 'ct-note-input' public/ct-widget.js` returns at least `1`. `grep -c "note: state.note" public/ct-widget.js` returns at least `5` (one per action: resolved, reclassified, awaiting, not-a-case, and the call event write). `grep -c "notes: state.note" public/ct-widget.js` returns at least `1` (the ct_calls write).

### Phase 4: Capture — MPL widgets

- [ ] **Task 6: Add notes input and `note` prop to `ProcessPicker.jsx`**
  - File: `src/components/overlays/ProcessPicker.jsx`
  - Add a `useState('')` for the note inside the component.
  - Add a single-line text input above the drill-down area. Style constraints:
    - `maxLength={500}`
    - `placeholder="Optional note — tap a subcategory to log"`
    - Uses `C.border`, `C.bg`, `C.textPri` from `src/lib/constants.js` (already imported)
    - Height ~28px, fontSize 12, padding `6px 8px`, border-radius 6px
  - Change `onConfirm` signature from `(categoryId, subcategoryId, elapsed)` to `(categoryId, subcategoryId, elapsed, note)`. Pass the note state value.
  - Test: `npm run build` passes. `grep -c "onConfirm(.*note" src/components/overlays/ProcessPicker.jsx` returns at least `1`.

- [ ] **Task 7: Add notes input and `note` arg to `ManualEntryForm.jsx`**
  - File: `src/components/ManualEntryForm.jsx`
  - Add `useState('')` for the note.
  - Insert the notes input between the duration picker block (ends around line 135) and the selection indicator (line 138). Same styling as Task 6.
  - Update both call sites of `onLog`:
    - `handleSelect` (line ~35): `onLog(cat.id, sub?.id ?? null, mins, note)`
    - `handleDurationSelect` (line ~47): `onLog(selection.cat.id, selection.sub?.id ?? null, d, note)`
  - Change JSDoc from `onLog — (categoryId, subcategoryId, minutes)` to `onLog — (categoryId, subcategoryId, minutes, note)`.
  - Test: `npm run build` passes. `grep -c "onLog(.*note)" src/components/ManualEntryForm.jsx` returns at least `2`.

- [ ] **Task 8: Wire `note` through `MplApp.jsx` to `logMplEntry`**
  - File: `src/mpl/MplApp.jsx`
  - Find the handler that receives `ProcessPicker`'s `onConfirm` callback (typically `handleChipStripConfirm` → `handleConfirmProcess`). Accept and forward `note`.
  - Find the handler that receives `ManualEntryForm`'s `onLog` callback. Accept and forward `note`.
  - Both handlers ultimately call `logMplEntry(...)`. Pass `note` as a property in the args object.
  - Test: `npm run build` passes. `grep -c "note" src/mpl/MplApp.jsx` returns higher than the baseline measured before this task — specifically, at least 4 new occurrences should appear (2 handler parameters + 2 logMplEntry calls).

### Phase 5: Display — ActivityLog

- [ ] **Task 9: Update `useActivityData.js` to select and map `note`**
  - File: `src/hooks/useActivityData.js`
  - In the `case_events` select (line ~89), append `, note` to the column list: `.select('id, user_id, type, rfc, timestamp, session_id, sf_case_id, note')`.
  - In the `mpl_entries` select (line ~94), append `, note`: `.select('id, user_id, minutes, created_at, category_id, subcategory_id, mpl_categories(name), note')`.
  - In the mapping functions (lines ~29 and ~47), include `note: row.note ?? null` in the returned entry object.
  - Test: `npm run build` passes. `grep -c "note" src/hooks/useActivityData.js` increases by at least 4 (2 selects + 2 mappings).

- [ ] **Task 10: Display note in `EntryRow` and add note field to `EditModal`**
  - File: `src/components/ActivityLog.jsx`
  - **EntryRow (around line 620–706):** In the Category cell, change the span's content from `{entry.category}` to conditionally include the note:
    ```jsx
    <span style={{...existing styles}} title={entry.note || ''}>
      {entry.category}
      {entry.note && <span style={{ color: 'var(--text-dim)' }}> — "{entry.note}"</span>}
    </span>
    ```
  - The existing ellipsis truncation already handles overflow.
  - **EditModal (around line 202):** Add a controlled textarea for the note, initialized from `entry.note || ''`. Place it below the existing form fields (after duration/minutes). Max 500 chars. Save path: add `note` to the patch object passed to `onSave`. `handleSave` currently handles `isCaseEntry` and the `else` branch separately — add `note` to both patches.
  - Test: `npm run build` passes. `grep -c 'entry.note' src/components/ActivityLog.jsx` returns at least `3` (EntryRow display, title attribute, EditModal initial value).

### Phase 6: Search

- [ ] **Task 11: Add search input and wire to `searchUserActivity`**
  - File: `src/components/ActivityLog.jsx`
  - Import `searchUserActivity` from `../lib/api`.
  - Add state: `const [searchQuery, setSearchQuery] = useState('')`, `const [searchResults, setSearchResults] = useState(null)`, `const [searchLoading, setSearchLoading] = useState(false)`.
  - Add a debounced effect (250ms):
    ```js
    useEffect(() => {
      if (!searchQuery.trim()) { setSearchResults(null); return; }
      const handle = setTimeout(async () => {
        setSearchLoading(true)
        const { data, error } = await searchUserActivity(userId, searchQuery)
        if (error) console.error('search error:', error)
        // Shape results into the same format as entries from useActivityData
        const mapped = (data || []).map(r => ({
          id: r.id,
          type: r.type === 'Process' ? 'Process' : r.type,
          src: r.src,
          case_number: r.case_number,
          sf_case_id: r.sf_case_id,
          category: r.category_name || '',
          dur: r.duration_s ?? (r.minutes ? r.minutes * 60 : 0),
          minutes: r.minutes,
          rfc: r.rfc,
          note: r.note,
          ts: new Date(r.ts),
        }))
        setSearchResults(mapped)
        setSearchLoading(false)
      }, 250)
      return () => clearTimeout(handle)
    }, [searchQuery, userId])
    ```
  - Render the input above the existing FilterTab row. Styling:
    - Width 100%, max-width 340px, height 32px, padding 8px 12px, fontSize 13, border via `C.border`, background `C.bg`, border-radius 8px
    - Placeholder: `"Search case #, category, or note…"`
  - When `searchResults !== null`, render `searchResults` in place of the normal entries. Show a small caption: `"{searchResults.length} result{s} — showing most recent 50. Clear search to restore."`
  - If `searchResults.length === 50`, append `"(limit reached — refine search to narrow)"` to the caption.
  - Disable the date range and filter tabs while searching (opacity 0.5, cursor not-allowed).
  - The type capitalization in case_events is lowercase (`resolved`, `reclassified`, `call`, etc.), but the `TYPE_STYLE` map and `FILTER_TABS` use Title Case. Check how `useActivityData` normalizes this today and apply the same transform to the RPC results.
  - Test: `npm run build` passes. `grep -c 'searchUserActivity' src/components/ActivityLog.jsx` returns at least `1`. `grep -c 'setSearchQuery' src/components/ActivityLog.jsx` returns at least `2` (declaration + input handler).

## Testing Strategy

Ralph must run these commands after each task to verify:

- **Primary:** `npm run build` — must exit 0
- **For `ct-widget.js` changes:** `node -c public/ct-widget.js` — must exit 0
- **For grep-based checks:** explicit in each task's Test: section

Do not install a test framework. Do not write unit tests. This project verifies via build + syntax check + grep assertions.

## Out of Scope

Ralph must not attempt any of these:

- Applying migrations (Davis applies manually in Supabase SQL editor)
- Adding a dashboard "Notes" column to `DashboardTable.jsx` (that's a summary table, not an entry list — out of scope)
- Editing the CT widget's call direction picker (separate concern, not in this PRD)
- Adding full-text search with `tsvector`/GIN index (alpha uses ILIKE only)
- Cross-month search result pagination beyond the hard 50-row limit
- Search history, saved searches, or search suggestions
- Exporting search results
- Adding notes to `bar_sessions` or any other table not explicitly listed
- Editing notes from the widget (edit happens only via the dashboard's existing EditModal)
- Touching `public/meridian-trigger.js` or `public/meridian-relay.html` or any relay infrastructure
- Changing RLS policies on `case_events` or `mpl_entries`
- Renaming `ct_calls.notes` to `ct_calls.note` (schema inconsistency is known, not worth fixing now)

## Notes for Ralph

- **The CT widget cannot import from `src/lib/api.js`.** It runs in a Shadow DOM on Salesforce pages and uses the relay iframe for all Supabase writes. Keep it self-contained.
- **`ct_calls.notes` is plural.** `case_events.note` and `mpl_entries.note` are singular. This is the existing convention; don't rename.
- **Watch for the type casing issue in search.** `case_events.type` is stored lowercase (`resolved`). `FILTER_TABS` and `TYPE_STYLE` use Title Case (`Resolved`). `useActivityData` normalizes this; the search results need the same normalization applied.
- **If a task's verification fails, leave it `[ ]` and log what went wrong in `progress.txt`.** Do not attempt to work around a failed task by modifying a later task's assumptions. Each task must stand on its own.
- **Do not commit migrations as "applied."** The files exist in the repo; Supabase state is Davis's responsibility. If a later task depends on a column that the unapplied migration introduces, the build will still pass because the build doesn't run migrations — Supabase client code just writes to the column and succeeds or fails at runtime, not build time.
- **Do not change the search query parsing.** The RPC does plain `ILIKE '%query%'`. No stemming, no tokenization, no multi-word splitting. Keep it simple.
- **If the ActivityLog's existing mock data mode (`MOCK_ENTRIES` at line ~29) is in use, the search feature will not interact with it gracefully.** That's fine — mock mode is dev-only. Ignore the interaction.
- **`MplApp.jsx` is 665 lines.** Navigate it carefully. Use `grep -n "logMplEntry\|handleConfirmProcess\|handleChipStripConfirm"` to find the exact call sites rather than reading linearly.
