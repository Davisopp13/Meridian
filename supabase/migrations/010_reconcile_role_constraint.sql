-- 010_reconcile_role_constraint.sql
-- Reconciles the role CHECK constraint on platform_users.
-- Migration 003 declared CHECK (role IN ('agent','supervisor','director')).
-- Production actually uses ('agent','supervisor','admin').
-- This migration aligns the constraint with production and removes 'director'.
--
-- Safe to run multiple times (idempotent).
-- Davis must apply this manually in the Supabase SQL Editor.

-- ----------------------------------------------------------------
-- Step 1: Warn (not error) if any rows have a role outside the
-- canonical set. This lets Davis see stray data before we mutate.
-- ----------------------------------------------------------------
DO $$
DECLARE
  bad_count int;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM platform_users
  WHERE role NOT IN ('agent', 'supervisor', 'admin');

  IF bad_count > 0 THEN
    RAISE NOTICE 'WARNING: % platform_users row(s) have a role outside (agent, supervisor, admin). They will be migrated to supervisor in Step 2.', bad_count;
  ELSE
    RAISE NOTICE 'All platform_users roles are within the canonical set (agent, supervisor, admin). No data migration needed.';
  END IF;
END $$;

-- ----------------------------------------------------------------
-- Step 2: Migrate any 'director' rows to 'supervisor' before the
-- constraint swap. Handles a hypothetical fresh-DB scenario where
-- migration 003 was applied and someone was seeded as director.
-- In production there are no director rows, so this is a no-op.
-- ----------------------------------------------------------------
UPDATE platform_users
SET role = 'supervisor'
WHERE role = 'director';

-- ----------------------------------------------------------------
-- Step 3: Drop the existing role CHECK constraint (whatever name
-- PostgreSQL assigned it) and replace with the canonical set.
-- We use a DO block to handle both possible constraint names
-- gracefully (auto-named vs. explicitly named in older migrations).
-- ----------------------------------------------------------------
DO $$
BEGIN
  -- Drop by the auto-generated name from migration 003
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_users_role_check'
      AND conrelid = 'platform_users'::regclass
  ) THEN
    ALTER TABLE platform_users DROP CONSTRAINT platform_users_role_check;
    RAISE NOTICE 'Dropped constraint platform_users_role_check.';
  ELSE
    RAISE NOTICE 'Constraint platform_users_role_check not found — already dropped or differently named.';
  END IF;
END $$;

-- Add the canonical constraint. Naming it explicitly so future
-- migrations can reference it by name.
ALTER TABLE platform_users
  ADD CONSTRAINT platform_users_role_check
    CHECK (role IN ('agent', 'supervisor', 'admin'));

-- ----------------------------------------------------------------
-- Step 4: Summary — review this output after applying.
-- ----------------------------------------------------------------
SELECT
  role,
  COUNT(*) AS user_count
FROM platform_users
GROUP BY role
ORDER BY role;

SELECT pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE t.relname = 'platform_users'
  AND c.conname = 'platform_users_role_check';
