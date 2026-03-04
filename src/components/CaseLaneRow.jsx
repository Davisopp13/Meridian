import { useState } from 'react'
import { C, formatElapsed } from '../lib/constants'

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
  onRFC,          // (id) — logs 'rfc', closes session
  onCloseSession, // (id) — closes session without RFC
}) {
  const [expanded, setExpanded] = useState(false)
  const [showRFC, setShowRFC] = useState(false)

  const { id, caseNum, elapsed, awaiting } = caseSession

  function handleRowClick() {
    onFocus(id)
    if (!awaiting && !showRFC) setExpanded(e => !e)
  }

  function handleResolve(e) {
    e.stopPropagation()
    onResolve(id)
    setExpanded(false)
    setShowRFC(true)
  }

  function handleReclass(e) {
    e.stopPropagation()
    onReclass(id)
    setExpanded(false)
    setShowRFC(true)
  }

  function handleRFCYes() {
    onRFC(id)
    setShowRFC(false)
  }

  function handleRFCNo() {
    onCloseSession(id)
    setShowRFC(false)
  }

  const rowBg = awaiting
    ? C.amberRow
    : isFocused
    ? C.rowFocus
    : 'transparent'

  const rowStyle = {
    padding: '5px 8px',
    borderRadius: 6,
    background: rowBg,
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
          <span style={{ color: C.awaiting, fontSize: 10 }}>⏸</span>
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
            ▶ Resume
          </button>
        </div>
      </div>
    )
  }

  // ── RFC inline prompt ───────────────────────────────────────────────────────
  if (showRFC) {
    return (
      <div style={{ ...rowStyle, cursor: 'default', background: isFocused ? C.rowFocus : 'rgba(255,255,255,0.04)' }}>
        <div style={{ ...labelStyle, color: C.textPri, marginBottom: 7 }}>
          Was this a Re-Filed Case?
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={actionBtn(C.awaiting)} onClick={handleRFCYes}>Yes — RFC</button>
          <button style={actionBtn(C.textSec, true)} onClick={handleRFCNo}>No, done</button>
        </div>
      </div>
    )
  }

  // ── Normal (idle / expanded) ────────────────────────────────────────────────
  return (
    <div style={rowStyle} onClick={handleRowClick}>
      {/* Row header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ color: C.activeDot, fontSize: 8 }}>●</span>
        <span style={{ ...labelStyle, color: C.textPri }}>{caseNum}</span>
        <span style={{ fontSize: 10, color: C.textSec, fontVariantNumeric: 'tabular-nums', flex: 1 }}>
          {formatElapsed(elapsed)}
        </span>
        <span style={{ fontSize: 9, color: C.textDim }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded actions */}
      {expanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
          <button style={actionBtn(C.resolved)} onClick={handleResolve}>✓ Resolve</button>
          <button style={actionBtn(C.reclass)} onClick={handleReclass}>↩ Reclass</button>
          <button
            style={actionBtn(C.calls)}
            onClick={e => { e.stopPropagation(); onCall(id) }}
          >
            📞 Call
          </button>
          <button
            style={actionBtn(C.awaiting)}
            onClick={e => { e.stopPropagation(); onAwaiting(id) }}
          >
            ⏸ Awaiting
          </button>
          <button
            style={actionBtn(C.textSec, true)}
            onClick={e => { e.stopPropagation(); onNotACase(id) }}
          >
            — Not a Case
          </button>
        </div>
      )}
    </div>
  )
}
