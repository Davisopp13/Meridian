import { C, formatElapsed } from '../lib/constants.js';

export default function CasePill({ caseNumber, elapsed, focused, awaiting, onFocus, onPause, onResume, onClose }) {
  if (awaiting) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '0 8px', height: 26, borderRadius: 13,
        background: 'rgba(217,119,6,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', cursor: 'pointer',
        fontSize: 11, fontWeight: 600, color: '#fff',
        flexShrink: 0,
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
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '0 8px', height: 26, borderRadius: 13,
        background: 'rgba(0,48,135,0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid #003087',
        fontSize: 11, fontWeight: 600, color: C.textPri,
        flexShrink: 0,
      }}>
        <span style={{ color: C.activeDot }}>●</span>
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
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '0 8px', height: 26, borderRadius: 13,
        background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid transparent',
        fontSize: 11, fontWeight: 600, color: C.textSec,
        cursor: 'pointer', flexShrink: 0,
        transition: 'all 150ms',
      }}
    >
      <span style={{ color: C.activeDot }}>●</span>
      <span>{caseNumber}</span>
    </div>
  );
}
