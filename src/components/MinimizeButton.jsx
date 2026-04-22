import { useState } from 'react';
import { C } from '../lib/constants.js';

/**
 * MinimizeButton — `—` 24×24 transparent button.
 * Click: collapses bar to restore strip `▲ Meridian`.
 * Props:
 *   onClick  fn
 */
export default function MinimizeButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const style = {
    width: 28,
    height: 28,
    background: hovered ? 'rgba(0,0,0,0.05)' : 'transparent',
    backdropFilter: hovered ? 'blur(8px)' : 'none',
    WebkitBackdropFilter: hovered ? 'blur(8px)' : 'none',
    border: hovered ? '1px solid rgba(0,0,0,0.05)' : '1px solid transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    color: hovered ? C.textPri : C.textSec,
    fontSize: 14,
    fontWeight: 700,
    borderRadius: 8,
    transform: pressed ? 'scale(0.9)' : hovered ? 'scale(1.1)' : 'scale(1)',
    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  return (
    <button
      style={style}
      onClick={onClick}
      title="Minimize"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      —
    </button>
  );
}
