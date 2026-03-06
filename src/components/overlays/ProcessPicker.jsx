import { useState } from 'react'
import { C } from '../../lib/constants.js'

export default function ProcessPicker({ categories, elapsed, onConfirm, onCancel }) {
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedSub, setSelectedSub] = useState(null)
  const [minutes, setMinutes] = useState(Math.max(1, Math.round(elapsed / 60)))

  const tint = categories[0]?.team === 'CH' ? 'rgba(251,191,36,1)' : 'rgba(96,165,250,1)'
  const tintColor = categories[0]?.team === 'CH' ? C.awaiting : C.process

  function handleSelectCat(cat) {
    setSelectedCat(cat)
    const subs = cat.mpl_subcategories || []
    setSelectedSub(subs.length === 1 ? subs[0] : null)
  }

  function handleConfirm() {
    if (!selectedCat || !selectedSub) return
    onConfirm(selectedCat.id, selectedSub.id, minutes * 60)
  }

  function itemBtn(item, isSelected) {
    return (
      <button
        key={item.id}
        onClick={() => isSelected === 'cat' ? handleSelectCat(item) : setSelectedSub(item)}
        style={{
          width: '100%', textAlign: 'left', padding: '4px 7px',
          marginBottom: 2, borderRadius: 4,
          border: (isSelected === 'cat' ? selectedCat?.id : selectedSub?.id) === item.id
            ? `1px solid ${tint}` : '1px solid transparent',
          cursor: 'pointer', fontSize: 10.5,
          fontWeight: (isSelected === 'cat' ? selectedCat?.id : selectedSub?.id) === item.id ? 700 : 400,
          background: (isSelected === 'cat' ? selectedCat?.id : selectedSub?.id) === item.id
            ? `${tint}55` : `${tint}22`,
          color: C.textPri, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {item.name}
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

      {/* Step 1: Category list */}
      <div style={{ overflowY: 'auto' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 3, color: tintColor }}>
          CATEGORY
        </div>
        {categories.map(cat => itemBtn(cat, 'cat'))}
      </div>

      {/* Step 2: Subcategory list */}
      {selectedCat && (
        <div style={{ overflowY: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 3, color: C.textSec }}>
            SUBCATEGORY
          </div>
          {(selectedCat.mpl_subcategories || []).map(sub => itemBtn(sub, 'sub'))}
        </div>
      )}

      {/* Step 3: Minutes + confirm */}
      {selectedCat && selectedSub && (
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
