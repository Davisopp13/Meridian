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

      <CategoryDrillDown
        categories={categories}
        onSelect={handleSelect}
        onScreenChange={onScreenChange}
      />
    </div>
  )
}
