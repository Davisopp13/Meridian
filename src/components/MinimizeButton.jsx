import { C } from '../lib/constants.js';

/**
 * MinimizeButton — `—` 24×24 transparent button.
 * Click: collapses bar to restore strip `▲ Meridian`.
 * Props:
 *   onClick  fn
 */
export default function MinimizeButton({ onClick }) {
  const style = {
    width: 24,
    height: 24,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    color: C.textSec,
    fontSize: 14,
    fontWeight: 700,
    fontFamily: '"Segoe UI", sans-serif',
    borderRadius: 4,
    transition: 'color 120ms',
  };

  return (
    <button style={style} onClick={onClick} title="Minimize">
      —
    </button>
  );
}
