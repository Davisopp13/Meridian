import { useState } from 'react'
import { C } from '../lib/constants.js'
import CategoryDrillDown from './CategoryDrillDown.jsx'

const DURATIONS = [5, 10, 15, 20, 30, 45, 60]

/**
 * ManualEntryForm — shown when the `+` button is tapped.
 * No process pill or timer is created; user selects duration + category and logs directly.
 *
 * Props:
 *   categories  — [{ id, name, team, mpl_subcategories[] }]
 *   onClose     — () close without logging
 *   onLog       — (categoryId, subcategoryId|null, minutes) save entry with source:'manual'
 */
export default function ManualEntryForm({ categories = [], onClose, onLog }) {
  const [selectedMinutes, setSelectedMinutes] = useState(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('')
  const [selection, setSelection] = useState(null) // { cat, sub }
  const [selectionKey, setSelectionKey] = useState(0)

  const tint = categories[0]?.team === 'CH' ? 'rgba(251,191,36,1)' : 'rgba(96,165,250,1)'
  const tintColor = categories[0]?.team === 'CH' ? C.awaiting : C.process

  function getMinutes() {
    if (showCustom) return parseInt(customMinutes) || 0
    return selectedMinutes || 0
  }

  function handleSelect(cat, sub) {
    setSelection({ cat, sub })
    setSelectionKey(k => k + 1) // reset drill-down to category screen
  }

  function handleLog() {
    const mins = getMinutes()
    if (!mins || !selection) return
    onLog(selection.cat.id, selection.sub?.id ?? null, mins)
  }

  const canLog = getMinutes() > 0 && selection != null

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

  return (
    <div style={{
      background: C.bg,
      borderTop: `1px solid ${C.divider}`,
      padding: '8px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      height: 'calc(100% - 36px)',
      minHeight: 0,
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

      {/* Selected category indicator */}
      {selection && (
        <div style={{ fontSize: 9.5, color: tintColor, fontWeight: 600, lineHeight: 1 }}>
          {selection.cat.name}{selection.sub ? ` \u203a ${selection.sub.name}` : ''}
        </div>
      )}

      {/* Category drill-down — fills remaining space */}
      <CategoryDrillDown
        key={selectionKey}
        categories={categories}
        onSelect={handleSelect}
      />

      {/* Log button row — fixed height to prevent layout shift */}
      <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {canLog && (
          <button
            onClick={handleLog}
            style={{
              padding: '4px 14px', borderRadius: 12, border: 'none',
              background: C.process, color: '#fff', fontSize: 11,
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            Log
          </button>
        )}
      </div>
    </div>
  )
}
