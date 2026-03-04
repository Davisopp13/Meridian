import { C } from '../lib/constants.js';

/**
 * StatButton — one of the 4 stat/action buttons in the bar.
 * Props:
 *   label     string   — display label (e.g. "✓ 3 Resolved")
 *   color     string   — background color (from C tokens)
 *   onClick   fn
 *   disabled  bool     — when no focused case
 *   active    bool     — process button when active
 */
export default function StatButton({ label, color, onClick, disabled = false, active = false }) {
  const style = {
    height: 28,
    minWidth: 88,
    padding: '0 10px',
    borderRadius: 14,
    border: 'none',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: '"Segoe UI", sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    transition: 'all 120ms',
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? 'rgba(255,255,255,0.07)' : color,
    color: disabled ? C.textSec : C.textPri,
    opacity: disabled ? 0.5 : 1,
    flexShrink: 0,
  };

  return (
    <button style={style} onClick={disabled ? undefined : onClick} disabled={disabled}>
      {label}
    </button>
  );
}
