import { useState } from 'react';

/**
 * DashboardStatCard — calm metric tile with subtle colored tint + 3px accent bar.
 * The tint uses the same `color` prop as the accent bar, at low opacity,
 * so the card retains categorical color signal while being visually quieter
 * than a saturated fill. `icon` prop is accepted but ignored (backward compat).
 */
export default function DashboardStatCard({ label, value, color, active, onClick }) {
  const [hovered, setHovered] = useState(false);

  const isActive = active || hovered;

  const tint = buildTint(color, 0.08);
  const tintHover = buildTint(color, 0.12);
  const borderColor = buildTint(color, isActive ? 0.32 : 0.2);

  const cardStyle = {
    minWidth: 150,
    flex: 1,
    height: 90,
    borderRadius: 10,
    background: hovered ? tintHover : tint,
    border: `1px solid ${borderColor}`,
    padding: '14px 16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxSizing: 'border-box',
    transition: 'background var(--motion-fast), border-color var(--motion-fast)',
  };

  const accentStyle = {
    width: 3,
    height: 32,
    borderRadius: 1.5,
    background: color,
    flexShrink: 0,
  };

  const metaStyle = {
    flex: 1,
    minWidth: 0,
  };

  const labelStyle = {
    fontSize: 10.5,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--text-sec)',
    marginBottom: 3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const valueStyle = {
    fontSize: 22,
    fontWeight: 500,
    letterSpacing: '-0.02em',
    color: 'var(--text-pri)',
    lineHeight: 1,
  };

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={accentStyle} />
      <div style={metaStyle}>
        <div style={labelStyle}>{label}</div>
        <div style={valueStyle}>{value}</div>
      </div>
    </div>
  );
}

/**
 * Parse a hex color string and return an rgba() at the given alpha.
 * - '#abc' (shorthand) and '#aabbcc' (full) are supported.
 * - var() tokens or any unparsable string fall back to a neutral white tint.
 */
function buildTint(color, alpha) {
  if (typeof color !== 'string') return `rgba(255, 255, 255, ${alpha})`;

  const hex = color.trim();
  const match = hex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return `rgba(255, 255, 255, ${alpha})`;

  let r, g, b;
  if (match[1].length === 3) {
    r = parseInt(match[1][0] + match[1][0], 16);
    g = parseInt(match[1][1] + match[1][1], 16);
    b = parseInt(match[1][2] + match[1][2], 16);
  } else {
    r = parseInt(match[1].slice(0, 2), 16);
    g = parseInt(match[1].slice(2, 4), 16);
    b = parseInt(match[1].slice(4, 6), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
