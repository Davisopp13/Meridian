// sync-ct1-column-map.mjs
// Pure mapping function: CT 1.0 activity_log row → Meridian case_events row.
// No I/O — safe to unit-test without network.

// Maps CT 1.0 activity_type values to Meridian case_events type values.
const ACTIVITY_TYPE_MAP = {
  resolved:    'resolved',
  reclass:     'reclassified',
  call:        'call',
  not_a_case:  'not_a_case',
  rfc:         'rfc',
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

  // activity_type must be a recognised value
  const type = ACTIVITY_TYPE_MAP[ct1Row.activity_type]
  if (!type) {
    return { valid: false, reason: 'unknown_activity_type' }
  }

  // excluded: true only for not_a_case events (per CLAUDE.md case outcomes table)
  const excluded = ct1Row.activity_type === 'not_a_case'

  return {
    valid: true,
    row: {
      user_id:         meridianUserId,
      type,
      session_id:      ct1Row.session_id ?? null,
      excluded,
      rfc:             ct1Row.rfc ?? false,
      timestamp:       ct1Row.created_at,
      source:          'ct_1_migration',
      source_event_id: ct1Row.id,
    },
  }
}
