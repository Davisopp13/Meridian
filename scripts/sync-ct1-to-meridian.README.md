# CT 1.0 → Meridian Data Sync

One-shot backfill of CT 1.0 `activity_log` history into Meridian `case_events`.
Idempotent — safe to re-run; duplicate rows are silently skipped.

---

## Pre-flight checklist

1. **Apply the migration** in the Meridian Supabase SQL editor:
   - Open `supabase/migrations/007_migration_source_id.sql`
   - Paste the full contents into the SQL editor and run it
   - Verify success: `SELECT source_event_id FROM case_events LIMIT 1` should return without error

2. **Create `.env.sync`** in the project root (never commit this file):
   ```
   cp .env.sync.example .env.sync
   # then fill in the four values
   ```

3. **Verify the unit tests pass** (no network required):
   ```
   node scripts/sync-ct1-column-map.test.mjs
   ```

---

## Dry run

```
node scripts/sync-ct1-to-meridian.mjs --dry-run
```

Output shows a summary: rows scanned, rows that would be inserted, and rows skipped.
**No writes are made to Meridian.**

Review the "First 3 rows to insert" preview to confirm the column mapping looks correct
before committing.

---

## Commit

Once the dry-run output looks right:

```
node scripts/sync-ct1-to-meridian.mjs --commit
```

This writes to Meridian in batches of 500 rows. Progress is logged per batch.
On any error the script exits 1 immediately — fix the issue and re-run. Re-runs are safe.

---

## Verifying the result

In the Meridian Supabase SQL editor:

```sql
-- Count migrated events
SELECT COUNT(*) FROM case_events WHERE source = 'ct_1_migration';

-- Preview most recent migrated events for a specific user
SELECT created_at, type, excluded, rfc, source_event_id
FROM case_events
WHERE source = 'ct_1_migration'
  AND user_id = '<meridian-user-uuid>'
ORDER BY timestamp DESC
LIMIT 10;
```

---

## Idempotency check

Re-run `--commit` after the first successful run. All batches should report 0 new rows (duplicates silently skipped via the unique index on `(source, source_event_id)`). This confirms no rows were doubled.

---

## Rollback

If the migration needs to be reversed:

```sql
DELETE FROM case_events WHERE source = 'ct_1_migration';
```

This is safe because the unique index means the exact same rows can be re-inserted
by re-running `--commit` after fixing whatever was wrong.

---

## Known tradeoffs

- **`ct_cases` rows are not migrated.** The Meridian Insights dashboard is powered by
  `case_events` aggregates alone — case-number-level detail isn't required for agent stats.
  CT 1.0 case history remains accessible in the CT 1.0 app.

- **`mpl_entries` are not migrated.** CT 1.0 never captured process/MPL data; there is
  no historical MPL to sync.

- **User matching is email-based.** CT 1.0 and Meridian UUIDs are different. Any CT 1.0
  user without a matching Meridian `platform_users` row is skipped (logged, not an error).

- **CT 1.0 `activity_log` schema assumed.** Assumed columns: `id, user_id, case_number,
  activity_type, rfc, created_at, session_id`. If CT 1.0 has different column names, update
  the `SELECT` clause in `scanAndSync()` and the mapper in `sync-ct1-column-map.mjs`.
