import { C, formatElapsed } from '../lib/constants.js';
import CasePillPopover from './CasePillPopover.jsx';

export default function CasePill({
  caseNumber, elapsed, focused, awaiting,
  onFocus, onPause, onResume, onClose,
  onPopoverOpen, popoverOpen, onAwaiting, onNotACase,
}) {
  if (awaiting) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 10px', height: 32, borderRadius: 8,
        background: 'rgba(245,158,11,0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer',
        fontSize: 12, fontWeight: 600, color: '#fff',
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
      <div
        onClick={() => onPopoverOpen && onPopoverOpen()}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 10px', height: 32, borderRadius: 8,
          background: 'rgba(232,84,10,0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(232,84,10,0.3)',
          fontSize: 12, fontWeight: 600, color: C.textPri,
          flexShrink: 0, cursor: 'pointer',
        }}
      >
        <span style={{ color: C.activeDot, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>●</span>
        <span>{caseNumber}</span>
        <span style={{ color: C.textSec, fontVariantNumeric: 'tabular-nums' }}>
          {formatElapsed(elapsed)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}
          style={{
            background: 'none', border: 'none', color: C.textSec,
            fontSize: 12, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
          }}
          title="End session"
        >×</button>

        {/* Popover: anchored above this pill */}
        {popoverOpen && (
          <CasePillPopover
            onAwaiting={onAwaiting}
            onNotACase={onNotACase}
            onClose={onPopoverOpen}
          />
        )}
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
        background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid var(--border)',
        fontSize: 12, fontWeight: 500, color: C.textSec,
        cursor: 'pointer', flexShrink: 0,
        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = C.textPri; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = C.textSec; }}
    >
      <span style={{ color: C.activeDot }}>●</span>
      <span>{caseNumber}</span>
    </div>
  );
}
