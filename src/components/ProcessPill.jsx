import { C, formatElapsed } from '../lib/constants.js';

export default function ProcessPill({ elapsed, onLog, onClose }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 10px', height: 32, borderRadius: 8,
      background: 'rgba(96,165,250,0.15)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(96,165,250,0.3)',
      fontSize: 12, fontWeight: 600, color: C.process,
      boxShadow: '0 4px 12px rgba(96,165,250,0.1)',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11 }}>⏱</span>
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
