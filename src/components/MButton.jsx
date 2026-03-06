import { useState } from 'react';
import { C } from '../lib/constants.js';

/**
 * MButton — 32×32 navy square with orange M° mark.
 * Click: opens/focuses PWA dashboard tab.
 * Props:
 *   onClick  fn
 */
export default function MButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const style = {
    width: 36,
    height: 36,
    background: 'transparent',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 2,
    transform: pressed ? 'scale(0.92)' : hovered ? 'scale(1.06)' : 'scale(1)',
    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxShadow: 'none',
  };

  return (
    <button
      style={style}
      onClick={onClick}
      title="Open Meridian dashboard"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      <img
        src="/meridian-mark-512.png"
        alt="Meridian Logo"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        draggable={false}
      />
    </button>
  );
}
