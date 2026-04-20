import { formatElapsed } from '../lib/constants.js'

export default function RecoveryPrompt({ recoveredProcesses = [], onResume, onLogNow, onDiscard, categories = [] }) {
  const n = recoveredProcesses.length
  const label = n === 1 ? 'process' : 'processes'

  function getCategoryName(categoryId) {
    if (!categoryId) return 'Uncategorized'
    const cat = categories.find(c => c.id === categoryId)
    return cat ? cat.name : 'Uncategorized'
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#0f1117',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      zIndex: 100,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,48,135,0.4)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#E8540A', letterSpacing: '0.06em', marginBottom: 2 }}>
          MERIDIAN CLOSED UNEXPECTEDLY
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
          You had {n} active {label}.
        </div>
      </div>

      {/* Process list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', minHeight: 0 }}>
        {recoveredProcesses.map(p => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 0',
            fontSize: 11, color: 'rgba(255,255,255,0.85)',
          }}>
            <span style={{ color: '#60a5fa', flexShrink: 0 }}>•</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getCategoryName(p.categoryId)}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {formatElapsed(p.elapsed ?? p.accumulated_seconds ?? 0)}
            </span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex', gap: 6, padding: '8px 14px 10px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => onResume && onResume()}
          style={{
            flex: 1, height: 28, borderRadius: 14,
            background: '#003087', border: '1px solid rgba(0,80,200,0.5)',
            color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            fontFamily: '"Segoe UI", system-ui, sans-serif',
          }}
        >
          Resume
        </button>
        <button
          onClick={() => onLogNow && onLogNow()}
          style={{
            flex: 1, height: 28, borderRadius: 14,
            background: 'rgba(232,84,10,0.15)', border: '1px solid rgba(232,84,10,0.4)',
            color: '#E8540A', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            fontFamily: '"Segoe UI", system-ui, sans-serif',
          }}
        >
          Log now
        </button>
        <button
          onClick={() => onDiscard && onDiscard()}
          style={{
            flex: 1, height: 28, borderRadius: 14,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            fontFamily: '"Segoe UI", system-ui, sans-serif',
          }}
        >
          Discard
        </button>
      </div>
    </div>
  )
}
