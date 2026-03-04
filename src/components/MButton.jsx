import { C } from '../lib/constants.js';

/**
 * MButton — 32×32 navy square with orange M° mark.
 * Click: opens/focuses PWA dashboard tab.
 * Props:
 *   onClick  fn
 */
export default function MButton({ onClick }) {
  const style = {
    width: 32,
    height: 32,
    background: C.mBtn,
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    transition: 'opacity 120ms',
  };

  const markStyle = {
    color: C.mMark,
    fontSize: 15,
    fontWeight: 900,
    fontFamily: '"Segoe UI", sans-serif',
    lineHeight: 1,
    userSelect: 'none',
  };

  return (
    <button style={style} onClick={onClick} title="Open Meridian dashboard">
      <span style={markStyle}>M°</span>
    </button>
  );
}
