import { useState } from 'react'
import { C } from '../lib/constants.js'

const DURATIONS = [5, 10, 15, 20, 30, 45, 60]

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
  const [selectedMinutes, setSelectedMinutes] = useState(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('')
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedSub, setSelectedSub] = useState(null)

  const tint = categories[0]?.team === 'CH' ? 'rgba(251,191,36,1)' : 'rgba(96,165,250,1)'
  const tintColor = categories[0]?.team === 'CH' ? C.awaiting : C.process

  function getMinutes() {
    if (showCustom) return parseInt(customMinutes) || 0
    return selectedMinutes || 0
  }

  function handleSelectCat(cat) {
    setSelectedCat(cat)
    const subs = cat.mpl_subcategories || []
    setSelectedSub(subs.length === 1 ? subs[0] : null)
  }

  function handleLog() {
    const mins = getMinutes()
    if (!mins || !selectedCat) return
    onLog(selectedCat.id, selectedSub?.id ?? null, mins)
  }

  const subs = selectedCat?.mpl_subcategories || []
  const canLog = getMinutes() > 0 && selectedCat && (subs.length === 0 || selectedSub != null)

  function durationPillStyle(val) {
    const isSelected = !showCustom && selectedMinutes === val
    return {
      padding: '2px 6px', borderRadius: 10, fontSize: 9.5,
      fontWeight: isSelected ? 700 : 400, cursor: 'pointer',
      border: isSelected ? `1px solid ${tint}` : '1px solid rgba(255,255,255,0.15)',
      background: isSelected ? `${tint}44` : 'rgba(255,255,255,0.06)',
      color: C.textPri,
    }
  }

  function itemBtn(item, type) {
    const isSelected = type === 'cat' ? selectedCat?.id === item.id : selectedSub?.id === item.id
    return (
      <button
        key={item.id}
        onClick={() => type === 'cat' ? handleSelectCat(item) : setSelectedSub(item)}
        style={{
          width: '100%', textAlign: 'left', padding: '3px 7px',
          marginBottom: 2, borderRadius: 4,
          border: isSelected ? `1px solid ${tint}` : '1px solid transparent',
          cursor: 'pointer', fontSize: 10.5,
          fontWeight: isSelected ? 700 : 400,
          background: isSelected ? `${tint}55` : `${tint}22`,
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
      padding: '8px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      height: 'calc(100% - 36px)',
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

      {/* Duration picker */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 3, color: tintColor }}>
          DURATION
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
          {DURATIONS.map(d => (
            <button
              key={d}
              onClick={() => { setSelectedMinutes(d); setShowCustom(false) }}
              style={durationPillStyle(d)}
            >
              {d} min
            </button>
          ))}
          <button
            onClick={() => { setShowCustom(true); setSelectedMinutes(null) }}
            style={{
              padding: '2px 6px', borderRadius: 10, fontSize: 9.5,
              fontWeight: showCustom ? 700 : 400, cursor: 'pointer',
              border: showCustom ? `1px solid ${tint}` : '1px solid rgba(255,255,255,0.15)',
              background: showCustom ? `${tint}44` : 'rgba(255,255,255,0.06)',
              color: C.textPri,
            }}
          >
            Custom
          </button>
          {showCustom && (
            <input
              type="number"
              min={1}
              placeholder="min"
              value={customMinutes}
              onChange={e => setCustomMinutes(e.target.value)}
              style={{
                width: 44, padding: '1px 5px', borderRadius: 4,
                border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.07)',
                color: C.textPri, fontSize: 11, textAlign: 'center',
              }}
            />
          )}
        </div>
      </div>

      {/* Category list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 3, color: tintColor }}>
          CATEGORY
        </div>
        {categories.map(cat => itemBtn(cat, 'cat'))}
      </div>

      {/* Subcategory list */}
      {selectedCat && subs.length > 0 && (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 3, color: C.textSec }}>
            SUBCATEGORY
          </div>
          {subs.map(sub => itemBtn(sub, 'sub'))}
        </div>
      )}

      {/* Log button */}
      {canLog && (
        <button
          onClick={handleLog}
          style={{
            padding: '4px 14px', borderRadius: 12, border: 'none',
            background: C.process, color: '#fff', fontSize: 11,
            fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end',
          }}
        >
          Log
        </button>
      )}
    </div>
  )
}
