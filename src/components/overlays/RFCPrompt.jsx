import { C } from '../../lib/constants.js'

/**
 * RFCPrompt — compact inline banner asking "Resolved First Contact?"
 *
 * Props:
 *   caseNumber  — display name for the case (string)
 *   onYes       — user clicked "Yes — RFC"
 *   onNo        — user clicked "No"
 */
export default function RFCPrompt({ caseNumber, onYes, onNo }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 14px',
      height: 48,
      background: 'rgba(217,119,6,0.08)',
      borderTop: '1px solid rgba(217,119,6,0.2)',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 14, color: '#f59e0b', flexShrink: 0 }}>⚠</span>
      <span style={{
        fontSize: 12, fontWeight: 600, color: C.textPri,
        flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {caseNumber && (
          <span style={{ fontWeight: 400, color: C.textSec, marginRight: 8 }}>
            {caseNumber} ·
          </span>
        )}
        Resolved First Contact?
      </span>
      <button
        onClick={onYes}
        style={{
          height: 28, padding: '0 12px', borderRadius: 14,
          border: '1px solid rgba(217,119,6,0.5)',
          background: 'rgba(217,119,6,0.15)',
          color: '#f59e0b', fontSize: 11, fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >Yes — RFC</button>
      <button
        onClick={onNo}
        style={{
          height: 28, padding: '0 12px', borderRadius: 14,
          border: `1px solid ${C.border}`,
          background: 'transparent',
          color: C.textSec, fontSize: 11, fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >No</button>
    </div>
  )
}
