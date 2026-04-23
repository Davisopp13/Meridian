import { useState, useEffect } from 'react'
import { C } from '../lib/constants.js'
import CategoryDrillDown from './CategoryDrillDown.jsx'
import RecentPairsStrip from './RecentPairsStrip.jsx'
import { fetchRecentMplPairs } from '../lib/api.js'

const DURATIONS = [5, 10, 15, 20, 30, 45, 60]

/**
 * ManualEntryForm — shown when the `+` button is tapped.
 * No process pill or timer is created; user selects duration + category and logs directly.
 * Selecting a subcategory with a duration already chosen logs immediately.
 *
 * Props:
 *   categories  — [{ id, name, team, mpl_subcategories[] }]
 *   onClose     — () close without logging
 *   onLog       — (categoryId, subcategoryId|null, minutes, note) save entry with source:'manual'
 */
export default function ManualEntryForm({ categories = [], onClose, onLog, userId }) {
  const [selectedMinutes, setSelectedMinutes] = useState(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('')
  const [selection, setSelection] = useState(null) // { cat, sub }
  const [showDurationHint, setShowDurationHint] = useState(false)
  const [note, setNote] = useState('')
  const [recentPairs, setRecentPairs] = useState([])
  const [drillScreen, setDrillScreen] = useState('category')

  useEffect(() => {
    if (!userId) return
    fetchRecentMplPairs(userId, 5).then(({ data }) => setRecentPairs(data || []))
  }, [userId])

  const tint = categories[0]?.team === 'CH' ? 'rgba(251,191,36,1)' : 'rgba(96,165,250,1)'
  const tintColor = categories[0]?.team === 'CH' ? C.awaiting : C.process

  function getMinutes() {
    if (showCustom) return parseInt(customMinutes) || 0
    return selectedMinutes || 0
  }

  function handleSelect(cat, sub) {
    const mins = getMinutes()
    if (mins > 0) {
      onLog(cat.id, sub?.id ?? null, mins, note)
    } else {
      setSelection({ cat, sub })
      setShowDurationHint(true)
      setTimeout(() => setShowDurationHint(false), 2000)
    }
  }

  function handleRecentPick(cat, sub) {
    const mins = getMinutes()
    if (mins > 0) {
      onLog(cat.id, sub?.id ?? null, mins, note)
    } else {
      setSelection({ cat, sub })
      setShowDurationHint(true)
      setTimeout(() => setShowDurationHint(false), 2000)
    }
  }

  function handleDurationSelect(d) {
    setSelectedMinutes(d)
    setShowCustom(false)
    if (selection) {
      onLog(selection.cat.id, selection.sub?.id ?? null, d, note)
    }
  }

  function durationPillStyle(val) {
    const isSelected = !showCustom && selectedMinutes === val
    return {
      padding: '2px 6px', borderRadius: 10, fontSize: 9.5,
      fontWeight: isSelected ? 700 : 400, cursor: 'pointer',
      border: isSelected ? `1px solid ${tint}` : '1px solid var(--border)',
      background: isSelected ? `${tint}44` : 'var(--card-bg-subtle)',
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
      flex: 1,
      minHeight: 0,
      boxSizing: 'border-box',
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
              onClick={() => handleDurationSelect(d)}
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
              border: showCustom ? `1px solid ${tint}` : '1px solid var(--border)',
              background: showCustom ? `${tint}44` : 'var(--card-bg-subtle)',
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
                border: `1px solid ${C.border}`, background: 'var(--card-bg-subtle)',
                color: C.textPri, fontSize: 11, textAlign: 'center',
              }}
            />
          )}
        </div>
        {showDurationHint && (
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600, marginTop: 3 }}>
            ↑ Select a duration first
          </div>
        )}
      </div>

      {/* Note input */}
      <input
        type="text"
        maxLength={500}
        placeholder="Optional note — tap a subcategory to log"
        value={note}
        onChange={e => setNote(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          height: 28, padding: '6px 8px', fontSize: 12,
          borderRadius: 6, border: `1px solid ${C.border}`,
          background: C.bg, color: C.textPri, outline: 'none',
        }}
      />

      {/* Selected category indicator */}
      {selection && (
        <div style={{ fontSize: 9.5, color: tintColor, fontWeight: 600, lineHeight: 1 }}>
          {selection.cat.name}{selection.sub ? ` \u203a ${selection.sub.name}` : ''}
        </div>
      )}

      {/* Category drill-down — fills remaining space */}
      <CategoryDrillDown
        categories={categories}
        onSelect={handleSelect}
        onScreenChange={setDrillScreen}
        headerSlot={
          <RecentPairsStrip
            pairs={recentPairs}
            categories={categories}
            onPick={handleRecentPick}
            disabled={drillScreen !== 'category'}
          />
        }
      />
    </div>
  )
}
