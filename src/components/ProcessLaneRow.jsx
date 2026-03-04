import { useState } from 'react'
import { C, formatElapsed } from '../lib/constants'

function catBtn(team, selected) {
  const bg = team === 'CH'
    ? 'rgba(251,191,36,0.15)'
    : 'rgba(96,165,250,0.15)'
  const border = team === 'CH'
    ? 'rgba(251,191,36,0.5)'
    : 'rgba(96,165,250,0.5)'
  const color = team === 'CH' ? '#fbbf24' : C.process
  return {
    padding: '5px 8px',
    borderRadius: 6,
    border: `1px solid ${selected ? border : 'rgba(255,255,255,0.1)'}`,
    background: selected ? bg : 'rgba(255,255,255,0.04)',
    color: selected ? color : C.textSec,
    fontSize: 10,
    fontWeight: selected ? 700 : 500,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: '"Segoe UI", sans-serif',
    transition: 'all 100ms',
  }
}

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
    fontFamily: '"Segoe UI", sans-serif',
  }
}

export default function ProcessLaneRow({
  process,       // { id, elapsed, categoryName }
  categories,    // [{ id, name, team, sort_order }]
  onConfirm,     // (id, category, durationSeconds)
  onCancel,      // (id)
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [minutes, setMinutes] = useState('')

  const { id, elapsed } = process
  const displayName = process.categoryName || 'Uncategorized'

  function handleRowClick() {
    if (!pickerOpen) {
      setPickerOpen(true)
      setSelectedCategory(null)
      setMinutes('')
    }
  }

  function handleSelectCategory(cat) {
    setSelectedCategory(cat)
    setMinutes(String(Math.max(1, Math.round(elapsed / 60))))
  }

  function handleConfirm(e) {
    e.stopPropagation()
    if (!selectedCategory) return
    const secs = Math.round(parseFloat(minutes) * 60) || elapsed
    onConfirm(id, selectedCategory.name, secs)
  }

  function handleCancel(e) {
    e.stopPropagation()
    onCancel(id)
  }

  function handleClosePicker(e) {
    e.stopPropagation()
    setPickerOpen(false)
    setSelectedCategory(null)
    setMinutes('')
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
    fontFamily: '"Segoe UI", sans-serif',
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
  const chCats = categories.filter(c => c.team === 'CH' || c.team === 'BOTH')
  const mhCats = categories.filter(c => c.team === 'MH' || c.team === 'BOTH')

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

      {/* Category grid — 2 columns */}
      {categories.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
          {[...chCats, ...mhCats].map(cat => (
            <button
              key={cat.id}
              style={catBtn(cat.team, selectedCategory?.id === cat.id)}
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

      {/* Minutes input + confirm — shown after category selected */}
      {selectedCategory && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 10, color: C.textSec, fontFamily: '"Segoe UI", sans-serif' }}>
            {selectedCategory.name}
          </span>
          <input
            type="number"
            min="0"
            step="1"
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
            onClick={e => e.stopPropagation()}
            style={{
              width: 44,
              height: 22,
              borderRadius: 4,
              border: `1px solid ${C.border}`,
              background: 'rgba(255,255,255,0.07)',
              color: C.textPri,
              fontSize: 11,
              fontWeight: 700,
              textAlign: 'center',
              fontFamily: '"Segoe UI", sans-serif',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 10, color: C.textSec, fontFamily: '"Segoe UI", sans-serif' }}>
            min
          </span>
          <button style={actionBtn(C.process)} onClick={handleConfirm}>
            ✓ Log
          </button>
          <button
            style={actionBtn(C.textSec, true)}
            onClick={handleCancel}
          >
            × Cancel
          </button>
        </div>
      )}
    </div>
  )
}
