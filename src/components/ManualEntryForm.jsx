import { C } from '../lib/constants.js'

/**
 * ManualEntryForm — shown when the `+` button is tapped.
 * No process pill or timer is created; user selects duration + category and logs directly.
 *
 * Props:
 *   categories  — [{ id, name, team, mpl_subcategories[] }]
 *   onClose     — () close without logging
 *   onLog       — (categoryId, subcategoryId, minutes) save entry with source:'manual'
 */
export default function ManualEntryForm({ categories = [], onClose, onLog }) {
  return (
    <div style={{
      background: C.bg,
      borderTop: `1px solid ${C.divider}`,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      height: 'calc(100% - 60px)',
      boxSizing: 'border-box',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.textSec, letterSpacing: '0.07em' }}>
          LOG PROCESS
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: C.textSec,
            fontSize: 14, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
          }}
        >✕</button>
      </div>

      {/* Placeholder — Task 2 will replace this with duration picker + category drill-down */}
      <div style={{ fontSize: 10, color: C.textSec, textAlign: 'center', paddingTop: 8 }}>
        Select duration and category…
      </div>
    </div>
  )
}
