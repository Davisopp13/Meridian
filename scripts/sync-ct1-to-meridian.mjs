#!/usr/bin/env node
// sync-ct1-to-meridian.mjs
// One-shot backfill: CT 1.0 activity_log → Meridian case_events
// Usage:
//   node scripts/sync-ct1-to-meridian.mjs --dry-run   (no writes)
//   node scripts/sync-ct1-to-meridian.mjs --commit     (writes to Meridian)

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { mapActivityRowToCaseEvent } from './sync-ct1-column-map.mjs'

// ── ANSI colours ───────────────────────────────────────────────────────────
const RED    = '\x1b[31m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BOLD   = '\x1b[1m'
const RESET  = '\x1b[0m'

// ── Load .env.sync if present ──────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.sync')
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
}

// ── Env validation ─────────────────────────────────────────────────────────
const REQUIRED_VARS = [
  'CT1_SUPABASE_URL',
  'CT1_SERVICE_KEY',
  'MERIDIAN_SUPABASE_URL',
  'MERIDIAN_SERVICE_KEY',
]
const missing = REQUIRED_VARS.filter(v => !process.env[v])
if (missing.length > 0) {
  console.error(`${RED}ERROR: Missing required environment variables:${RESET}`)
  missing.forEach(v => console.error(`  ${RED}✗${RESET} ${v}`))
  console.error(`\nCreate .env.sync from .env.sync.example and fill in the values.`)
  process.exit(1)
}

// ── CLI flag parsing ───────────────────────────────────────────────────────
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const isCommit = args.includes('--commit')

if (!isDryRun && !isCommit) {
  console.error(`${RED}ERROR: Must pass exactly one of --dry-run or --commit${RESET}`)
  process.exit(1)
}
if (isDryRun && isCommit) {
  console.error(`${RED}ERROR: Cannot pass both --dry-run and --commit${RESET}`)
  process.exit(1)
}

// ── Mode banner (must be first visible output) ─────────────────────────────
if (isDryRun) {
  console.log(`\n${BOLD}${GREEN}═══════════════════════════════════════${RESET}`)
  console.log(`${BOLD}${GREEN}  MODE: dry-run  (no writes will occur)${RESET}`)
  console.log(`${BOLD}${GREEN}═══════════════════════════════════════${RESET}\n`)
} else {
  console.log(`\n${BOLD}${RED}══════════════════════════════════════════════${RESET}`)
  console.log(`${BOLD}${RED}  MODE: commit  ⚠️  WILL WRITE TO MERIDIAN DB${RESET}`)
  console.log(`${BOLD}${RED}══════════════════════════════════════════════${RESET}\n`)
}

console.log(`CT 1.0:   ${process.env.CT1_SUPABASE_URL}`)
console.log(`Meridian: ${process.env.MERIDIAN_SUPABASE_URL}\n`)

// ── Supabase clients ───────────────────────────────────────────────────────
const ct1Client = createClient(
  process.env.CT1_SUPABASE_URL,
  process.env.CT1_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const meridianClient = createClient(
  process.env.MERIDIAN_SUPABASE_URL,
  process.env.MERIDIAN_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Verify migration 007 was applied (proxy: source_event_id column exists) ─
async function checkMigrationApplied() {
  const { error } = await meridianClient
    .from('case_events')
    .select('source_event_id')
    .limit(1)

  if (error) {
    console.error(`${RED}ERROR: Migration 007_migration_source_id.sql has not been applied.${RESET}`)
    console.error(`  Column 'source_event_id' not found on case_events: ${error.message}`)
    console.error(`\n  Apply the migration in the Meridian SQL editor before running --commit.`)
    console.error(`  File: supabase/migrations/007_migration_source_id.sql`)
    return false
  }
  return true
}

// ── Build email → UUID user map ────────────────────────────────────────────
async function buildUserMap() {
  console.log('Building user map (CT 1.0 → Meridian by email)…')

  // Fetch CT 1.0 users via auth admin API (paginated)
  const ct1Users = []
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await ct1Client.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error(`${RED}ERROR: Failed to fetch CT 1.0 users: ${error.message}${RESET}`)
      process.exit(1)
    }
    ct1Users.push(...data.users)
    if (data.users.length < perPage) break
    page++
  }

  // Fetch Meridian platform_users
  const { data: meridianUsers, error: mErr } = await meridianClient
    .from('platform_users')
    .select('id, email')

  if (mErr) {
    console.error(`${RED}ERROR: Failed to fetch Meridian platform_users: ${mErr.message}${RESET}`)
    process.exit(1)
  }

  // Build Meridian email → id map
  const meridianByEmail = new Map()
  for (const u of meridianUsers) {
    if (!u.email) continue
    const key = u.email.toLowerCase()
    if (meridianByEmail.has(key)) {
      console.warn(`${YELLOW}WARN: Duplicate email in Meridian platform_users: ${key}${RESET}`)
    } else {
      meridianByEmail.set(key, u.id)
    }
  }

  // Build CT 1.0 userId → Meridian userId map, joining on email
  const userMap = new Map()
  let matched = 0, unmatched = 0, ambiguous = 0

  const ct1EmailsSeen = new Map()
  for (const u of ct1Users) {
    if (!u.email) { unmatched++; continue }
    const key = u.email.toLowerCase()
    if (ct1EmailsSeen.has(key)) {
      console.warn(`${YELLOW}WARN: Duplicate email in CT 1.0 users: ${key}${RESET}`)
      ambiguous++
      continue
    }
    ct1EmailsSeen.set(key, u.id)

    const meridianId = meridianByEmail.get(key)
    if (meridianId) {
      userMap.set(u.id, meridianId)
      matched++
    } else {
      console.log(`  No Meridian account for CT 1.0 user: ${key} — skipping`)
      unmatched++
    }
  }

  console.log(`User map: ${matched} matched, ${unmatched} unmatched, ${ambiguous} ambiguous\n`)
  return userMap
}

// ── Scan CT 1.0 activity_log and map rows ─────────────────────────────────
const PAGE_SIZE = 1000
const BATCH_SIZE = 500

async function scanAndSync(userMap) {
  let offset = 0
  let totalScanned = 0
  let totalWouldInsert = 0
  let totalSkippedNoUser = 0
  let totalSkippedUnknownType = 0
  let totalSkippedOther = 0

  const firstRows = []          // first 3 valid rows for dry-run preview
  const batchBuffer = []        // rows pending write in commit mode
  let batchNum = 0

  // Count total rows first for progress display
  const { count, error: countErr } = await ct1Client
    .from('activity_log')
    .select('*', { count: 'exact', head: true })
  if (countErr) {
    console.warn(`${YELLOW}WARN: Could not count activity_log rows: ${countErr.message}${RESET}`)
  }
  const totalRows = count ?? '?'
  const totalBatches = count ? Math.ceil(count / BATCH_SIZE) : '?'
  console.log(`activity_log total rows: ${totalRows}`)
  console.log(`Scanning in pages of ${PAGE_SIZE}, writing in batches of ${BATCH_SIZE}…\n`)

  while (true) {
    const { data: rows, error } = await ct1Client
      .from('activity_log')
      .select('id, user_id, case_number, activity_type, rfc, created_at, session_id')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error(`${RED}ERROR: Failed to fetch activity_log at offset ${offset}: ${error.message}${RESET}`)
      process.exit(1)
    }
    if (!rows || rows.length === 0) break

    for (const row of rows) {
      totalScanned++
      let result
      try {
        result = mapActivityRowToCaseEvent(row, userMap)
      } catch (err) {
        console.warn(`${YELLOW}WARN: Mapper threw on row ${row.id}: ${err.message}${RESET}`)
        totalSkippedOther++
        continue
      }

      if (!result.valid) {
        if (result.reason === 'no_user_match') totalSkippedNoUser++
        else if (result.reason === 'unknown_activity_type') totalSkippedUnknownType++
        else totalSkippedOther++
        continue
      }

      totalWouldInsert++
      if (firstRows.length < 3) firstRows.push(result.row)

      if (!isDryRun) {
        batchBuffer.push(result.row)
        if (batchBuffer.length >= BATCH_SIZE) {
          batchNum++
          await flushBatch(batchBuffer.splice(0, BATCH_SIZE), batchNum, totalBatches)
        }
      }
    }

    offset += rows.length
    if (rows.length < PAGE_SIZE) break
  }

  // Flush remaining rows in commit mode
  if (!isDryRun && batchBuffer.length > 0) {
    batchNum++
    await flushBatch(batchBuffer.splice(0), batchNum, totalBatches)
  }

  return { totalScanned, totalWouldInsert, totalSkippedNoUser, totalSkippedUnknownType, totalSkippedOther, firstRows }
}

// ── Flush one batch of rows to Meridian ───────────────────────────────────
async function flushBatch(batch, batchNum, totalBatches) {
  const { error, data } = await meridianClient
    .from('case_events')
    .upsert(batch, { onConflict: 'source,source_event_id', ignoreDuplicates: true })

  if (error) {
    console.error(`${RED}ERROR in batch ${batchNum}/${totalBatches}: ${error.message}${RESET}`)
    console.error(`  First 3 rows in failing batch:`)
    batch.slice(0, 3).forEach(r => {
      // Redact nothing — case_number is not PII
      console.error(`    ${JSON.stringify({ source_event_id: r.source_event_id, type: r.type, user_id: r.user_id })}`)
    })
    process.exit(1)
  }

  // ignoreDuplicates=true means Supabase returns only newly-inserted rows (or nothing with return=minimal)
  // We can't get exact inserted vs duplicate counts without return=representation, but log batch size
  console.log(`  [batch ${batchNum}/${totalBatches}] ${batch.length} rows upserted (duplicates silently skipped)`)
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  // Always verify migration in commit mode
  if (isCommit) {
    const ok = await checkMigrationApplied()
    if (!ok) process.exit(1)
    console.log(`${GREEN}✓ Migration 007 verified (source_event_id column present)${RESET}\n`)
  }

  const userMap = await buildUserMap()

  if (userMap.size === 0) {
    console.error(`${RED}ERROR: User map is empty — no CT 1.0 users matched Meridian accounts.${RESET}`)
    console.error(`Check that CT1_SUPABASE_URL and MERIDIAN_SUPABASE_URL are for the correct projects.`)
    process.exit(1)
  }

  const stats = await scanAndSync(userMap)

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(48)}`)
  console.log(`Scanned:                ${stats.totalScanned.toLocaleString()} activity_log rows`)
  console.log(`Would insert:           ${stats.totalWouldInsert.toLocaleString()}`)
  console.log(`Skipped (no user match):  ${stats.totalSkippedNoUser.toLocaleString()}`)
  console.log(`Skipped (unknown type):   ${stats.totalSkippedUnknownType.toLocaleString()}`)
  if (stats.totalSkippedOther > 0) {
    console.log(`Skipped (other):          ${stats.totalSkippedOther.toLocaleString()}`)
  }
  console.log(`${'─'.repeat(48)}`)

  if (isDryRun) {
    console.log(`\n${BOLD}First 3 rows that would be inserted:${RESET}`)
    if (stats.firstRows.length === 0) {
      console.log('  (none — all rows skipped)')
    } else {
      stats.firstRows.forEach(r => console.log(`  ${JSON.stringify(r)}`))
    }
    console.log(`\n${BOLD}${GREEN}Dry run complete. No writes performed.${RESET}`)
    console.log(`Run with --commit to apply.\n`)
  } else {
    console.log(`\n${BOLD}${GREEN}Commit complete.${RESET}`)
    console.log(`Re-run with --commit to verify idempotency (all batches should show 0 new rows).\n`)
  }
}

main().catch(err => {
  console.error(`${RED}Unhandled error: ${err.message}${RESET}`)
  console.error(err.stack)
  process.exit(1)
})
