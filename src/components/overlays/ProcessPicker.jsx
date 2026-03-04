import { useState } from 'react'
import { C } from '../../lib/constants.js'

export default function ProcessPicker({ categories, elapsed, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(null)
  const [minutes, setMinutes] = useState(Math.max(1, Math.round(elapsed / 60)))

  const chCategories = categories.filter(c => c.team === 'CH' || c.team === 'BOTH')
  const mhCategories = categories.filter(c => c.team === 'MH' || c.team === 'BOTH')

  function handleConfirm() {
    if (!selected) return
    onConfirm(selected.name, minutes * 60)
  }

  const colHeadStyle = {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 3,
  }

  function catBtn(cat, tint) {
    const isSel = selected?.id === cat.id
    return (
      <button
        key={cat.id}
        onClick={() => setSelected(cat)}
        style={{
          width: '100%', textAlign: 'left', padding: '4px 7px',
          marginBottom: 2, borderRadius: 4, border: isSel ? `1px solid ${tint}` : '1px solid transparent',
          cursor: 'pointer', fontSize: 10.5, fontWeight: isSel ? 700 : 400,
          background: isSel ? `${tint}55` : `${tint}22`,
          color: C.textPri, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {cat.name}
      </button>
    )
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

      {/* Category grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, flex: 1, overflowY: 'auto' }}>
        <div>
          <div style={{ ...colHeadStyle, color: C.awaiting }}>CH</div>
          {chCategories.map(cat => catBtn(cat, 'rgba(251,191,36,1)'))}
        </div>
        <div>
          <div style={{ ...colHeadStyle, color: C.process }}>MH</div>
          {mhCategories.map(cat => catBtn(cat, 'rgba(96,165,250,1)'))}
        </div>
      </div>

      {/* Minutes + confirm (only after selection) */}
      {selected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
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
      )}
    </div>
  )
}
