import { C, formatElapsed } from '../lib/constants.js';

export default function ProcessPill({ elapsed, onLog, onClose }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '0 8px', height: 26, borderRadius: 13,
      background: 'rgba(96,165,250,0.15)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(96,165,250,0.3)',
      fontSize: 11, fontWeight: 600, color: C.process,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 10 }}>⏱</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatElapsed(elapsed)}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onLog && onLog(); }}
        style={{
          background: 'rgba(96,165,250,0.2)', border: 'none', borderRadius: 8,
          color: C.process, fontSize: 10, fontWeight: 700,
          padding: '1px 6px', cursor: 'pointer', lineHeight: 1,
        }}
      >Log</button>
      <button
        onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}
        style={{
          background: 'none', border: 'none', color: 'rgba(96,165,250,0.6)',
          fontSize: 12, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
        }}
        title="Cancel"
      >×</button>
    </div>
  );
}
