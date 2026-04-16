import { useEffect, useRef } from 'react';

/**
 * CasePillPopover — tiny floating popover anchored above a focused CT pill.
 * Shows secondary actions: Awaiting Info and Not a Case.
 *
 * Props:
 *   onAwaiting  — () => void
 *   onNotACase  — () => void
 *   onClose     — () => void — dismiss without action
 */
export default function CasePillPopover({ onAwaiting, onNotACase, onClose }) {
  const ref = useRef(null);

  // Click-outside dismissal — attaches to the PiP window's document
  useEffect(() => {
    function handleMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose && onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 6px)',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        padding: '6px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        zIndex: 1000,
        whiteSpace: 'nowrap',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onAwaiting && onAwaiting(); onClose && onClose(); }}
        style={{
          height: 28,
          padding: '0 10px',
          borderRadius: 14,
          background: 'rgba(245,158,11,0.15)',
          border: '1px solid rgba(245,158,11,0.3)',
          color: '#f59e0b',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: '"Inter", system-ui, sans-serif',
        }}
      >
        <span>⏸</span>
        <span>Awaiting</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onNotACase && onNotACase(); onClose && onClose(); }}
        style={{
          height: 28,
          padding: '0 10px',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid var(--border)',
          color: 'var(--text-sec)',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: '"Inter", system-ui, sans-serif',
        }}
      >
        <span>⊘</span>
        <span>Not a Case</span>
      </button>
    </div>
  );
}
