import { C } from '../../lib/constants.js'
import CategoryDrillDown from '../CategoryDrillDown.jsx'

export default function ProcessPicker({ categories, elapsed, onConfirm, onCancel, onScreenChange }) {
  function handleSelect(cat, sub) {
    onConfirm(cat.id, sub?.id ?? null, elapsed)
  }

  return (
    <div style={{
      background: C.bg,
      borderTop: `1px solid ${C.divider}`,
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100% - 60px)',
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
            LOG PROCESS
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

      <CategoryDrillDown
        categories={categories}
        onSelect={handleSelect}
        onScreenChange={onScreenChange}
        contentPadding="14px"
      />
    </div>
  )
}
