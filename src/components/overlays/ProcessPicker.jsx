import { useState, useEffect } from 'react'
import { C } from '../../lib/constants.js'
import CategoryDrillDown from '../CategoryDrillDown.jsx'
import RecentPairsStrip from '../RecentPairsStrip.jsx'
import { fetchRecentMplPairs } from '../../lib/api.js'

export default function ProcessPicker({ categories, elapsed, onConfirm, onCancel, onScreenChange, userId }) {
  const [note, setNote] = useState('')
  const [recentPairs, setRecentPairs] = useState([])
  const [drillScreen, setDrillScreen] = useState('category')

  useEffect(() => {
    if (!userId) return
    fetchRecentMplPairs(userId, 5).then(({ data }) => setRecentPairs(data || []))
  }, [userId])

  function handleSelect(cat, sub) {
    onConfirm(cat.id, sub?.id ?? null, elapsed, note)
  }

  function handleRecentPick(cat, sub) {
    onConfirm(cat.id, sub?.id ?? null, elapsed, note)
  }

  function handleScreenChange(s) {
    setDrillScreen(s)
    onScreenChange?.(s)
  }

  return (
    <div style={{
      background: C.bg,
      borderTop: `1px solid ${C.divider}`,
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 14px 10px',
        borderBottom: `1px solid ${C.divider}`,
        background: 'rgba(6,10,20,0.24)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.07em' }}>
            LOG PROCESS · TAP TO FINISH
          </span>
          <span style={{ fontSize: 11, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
            Timer: {Math.max(1, Math.round(elapsed / 60))} min
          </span>
        </div>
        <button
          onClick={onCancel}
          style={{
            background: 'none', border: 'none', color: '#ffffff',
            fontSize: 14, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
          }}
        >✕</button>
      </div>

      <div style={{ padding: '8px 14px 0', flexShrink: 0 }}>
        <input
          type="text"
          maxLength={500}
          placeholder="Optional note — tap a subcategory to log"
          value={note}
          onChange={e => setNote(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            height: 28,
            fontSize: 12,
            padding: '6px 8px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: C.bg,
            color: C.textPri,
            outline: 'none',
          }}
        />
      </div>

      <CategoryDrillDown
        categories={categories}
        onSelect={handleSelect}
        onScreenChange={handleScreenChange}
        contentPadding="14px"
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
