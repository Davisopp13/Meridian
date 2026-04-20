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

const userMap = new Map([[CT1_USER_ID, MERIDIAN_USER_ID]])

// ── Shared fixture factory (real CT 1.0 column names) ─────────────────────
function makeRow(overrides = {}) {
  return {
    id: 42,
    user_id: CT1_USER_ID,
    case_number: '130971881',
    type: 'Resolved',
    is_rfc: false,
    timestamp: '2025-01-15T10:30:00Z',
    ...overrides,
  }
}

console.log('\nRunning column mapper tests…\n')

// ── Happy path ─────────────────────────────────────────────────────────────

test('resolved maps correctly (Title Case input)', () => {
  const result = mapActivityRowToCaseEvent(makeRow({ type: 'Resolved' }), userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.user_id, MERIDIAN_USER_ID)
  assert.equal(result.row.type, 'resolved')
  assert.equal(result.row.excluded, false)
  assert.equal(result.row.rfc, false)
  assert.equal(result.row.source, 'ct_1_migration')
  assert.equal(result.row.source_event_id, '42')
  assert.equal(result.row.timestamp, '2025-01-15T10:30:00Z')
  assert.equal(result.row.session_id, null)
})

test('Reclassified maps to reclassified', () => {
  const result = mapActivityRowToCaseEvent(makeRow({ type: 'Reclassified' }), userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.type, 'reclassified')
  assert.equal(result.row.excluded, false)
})

test('call maps to call', () => {
  const result = mapActivityRowToCaseEvent(makeRow({ type: 'call' }), userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.type, 'call')
  assert.equal(result.row.excluded, false)
})

test('not_a_case maps with excluded=true', () => {
  const result = mapActivityRowToCaseEvent(makeRow({ type: 'not_a_case' }), userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.type, 'not_a_case')
  assert.equal(result.row.excluded, true)
})

test('rfc type maps to rfc with excluded=false', () => {
  const result = mapActivityRowToCaseEvent(makeRow({ type: 'rfc' }), userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.type, 'rfc')
  assert.equal(result.row.excluded, false)
})

test('is_rfc boolean passes through on resolved row', () => {
  const result = mapActivityRowToCaseEvent(makeRow({ is_rfc: true }), userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.rfc, true)
  assert.equal(result.row.excluded, false, 'is_rfc alone does not set excluded')
})

test('null session_id (field absent from CT 1.0) becomes null', () => {
  const result = mapActivityRowToCaseEvent(makeRow(), userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.session_id, null)
})

// ── New: real CT 1.0 type values ───────────────────────────────────────────

test('Title Case Resolved normalizes to lowercase match', () => {
  const result = mapActivityRowToCaseEvent(makeRow({ type: 'Resolved' }), userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.type, 'resolved')
})

test('incoming_call collapses to call', () => {
  const result = mapActivityRowToCaseEvent(makeRow({ type: 'incoming_call' }), userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.type, 'call')
})

test('outgoing_call collapses to call', () => {
  const result = mapActivityRowToCaseEvent(makeRow({ type: 'outgoing_call' }), userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.type, 'call')
})

test('Awaiting_Info maps to awaiting_info', () => {
  const result = mapActivityRowToCaseEvent(makeRow({ type: 'Awaiting_Info' }), userMap)
  assert.equal(result.valid, true)
  assert.equal(result.row.type, 'awaiting_info')
})

test('email is unknown (legacy type, intentionally absent from map)', () => {
  const result = mapActivityRowToCaseEvent(makeRow({ type: 'email' }), userMap)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'unknown_activity_type')
})

test('source_event_id is a string (integer CT 1.0 id coerced)', () => {
  const result = mapActivityRowToCaseEvent(makeRow({ id: 12345, type: 'Resolved' }), userMap)
  assert.equal(result.valid, true)
  assert.equal(typeof result.row.source_event_id, 'string')
  assert.equal(result.row.source_event_id, '12345')
})

// ── Skip cases ─────────────────────────────────────────────────────────────

test('unknown type returns valid=false with reason unknown_activity_type', () => {
  const result = mapActivityRowToCaseEvent(makeRow({ type: 'transfer' }), userMap)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'unknown_activity_type')
})

test('user not in map returns valid=false with reason no_user_match', () => {
  const otherMap = new Map([['different-id', MERIDIAN_USER_ID]])
  const result = mapActivityRowToCaseEvent(makeRow(), otherMap)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'no_user_match')
})

test('empty user map returns no_user_match', () => {
  const result = mapActivityRowToCaseEvent(makeRow(), new Map())
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'no_user_match')
})

// ── Output structure ───────────────────────────────────────────────────────

test('output row contains only expected keys', () => {
  const result = mapActivityRowToCaseEvent(makeRow(), userMap)
  assert.equal(result.valid, true)
  const keys = Object.keys(result.row).sort()
  const expected = ['excluded', 'rfc', 'session_id', 'source', 'source_event_id', 'timestamp', 'type', 'user_id'].sort()
  assert.deepEqual(keys, expected)
})

test('case_number is not included in output (not needed for Insights)', () => {
  const result = mapActivityRowToCaseEvent(makeRow(), userMap)
  assert.equal(result.valid, true)
  assert.equal('case_number' in result.row, false)
})

// ── Results ────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)

if (failed > 0) {
  process.exit(1)
}
