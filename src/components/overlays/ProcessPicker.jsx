import { useState } from 'react'
import { C } from '../../lib/constants.js'
import CategoryDrillDown from '../CategoryDrillDown.jsx'

export default function ProcessPicker({ categories, elapsed, onConfirm, onCancel, onScreenChange }) {
  const [selection, setSelection] = useState(null) // { cat, sub }
  const [minutes, setMinutes] = useState(Math.max(1, Math.round(elapsed / 60)))

  const tint = categories[0]?.team === 'CH' ? 'rgba(251,191,36,1)' : 'rgba(96,165,250,1)'
  const tintColor = categories[0]?.team === 'CH' ? C.awaiting : C.process

  function handleSelect(cat, sub) {
    setSelection({ cat, sub })
  }

  function handleConfirm() {
    if (!selection) return
    onConfirm(selection.cat.id, selection.sub?.id ?? null, minutes * 60)
  }

  return (
    <div style={{
      background: C.bg,
      borderTop: `1px solid ${C.divider}`,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      height: 'calc(100% - 36px)',
      minHeight: 0,
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.textSec, letterSpacing: '0.07em' }}>
          LOG PROCESS
        </span>
        <button
          onClick={onCancel}
          style={{
            background: 'none', border: 'none', color: C.textSec,
            fontSize: 14, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
          }}
        >✕</button>
      </div>

      {!selection ? (
        /* Phase 1: category drill-down */
        <CategoryDrillDown
          categories={categories}
          onSelect={handleSelect}
          onScreenChange={onScreenChange}
        />
      ) : (
        /* Phase 2: confirm selection + minutes */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <div style={{ fontSize: 11, color: C.textPri }}>
            <span style={{ color: tint, fontWeight: 700 }}>{selection.cat.name}</span>
            {selection.sub && <> &rsaquo; {selection.sub.name}</>}
          </div>
          <button
            onClick={() => { onScreenChange?.('category'); setSelection(null) }}
            style={{
              background: 'none', border: 'none', color: tintColor,
              fontSize: 10, cursor: 'pointer', padding: 0, alignSelf: 'flex-start', fontWeight: 600,
            }}
          >
            ← Change
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: C.textSec, whiteSpace: 'nowrap' }}>Minutes:</span>
            <input
              type="number"
              min={1}
              value={minutes}
              onChange={e => setMinutes(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                width: 48, padding: '3px 6px', borderRadius: 4,
                border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.07)',
                color: C.textPri, fontSize: 12, textAlign: 'center',
              }}
            />
            <button
              onClick={handleConfirm}
              style={{
                padding: '4px 14px', borderRadius: 12, border: 'none',
                background: C.process, color: '#fff', fontSize: 11,
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
