import { C, formatElapsed } from '../lib/constants.js';

export default function CasePill({ caseNumber, elapsed, focused, awaiting, onFocus, onPause, onResume, onClose }) {
  if (awaiting) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 10px', height: 32, borderRadius: 8,
        background: 'rgba(217,119,6,0.3)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(217,119,6,0.5)', cursor: 'pointer',
        fontSize: 12, fontWeight: 600, color: '#fff',
        fontFamily: '"Inter", system-ui, sans-serif',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(217,119,6,0.1)'
      }}>
        <span>⏸</span>
        <span>{caseNumber}</span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Awaiting</span>
        <button
          onClick={(e) => { e.stopPropagation(); onResume && onResume(); }}
          style={{
            background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 10,
            color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px',
            cursor: 'pointer', lineHeight: 1,
          }}
        >▶</button>
      </div>
    );
  }

  if (focused) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 10px', height: 32, borderRadius: 8,
        background: 'rgba(0,48,135,0.2)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,48,135,0.4)',
        fontSize: 12, fontWeight: 600, color: C.textPri,
        fontFamily: '"Inter", system-ui, sans-serif',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(0,48,135,0.2)'
      }}>
        <span style={{ color: C.activeDot, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>●</span>
        <span>{caseNumber}</span>
        <span style={{ color: C.textSec, fontVariantNumeric: 'tabular-nums' }}>
          {formatElapsed(elapsed)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onPause && onPause(); }}
          style={{
            background: 'none', border: 'none', color: C.textSec,
            fontSize: 12, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
          }}
          title="Pause / Awaiting"
        >⏸</button>
        <button
          onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}
          style={{
            background: 'none', border: 'none', color: C.textSec,
            fontSize: 12, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
          }}
          title="End session"
        >×</button>
      </div>
    );
  }

  // Unfocused
  return (
    <div
      onClick={() => onFocus && onFocus()}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 10px', height: 32, borderRadius: 8,
        background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)',
        fontSize: 12, fontWeight: 500, color: C.textSec,
        fontFamily: '"Inter", system-ui, sans-serif',
        cursor: 'pointer', flexShrink: 0,
        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = C.textPri; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = C.textSec; }}
    >
      <span style={{ color: C.activeDot }}>●</span>
      <span>{caseNumber}</span>
    </div>
  );
}
