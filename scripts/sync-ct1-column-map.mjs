// sync-ct1-column-map.mjs
// Pure mapping function: CT 1.0 activity_log row → Meridian case_events row.
// No I/O — safe to unit-test without network.

// Keys are lowercased CT 1.0 type values; values are Meridian case_events.type values.
// Keys must be lowercase — caller lowercases the CT 1.0 row's type before lookup.
// CT 1.0 stores Title Case ("Resolved", "Reclassified", "Awaiting_Info") and lowercase
// ("incoming_call", "outgoing_call", "call", "email") — normalize to lowercase at the edge.
const ACTIVITY_TYPE_MAP = {
  resolved:      'resolved',
  reclassified:  'reclassified',
  call:          'call',
  incoming_call: 'call',          // collapse direction — Meridian has no inbound/outbound distinction
  outgoing_call: 'call',
  awaiting_info: 'awaiting_info', // CT 1.0: Awaiting_Info; preserved for planned Meridian feature
  not_a_case:    'not_a_case',    // defensive — not observed in CT 1.0 data but handled if it appears
  rfc:           'rfc',           // defensive — not observed in CT 1.0 data but handled if it appears
  // email — intentionally absent. Legacy type removed from CT 1.0; maps to unknown_activity_type.
}

/**
 * @param {object} ct1Row - Row from CT 1.0 activity_log
 * @param {Map<string, string>} userMap - ct1_user_id → meridian_user_id
 * @returns {{ valid: true, row: object } | { valid: false, reason: string }}
 */
export function mapActivityRowToCaseEvent(ct1Row, userMap) {
  // User must exist in Meridian
  const meridianUserId = userMap.get(ct1Row.user_id)
  if (!meridianUserId) {
    return { valid: false, reason: 'no_user_match' }
  }

  // Normalize CT 1.0 type to lowercase before map lookup
  const rawType = (ct1Row.type || '').toLowerCase()
  const type = ACTIVITY_TYPE_MAP[rawType]
  if (!type) {
    return { valid: false, reason: 'unknown_activity_type' }
  }

  // excluded: true only for not_a_case events (per CLAUDE.md case outcomes table)
  const excluded = rawType === 'not_a_case'

  return {
    valid: true,
    row: {
      user_id:         meridianUserId,
      type,
      session_id:      ct1Row.session_id ?? null,
      excluded,
      rfc:             !!ct1Row.is_rfc,
      timestamp:       ct1Row.timestamp,
      source:          'ct_1_migration',
      source_event_id: String(ct1Row.id),
    },
  }
}
