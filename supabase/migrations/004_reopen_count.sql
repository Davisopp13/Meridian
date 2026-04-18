-- ============================================================
-- 004_reopen_count.sql
-- Adds reopen_count to ct_cases. Idempotent.
-- ============================================================

-- 1. Add the column with a safe default.
ALTER TABLE ct_cases
  ADD COLUMN IF NOT EXISTS reopen_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN ct_cases.reopen_count IS
  'Number of prior resolved sessions for this case_number at the time this session was created. 0 = first resolve, 1 = first re-open, 2+ = chronic.';

CREATE INDEX IF NOT EXISTS ct_cases_reopen_count_idx ON ct_cases(reopen_count)
  WHERE reopen_count > 0;

-- 2. Backfill — for every existing row, compute the count of
--    prior resolved ct_cases with the same case_number that were
--    created BEFORE this row.
WITH ordered AS (
  SELECT
    id,
    case_number,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY case_number
      ORDER BY created_at ASC
    ) - 1 AS computed_count
  FROM ct_cases
  WHERE resolution = 'resolved'
)
UPDATE ct_cases
SET reopen_count = ordered.computed_count
FROM ordered
WHERE ct_cases.id = ordered.id
  AND ct_cases.reopen_count = 0  -- only backfill rows that haven't been stamped
  AND ordered.computed_count > 0;

-- 3. Sanity — summary of the distribution after backfill.
SELECT
  reopen_count,
  COUNT(*) AS cases_with_this_count
FROM ct_cases
WHERE resolution = 'resolved'
GROUP BY reopen_count
ORDER BY reopen_count;
