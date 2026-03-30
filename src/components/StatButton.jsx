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
export default function StatButton({ icon, label, color, onClick, disabled = false, active = false }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const style = {
    height: 32,
    minWidth: 88,
    padding: '0 12px',
    borderRadius: 8,
    border: 'none',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: '"Inter", system-ui, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: color, // Always display the assigned vibrant hue
    color: '#ffffff', // pure white text
    opacity: disabled ? 0.85 : 1,
    flexShrink: 0,
    transform: pressed && !disabled ? 'scale(0.95)' : hovered && !disabled ? 'scale(1.04)' : 'scale(1)',
    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxShadow: hovered && !disabled
      ? '0 4px 12px rgba(0,0,0,0.15)'
      : 'none',
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
      {icon && icon}
      <span>{label}</span>
    </button>
  );
}
