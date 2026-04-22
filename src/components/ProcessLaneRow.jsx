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
  }
}

export default function ProcessLaneRow({
  process,       // { id, elapsed, categoryName }
  categories,    // [{ id, name, team, display_order, mpl_subcategories[] }]
  onConfirm,     // (id, categoryId, subcategoryId, durationSeconds)
  onCancel,      // (id)
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)

  const { id, elapsed } = process
  const displayName = process.categoryName || 'Uncategorized'

  function handleRowClick() {
    if (!pickerOpen) {
      setPickerOpen(true)
      setSelectedCategory(null)
    }
  }

  function handleSelectCategory(cat) {
    setSelectedCategory(cat)
    const subs = cat.mpl_subcategories || []
    if (subs.length <= 1) {
      onConfirm(id, cat.id, subs[0]?.id ?? null, elapsed)
    }
  }

  function handleCancel(e) {
    e.stopPropagation()
    onCancel(id)
  }

  function handleClosePicker(e) {
    e.stopPropagation()
    setPickerOpen(false)
    setSelectedCategory(null)
  }

  const rowStyle = {
    padding: '5px 8px',
    borderRadius: 6,
    background: pickerOpen ? 'rgba(96,165,250,0.07)' : 'transparent',
    cursor: pickerOpen ? 'default' : 'pointer',
    transition: 'background 150ms',
    marginBottom: 3,
    userSelect: 'none',
  }

  const labelStyle = {
    fontSize: 10,
    fontWeight: 700,
  }

  // ── Idle row ──────────────────────────────────────────────────────────────
  if (!pickerOpen) {
    return (
      <div style={rowStyle} onClick={handleRowClick}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: C.process, fontSize: 10 }}>⏱</span>
          <span style={{ ...labelStyle, color: C.textSec, fontVariantNumeric: 'tabular-nums' }}>
            {formatElapsed(elapsed)}
          </span>
          <span style={{ ...labelStyle, color: C.textPri, flex: 1 }}>
            {displayName}
          </span>
          <button
            style={{ ...actionBtn(C.textSec, true), height: 20, padding: '0 6px', fontSize: 9 }}
            onClick={handleCancel}
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  // ── Picker open ───────────────────────────────────────────────────────────
  const tint = categories[0]?.team === 'CH'
    ? { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.5)', color: '#fbbf24' }
    : { bg: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.5)', color: C.process }

  return (
    <div style={rowStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ color: C.process, fontSize: 10 }}>⏱</span>
        <span style={{ ...labelStyle, color: C.textSec, fontVariantNumeric: 'tabular-nums' }}>
          {formatElapsed(elapsed)}
        </span>
        <span style={{ ...labelStyle, color: C.process, flex: 1 }}>
          Select category
        </span>
        <button
          style={{ ...actionBtn(C.textSec, true), height: 20, padding: '0 6px', fontSize: 9 }}
          onClick={handleClosePicker}
        >
          ✕
        </button>
      </div>

      {/* Step 1: Category list */}
      {categories.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, maxHeight: 90, overflowY: 'auto' }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              style={{
                padding: '5px 8px', borderRadius: 6, fontSize: 10, fontWeight: selectedCategory?.id === cat.id ? 700 : 500,
                cursor: 'pointer', textAlign: 'left', transition: 'all 100ms',
                border: `1px solid ${selectedCategory?.id === cat.id ? tint.border : 'rgba(255,255,255,0.1)'}`,
                background: selectedCategory?.id === cat.id ? tint.bg : 'rgba(255,255,255,0.04)',
                color: selectedCategory?.id === cat.id ? tint.color : C.textSec,
              }}
              onClick={e => { e.stopPropagation(); handleSelectCategory(cat) }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8 }}>
          Loading categories…
        </div>
      )}

      {/* Step 2: Subcategory list */}
      {selectedCategory && (selectedCategory.mpl_subcategories || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, maxHeight: 72, overflowY: 'auto' }}>
          {(selectedCategory.mpl_subcategories || []).map(sub => (
            <button
              key={sub.id}
              style={{
                padding: '4px 7px', borderRadius: 6, fontSize: 10, fontWeight: 500,
                cursor: 'pointer', textAlign: 'left', transition: 'all 100ms',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.02)',
                color: C.textSec,
              }}
              onClick={e => { e.stopPropagation(); onConfirm(id, selectedCategory.id, sub.id, elapsed) }}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
