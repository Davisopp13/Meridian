# CC Prompt: Fix case_events ↔ ct_cases join via session_id

## Context

The Meridian activity log shows every row as `Resolved · Manual` with no case number, even though `ct_cases` has correctly-written rows with `case_number` and `sf_case_id` populated. Root cause: the widget writes `ct_cases` and `case_events` as two independent inserts, both with `session_id: null`. There's no link between them, so the Supabase relational join in `useActivityData` (`ct_cases(...)`) returns null, which falls through to `'Manual'` in the render.

Both inserts write to Supabase fine — the data is there. The join is the problem.

The SF Direct Link PRD also surfaced this: even though the bookmarklet now scrapes `sf_case_id` and the widget writes it to both tables, the UI can't see it on `case_events` rows because `useActivityData.js` was supposed to read it from the join (which is broken).

## The Fix

Use `session_id` as the join key between `ct_cases` and `case_events` rows that describe the same case session. Generate one UUID per case start in the widget, write it on every insert that belongs to that session. Update the data hook to join on it.

**Why session_id over sequential inserts with case_id FK:**
The widget currently fires `ct_cases` and `case_events` inserts independently — if one fails, the other still lands. That's deliberate resilience. Sequentializing (insert `ct_cases` first, await, then insert `case_events` with `case_id`) would regress this by making a `ct_cases` failure block the log. `session_id` keeps both inserts independent and gives us a clean join key. It's also the column already named for this purpose.

## Files to change

1. **`supabase/migrations/016_session_id_fk.sql`** (new) — ensure `session_id` columns exist on both tables with an index for the join.
2. **`public/ct-widget.js`** — generate a session UUID when a case session starts; write it to `ct_cases` and every `case_events` insert in that session.
3. **`src/hooks/useActivityData.js`** — change the join key and pull `case_number` + `sf_case_id` correctly. Also fix the two fields Ralph *claimed* it added but didn't.

---

## Step 1 — Write the migration (DO NOT run it; Davis runs manually)

Create `supabase/migrations/016_session_id_fk.sql`:

```sql
-- ============================================================
-- 016_session_id_fk.sql
-- Ensures session_id exists as a TEXT column on both ct_cases
-- and case_events so the widget can use it as a join key between
-- independent inserts describing the same case session.
-- Idempotent.
-- ============================================================

-- Add session_id if missing. TEXT (not UUID) because we want the
-- widget to generate it client-side via crypto.randomUUID() without
-- requiring a uuid-ossp cast round-trip.
ALTER TABLE public.ct_cases
  ADD COLUMN IF NOT EXISTS session_id TEXT;

ALTER TABLE public.case_events
  ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Indexes for the join. Partial (WHERE NOT NULL) keeps them lean —
-- historical rows with session_id = NULL are not linkable anyway.
CREATE INDEX IF NOT EXISTS idx_ct_cases_session_id
  ON public.ct_cases (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_events_session_id
  ON public.case_events (session_id)
  WHERE session_id IS NOT NULL;

-- Grants, in case a DROP SCHEMA CASCADE has stripped them historically.
GRANT SELECT, INSERT, UPDATE ON public.ct_cases TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.case_events TO anon, authenticated, service_role;
```

Note: If `session_id` already exists on either table (from the original schema), `ADD COLUMN IF NOT EXISTS` is a no-op. That's fine.

---

## Step 2 — Update `public/ct-widget.js` to generate and pass session_id

The widget currently writes `session_id: null` in three places (lines 243, 283, 314 approximately). We need to:

1. Add a `sessionId` field to the state object.
2. Generate a new UUID whenever a case session starts.
3. Clear it whenever a case session ends (same places `state.caseNumber = ''` is cleared).
4. Use `state.sessionId` instead of `null` in all three `case_events` inserts.
5. Also write `session_id: state.sessionId` to the `ct_cases` inserts in `handleResolved` and `handleReclass` (these currently don't write it at all).

### 2a. Add to state

Find the `state` object declaration (around line 45). Add `sessionId: '',` alongside `caseNumber`, `sfCaseId`, etc.

### 2b. Add a helper near the top of the IIFE (before action handlers)

```js
function newSessionId() {
  // crypto.randomUUID is available in every browser that supports Document PiP
  // (the hard requirement for Meridian anyway).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback — extremely unlikely to hit, but harmless if we do
  return 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}
```

### 2c. Populate sessionId when a session starts

A "session starts" whenever `state.caseNumber` transitions from empty to non-empty. Three places:

1. **Inside the initial MERIDIAN_PAYLOAD hydration block** (around line 484, where `state.caseNumber = MERIDIAN_PAYLOAD.caseNumber` is set). Immediately after setting caseNumber, add:
   ```js
   state.sessionId = newSessionId();
   ```

2. **Inside the `_meridianRefresh` handler** (around line 495, where `state.caseNumber = payload.caseNumber` is set). Same treatment:
   ```js
   state.sessionId = newSessionId();
   ```

3. **Inside `handleStartCase`** (around line 330, where a case is started from document.title scrape):
   ```js
   function handleStartCase() {
     var m = document.title.match(/(\d{8,})/);
     if (m) {
       state.caseNumber = m[1];
       state.sessionId  = newSessionId();  // ← add this
       state.elapsed    = 0;
       state.isAwaiting = false;
       startTimer();
       render();
     } else {
       showWidgetToast('No case detected on this page');
     }
   }
   ```

### 2d. Use session_id in every insert

Find every `case_events` insert in handleResolved, handleReclass, handleCall. Each currently has `session_id: null`. Change to:
```js
session_id: state.sessionId || null,
```

Find every `ct_cases` insert in handleResolved and handleReclass. They currently don't have a `session_id` field at all. Add it alongside `case_number`, `sf_case_id`, etc.:
```js
session_id: state.sessionId || null,
```

### 2e. Clear sessionId on reset

Find every place `state.caseNumber = ''` is cleared (reset blocks in handleResolved, handleReclass, handleDismissCase — around lines 252, 292, 345). Add alongside:
```js
state.sessionId = '';
```

### 2f. Verify

```bash
grep -c "sessionId\|session_id" public/ct-widget.js
# Expect ≥ 12 matches. (state declaration, newSessionId function, 3 populate sites,
# 3-4 insert sites, 3 clear sites.)

node -c public/ct-widget.js
# Expect exit 0.
```

---

## Step 3 — Update `src/hooks/useActivityData.js`

This is where the false Ralph log hurt us. Two things need fixing:

1. The `.select(...)` call doesn't pull `sf_case_id` from `case_events`, doesn't pull `sf_case_id` from `ct_cases` subselect, and the join isn't matching any rows.
2. `normalizeCaseEvent` doesn't surface `sf_case_id` at all.

### 3a. Change the select

Current (line ~87):
```js
.select('id, user_id, type, rfc, timestamp, session_id, ct_cases(id, case_number, duration_s)')
```

We need two changes:
- Add `sf_case_id` to the top-level (`case_events.sf_case_id` — migration 015 added this column).
- Add `sf_case_id` to the `ct_cases` subselect (migration 015 also added it there).

But here's the key: **the relational join syntax `ct_cases(...)` joins on whatever FK Postgres knows about**. Since the widget hasn't been setting session_id, the join has returned `null` for every row. After Step 2 ships and new rows arrive with session_id populated, we want the join to use `session_id` explicitly.

Supabase/PostgREST supports hinting the join with a FK name or column. The cleanest option here is to use an **explicit embedded resource** via the `!inner` or `!left` syntax with the column name, like:
```js
.select('id, user_id, type, rfc, timestamp, session_id, sf_case_id, ct_cases!session_id(case_number, duration_s, sf_case_id)')
```

If that syntax errors (PostgREST is picky), fall back to a **two-query pattern**: select `case_events` first, then batch-fetch the matching `ct_cases` by `session_id IN (...)` and merge in JS. Document whichever you land on in a comment.

### 3b. Fix normalizeCaseEvent

Current:
```js
function normalizeCaseEvent(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    type: TYPE_LABEL[row.type] || row.type,
    rawType: row.type,
    src: 'case',
    session_id: row.session_id || null,
    case_number: row.ct_cases?.case_number || null,
    case_id: row.ct_cases?.id || null,
    category: '',
    dur: row.ct_cases?.duration_s || 0,
    rfc: row.rfc || false,
    ts: new Date(row.timestamp || row.created_at),
  };
}
```

Target — surface `sf_case_id` with a two-source fallback (row first, then joined ct_cases):
```js
function normalizeCaseEvent(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    type: TYPE_LABEL[row.type] || row.type,
    rawType: row.type,
    src: 'case',
    session_id: row.session_id || null,
    case_number: row.ct_cases?.case_number || null,
    case_id: row.ct_cases?.id || null,
    sf_case_id: row.sf_case_id || row.ct_cases?.sf_case_id || null,  // ← add this
    category: '',
    dur: row.ct_cases?.duration_s || 0,
    rfc: row.rfc || false,
    ts: new Date(row.timestamp || row.created_at),
  };
}
```

### 3c. Verify

```bash
grep -c "sf_case_id" src/hooks/useActivityData.js
# Expect ≥ 2 (one in select, one in normalize)

grep -c "session_id" src/hooks/useActivityData.js
# Expect ≥ 2 (already there + no change, but make sure grep passes)

npx vite build
# Expect clean build, 0 errors
```

---

## Out of scope

- Backfilling `session_id` onto historical rows (they stay orphaned; that's fine).
- Removing the `Manual` fallback render in `ActivityLog.jsx` line 679 — we still need it for MPL entries and historical cases.
- Modifying `handleCall` to also write `ct_cases` — it currently doesn't create a ct_cases row and we're not changing that.
- Any changes to the MPL pipeline.
- Any new UI features. This is a pure plumbing fix.

---

## End-to-end verification (Davis runs manually after all changes commit)

1. Run migration 016 in Supabase SQL editor. Expect "Success. No rows returned."
2. Reinstall the bookmarklet from Meridian (so the new widget code picks up `newSessionId()`).
3. Open an SF case, click bookmarklet, resolve.
4. Run:
   ```sql
   select ce.type, ce.session_id, ce.sf_case_id, cc.case_number, cc.sf_case_id as cc_sf
   from case_events ce
   left join ct_cases cc on cc.session_id = ce.session_id
   where ce.timestamp > now() - interval '5 minutes'
   order by ce.timestamp desc;
   ```
   Expect: the most recent `case_events` row has a non-null `session_id` and the join returns a matching `ct_cases` row with `case_number` populated.
5. Refresh Meridian dashboard. The activity row should now display the case number (e.g. `135013902`) instead of `Manual`, and on hover the SF link icon should appear.
6. Click the icon → opens the live case in Salesforce.

## Notes

- If Step 3a's `ct_cases!session_id(...)` syntax doesn't work in PostgREST, commit the two-query fallback instead. Don't waste time debugging FK hints — the two-query approach is just as correct and ships today.
- Commit each of the three steps as a separate commit so Davis has rollback granularity: `migration: add session_id index on ct_cases/case_events`, `widget: generate session_id per case session`, `fix: useActivityData join on session_id + surface sf_case_id`.
