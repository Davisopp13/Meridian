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
    width: 24,
    height: 24,
    background: hovered ? 'rgba(255,255,255,0.1)' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    color: hovered ? C.textPri : C.textSec,
    fontSize: 14,
    fontWeight: 700,
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    borderRadius: 6,
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
