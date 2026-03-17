import { useState } from 'react'
import { C, formatElapsed } from '../lib/constants'
import { Check, CornerDownLeft, Phone, Pause, Minus, Play, Circle } from 'lucide-react'

function actionBtn(color, muted = false) {
  return {
    height: 24,
    padding: '0 8px',
    borderRadius: 12,
    border: `1px solid ${muted ? C.border : color}`,
    background: muted ? 'transparent' : `${color}22`,
    color: muted ? C.textSec : color,
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: '"Segoe UI", sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  }
}

export default function CaseLaneRow({
  caseSession,    // { id, caseNum, elapsed, paused, awaiting }
  isFocused,
  onFocus,        // (id)
  onResolve,      // (id) — logs 'resolved' event
  onReclass,      // (id) — logs 'reclassified' event
  onCall,         // (id) — logs 'call' event
  onAwaiting,     // (id) — sets awaiting
  onResume,       // (id) — resumes from awaiting
  onNotACase,     // (id) — logs 'not_a_case' excluded:true, removes
  onRFCRequired,  // (id) — triggers RFCPrompt overlay in App.jsx
}) {
  const [expanded, setExpanded] = useState(false)

  const { id, caseNum, elapsed, awaiting, previouslyResolved } = caseSession

  function handleRowClick() {
    onFocus(id)
    if (!awaiting) setExpanded(e => !e)
  }

  function handleResolve(e) {
    e.stopPropagation()
    onResolve(id)
    setExpanded(false)
    if (previouslyResolved) onRFCRequired(id)
  }

  function handleReclass(e) {
    e.stopPropagation()
    onReclass(id)
    setExpanded(false)
  }

  const rowBg = awaiting
    ? C.amberRow
    : isFocused
      ? C.caseFocus
      : 'transparent'

  const rowStyle = {
    padding: '5px 8px',
    borderRadius: 6,
    background: rowBg,
    border: isFocused ? `1px solid ${C.caseBorder}` : '1px solid transparent',
    cursor: 'pointer',
    transition: 'background 150ms',
    marginBottom: 3,
    userSelect: 'none',
  }

  const labelStyle = {
    fontSize: 10,
    fontWeight: 700,
    fontFamily: '"Segoe UI", sans-serif',
  }

  // ── Awaiting state ──────────────────────────────────────────────────────────
  if (awaiting) {
    return (
      <div style={rowStyle} onClick={handleRowClick}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <Pause size={10} strokeWidth={3} color={C.awaiting} />
          <span style={{ ...labelStyle, color: C.awaiting }}>{caseNum}</span>
          <span style={{
            fontSize: 9, color: C.awaiting,
            background: 'rgba(217,119,6,0.22)',
            borderRadius: 10, padding: '1px 6px', fontWeight: 700,
          }}>Awaiting Info</span>
          <span style={{ fontSize: 10, color: C.textSec, fontVariantNumeric: 'tabular-nums' }}>
            {formatElapsed(elapsed)}
          </span>
          <button
            style={actionBtn(C.resolved)}
            onClick={e => { e.stopPropagation(); onResume(id) }}
          >
            <Play size={10} strokeWidth={3} /> Resume
          </button>
        </div>
      </div>
    )
  }

  // ── Normal (idle / expanded) ────────────────────────────────────────────────
  return (
    <div style={rowStyle} onClick={handleRowClick}>
      {/* Row header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Circle size={6} fill={C.activeDot} color={C.activeDot} />
        <span style={{ ...labelStyle, color: C.textPri }}>{caseNum}</span>
        <span style={{ fontSize: 10, color: C.textSec, fontVariantNumeric: 'tabular-nums', flex: 1 }}>
          {formatElapsed(elapsed)}
        </span>
        <span style={{ fontSize: 9, color: C.textDim }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded actions */}
      {expanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
          <button style={actionBtn(C.resolved)} onClick={handleResolve}><Check size={10} strokeWidth={3} /> Resolve</button>
          <button style={actionBtn(C.reclass)} onClick={handleReclass}><CornerDownLeft size={10} strokeWidth={3} /> Reclass</button>
          <button
            style={actionBtn(C.calls)}
            onClick={e => { e.stopPropagation(); onCall(id) }}
          >
            <Phone size={10} strokeWidth={3} /> Call
          </button>
          <button
            style={actionBtn(C.awaiting)}
            onClick={e => { e.stopPropagation(); onAwaiting(id) }}
          >
            <Pause size={10} strokeWidth={3} /> Awaiting
          </button>
          <button
            style={actionBtn(C.textSec, true)}
            onClick={e => { e.stopPropagation(); onNotACase(id) }}
          >
            <Minus size={10} strokeWidth={3} /> Not a Case
          </button>
        </div>
      )}
    </div>
  )
}
