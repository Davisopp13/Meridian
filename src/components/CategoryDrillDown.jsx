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
export default function CategoryDrillDown({
  categories = [],
  onSelect,
  onScreenChange,
  headerSlot,
  contentPadding = '0px',
}) {
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
          width: '100%',
          textAlign: 'left',
          padding: '11px 12px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
          background: 'var(--card-bg-subtle)',
          color: 'var(--text-pri)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          boxShadow: 'var(--shadow-subtle)',
        }}
      >
        {item.name}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {headerSlot}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: contentPadding,
        paddingRight: contentPadding,
        paddingTop: 12,
        paddingBottom: 10,
        flexShrink: 0,
      }}>
        {screen === 'subcategory' ? (
          <button
            onClick={handleBack}
            style={{
              background: 'var(--card-bg-subtle)',
              border: '1px solid var(--border)',
              color: tintColor,
              fontSize: 11,
              cursor: 'pointer',
              padding: '4px 8px',
              fontWeight: 700,
              lineHeight: 1,
              borderRadius: 999,
              flexShrink: 0,
            }}
          >
            Back
          </button>
        ) : null}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: tintColor }}>
            {screen === 'category' ? 'CATEGORY' : 'SUBCATEGORY'}
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-pri)',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {screen === 'category' ? 'Choose the process type' : activeCat?.name}
          </div>
        </div>
      </div>

      <div style={{
        overflowY: 'auto',
        flex: 1,
        minHeight: 0,
        maxHeight: '100%',
        paddingLeft: contentPadding,
        paddingRight: contentPadding,
        paddingBottom: 12,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {screen === 'category'
            ? categories.map(cat => itemBtn(cat, handleSelectCat))
            : (activeCat?.mpl_subcategories || []).map(sub =>
                itemBtn(sub, s => onSelect(activeCat, s))
              )
          }
        </div>
      </div>
    </div>
  )
}
