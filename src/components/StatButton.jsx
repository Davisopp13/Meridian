import { useState } from 'react';
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
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const style = {
    height: 28,
    minWidth: 88,
    padding: '0 10px',
    borderRadius: 14,
    border: 'none',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? 'rgba(255,255,255,0.07)' : color,
    color: disabled ? C.textSec : C.textPri,
    opacity: disabled ? 0.5 : 1,
    flexShrink: 0,
    transform: pressed && !disabled ? 'scale(0.95)' : hovered && !disabled ? 'scale(1.04)' : 'scale(1)',
    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxShadow: hovered && !disabled && active ? `0 4px 12px ${color}60` : 'none',
  };

  return (
    <button
      style={style}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      title={label}
    >
      {label}
    </button>
  );
}
