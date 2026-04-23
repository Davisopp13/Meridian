import { C } from '../lib/constants.js'

/**
 * RecentPairsStrip — horizontal chip strip showing recent (category, subcategory) pairs.
 * Rendered above the category grid via CategoryDrillDown's headerSlot.
 *
 * Props:
 *   pairs       — [{ categoryId, subcategoryId }] (deduped, newest-first)
 *   categories  — same shape CategoryDrillDown receives; used to resolve names
 *   onPick      — (cat, sub|null) called when a chip is tapped
 *   disabled    — boolean; hides the strip when true (e.g. subcategory screen)
 */
export default function RecentPairsStrip({ pairs = [], categories = [], onPick, disabled = false }) {
  if (disabled || pairs.length === 0) return null

  const resolved = pairs.map(pair => {
    const cat = categories.find(c => c.id === pair.categoryId)
    if (!cat) return null
    const sub = pair.subcategoryId
      ? (cat.mpl_subcategories || []).find(s => s.id === pair.subcategoryId)
      : null
    if (pair.subcategoryId && !sub) return null
    return { cat, sub }
  }).filter(Boolean)

  if (resolved.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      gap: 4,
      overflowX: 'auto',
      paddingBottom: 4,
      marginBottom: 6,
      borderBottom: `1px solid ${C.divider}`,
    }}>
      <span style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: C.textSec,
        alignSelf: 'center',
        paddingRight: 4,
        flexShrink: 0,
      }}>
        RECENT
      </span>
      {resolved.map(({ cat, sub }) => {
        const dotColor = cat.team === 'CH' ? '#fbbf24' : '#60a5fa'
        return (
          <button
            key={`${cat.id}-${sub?.id ?? 'none'}`}
            onClick={() => onPick(cat, sub)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: 'var(--card-bg-subtle)',
              color: C.textPri,
              fontSize: 10.5,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: dotColor, display: 'inline-block',
            }} />
            <span>{cat.name}{sub ? ` › ${sub.name}` : ''}</span>
          </button>
        )
      })}
    </div>
  )
}
