// sync-ct1-column-map.test.mjs
// Unit tests for the CT 1.0 → Meridian row mapper.
// Run: node scripts/sync-ct1-column-map.test.mjs
// Exits 0 on success, 1 on any failure.

import assert from 'node:assert/strict'
import { mapActivityRowToCaseEvent } from './sync-ct1-column-map.mjs'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

const CT1_USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const MERIDIAN_USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002'
const SOURCE_EVENT_ID = 'cccccccc-0000-0000-0000-000000000003'

const userMap = new Map([[CT1_USER_ID, MERIDIAN_USER_ID]])

const baseRow = {
  id: SOURCE_EVENT_ID,
  user_id: CT1_USER_ID,
  case_number: '130971881',
  activity_type: 'resolved',
  rfc: false,
  created_at: '2025-01-15T10:30:00Z',
  session_id: 'sess-001',
}

console.log('\nRunning column mapper tests…\n')

// ── Happy path ─────────────────────────────────────────────────────────────

test('resolved maps correctly', () => {
  const result = mapActivityRowToCaseEvent(baseRow, userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.user_id, MERIDIAN_USER_ID)
  assert.equal(result.row.type, 'resolved')
  assert.equal(result.row.excluded, false)
  assert.equal(result.row.rfc, false)
  assert.equal(result.row.source, 'ct_1_migration')
  assert.equal(result.row.source_event_id, SOURCE_EVENT_ID)
  assert.equal(result.row.timestamp, '2025-01-15T10:30:00Z')
  assert.equal(result.row.session_id, 'sess-001')
})

test('reclass maps to reclassified', () => {
  const result = mapActivityRowToCaseEvent({ ...baseRow, activity_type: 'reclass' }, userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.type, 'reclassified')
  assert.equal(result.row.excluded, false)
})

test('call maps to call', () => {
  const result = mapActivityRowToCaseEvent({ ...baseRow, activity_type: 'call' }, userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.type, 'call')
  assert.equal(result.row.excluded, false)
})

test('not_a_case maps with excluded=true', () => {
  const result = mapActivityRowToCaseEvent({ ...baseRow, activity_type: 'not_a_case' }, userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.type, 'not_a_case')
  assert.equal(result.row.excluded, true)
})

test('rfc activity_type maps to rfc with excluded=false', () => {
  const result = mapActivityRowToCaseEvent({ ...baseRow, activity_type: 'rfc' }, userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.type, 'rfc')
  assert.equal(result.row.excluded, false)
})

test('rfc boolean field passes through on resolved row', () => {
  const result = mapActivityRowToCaseEvent({ ...baseRow, rfc: true }, userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.rfc, true)
  assert.equal(result.row.excluded, false, 'rfc boolean alone does not set excluded')
})

test('null session_id becomes null', () => {
  const result = mapActivityRowToCaseEvent({ ...baseRow, session_id: null }, userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.session_id, null)
})

test('missing session_id becomes null', () => {
  const row = { ...baseRow }
  delete row.session_id
  const result = mapActivityRowToCaseEvent(row, userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.session_id, null)
})

// ── Skip cases ─────────────────────────────────────────────────────────────

test('unknown activity_type returns valid=false with reason unknown_activity_type', () => {
  const result = mapActivityRowToCaseEvent({ ...baseRow, activity_type: 'transfer' }, userMap)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'unknown_activity_type')
})

test('user not in map returns valid=false with reason no_user_match', () => {
  const otherMap = new Map([['different-id', MERIDIAN_USER_ID]])
  const result = mapActivityRowToCaseEvent(baseRow, otherMap)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'no_user_match')
})

test('empty user map returns no_user_match', () => {
  const result = mapActivityRowToCaseEvent(baseRow, new Map())
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'no_user_match')
})

// ── Output structure ───────────────────────────────────────────────────────

test('output row contains only expected keys', () => {
  const result = mapActivityRowToCaseEvent(baseRow, userMap)
  assert.equal(result.valid, true)
  const keys = Object.keys(result.row).sort()
  const expected = ['excluded', 'rfc', 'session_id', 'source', 'source_event_id', 'timestamp', 'type', 'user_id'].sort()
  assert.deepEqual(keys, expected)
})

test('case_number is not included in output (not needed for Insights)', () => {
  const result = mapActivityRowToCaseEvent(baseRow, userMap)
  assert.equal(result.valid, true)
  assert.equal('case_number' in result.row, false)
})

// ── Results ────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)

if (failed > 0) {
  process.exit(1)
}
