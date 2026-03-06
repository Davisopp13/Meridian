import { useState } from 'react'
import { C } from '../lib/constants.js'

/**
 * CategoryDrillDown — screen-swap category/subcategory navigation.
 * Height never expands: category screen is fully replaced by subcategory screen.
 *
 * Props:
 *   categories  — [{ id, name, team, mpl_subcategories: [{ id, name }] }]
 *   onSelect    — (cat, sub|null) called when selection is complete
 *   headerSlot  — optional JSX rendered above the list (e.g. duration picker in manual mode)
 */
export default function CategoryDrillDown({ categories = [], onSelect, onScreenChange, headerSlot }) {
  const [screen, setScreen] = useState('category') // 'category' | 'subcategory'
  const [activeCat, setActiveCat] = useState(null)

  const tint = categories[0]?.team === 'CH' ? 'rgba(251,191,36,1)' : 'rgba(96,165,250,1)'
  const tintColor = categories[0]?.team === 'CH' ? C.awaiting : C.process

  function handleSelectCat(cat) {
    const subs = cat.mpl_subcategories || []
    if (subs.length === 0) {
      onSelect(cat, null)
    } else if (subs.length === 1) {
      onSelect(cat, subs[0])
    } else {
      onScreenChange?.('subcategory')
      setActiveCat(cat)
      setScreen('subcategory')
    }
  }

  function handleBack() {
    onScreenChange?.('category')
    setScreen('category')
    setActiveCat(null)
  }

  function itemBtn(item, onClick) {
    return (
      <button
        key={item.id}
        onClick={() => onClick(item)}
        style={{
          width: '100%', textAlign: 'left', padding: '5px 8px',
          marginBottom: 3, borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.15)',
          cursor: 'pointer', fontSize: 11, fontWeight: 500,
          background: '#2a2d3e',
          color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {item.name}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {headerSlot}

      {/* Screen title + back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {screen === 'subcategory' && (
          <button
            onClick={handleBack}
            style={{
              background: 'none', border: 'none', color: tintColor,
              fontSize: 11, cursor: 'pointer', padding: 0, fontWeight: 600, lineHeight: 1,
            }}
          >
            ←
          </button>
        )}
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: tintColor }}>
          {screen === 'category' ? 'CATEGORY' : activeCat?.name?.toUpperCase()}
        </span>
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {screen === 'category'
          ? categories.map(cat => itemBtn(cat, handleSelectCat))
          : (activeCat?.mpl_subcategories || []).map(sub =>
              itemBtn(sub, s => onSelect(activeCat, s))
            )
        }
      </div>
    </div>
  )
}
