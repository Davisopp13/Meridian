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
    width: 32,
    height: 32,
    background: C.mBtn,
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    transform: pressed ? 'scale(0.92)' : hovered ? 'scale(1.06)' : 'scale(1)',
    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxShadow: hovered ? '0 4px 12px rgba(0,48,135,0.4)' : 'none',
  };

  const markStyle = {
    color: C.mMark,
    fontSize: 15,
    fontWeight: 900,
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    lineHeight: 1,
    userSelect: 'none',
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
      <span style={markStyle}>M°</span>
    </button>
  );
}
