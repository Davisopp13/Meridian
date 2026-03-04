import { C } from '../../lib/constants.js'

/**
 * RFCPrompt — bar-triggered overlay asking "Was this a Re-Filed Case?"
 *
 * Props:
 *   caseNumber  — display name for the case (string)
 *   onYes       — user clicked "Yes — RFC"
 *   onNo        — user clicked "No, done"
 */
export default function RFCPrompt({ caseNumber, onYes, onNo }) {
  const panelStyle = {
    padding: '18px 20px',
    background: C.bg,
    borderTop: `1px solid ${C.divider}`,
    fontFamily: '"Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  }

  const titleStyle = {
    fontSize: 13,
    fontWeight: 700,
    color: C.textPri,
    margin: 0,
  }

  const subtitleStyle = {
    fontSize: 11,
    color: C.textSec,
    margin: 0,
  }

  function btn(color, muted) {
    return {
      height: 32,
      padding: '0 18px',
      borderRadius: 16,
      border: `1px solid ${muted ? C.border : color}`,
      background: muted ? 'transparent' : `${color}22`,
      color: muted ? C.textSec : color,
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: '"Segoe UI", sans-serif',
    }
  }

  return (
    <div style={panelStyle}>
      <p style={titleStyle}>Was this a Re-Filed Case?</p>
      {caseNumber && (
        <p style={subtitleStyle}>Case {caseNumber}</p>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={btn(C.awaiting, false)} onClick={onYes}>Yes — RFC</button>
        <button style={btn(C.textSec, true)} onClick={onNo}>No, done</button>
      </div>
    </div>
  )
}
