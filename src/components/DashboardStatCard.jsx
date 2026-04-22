import { useState } from 'react';

/**
 * DashboardStatCard — calm metric tile with 3px accent bar.
 * `icon` prop is accepted but ignored (kept for backward compat).
 */
export default function DashboardStatCard({ label, value, color, active, onClick }) {
  const [hovered, setHovered] = useState(false);

  const isActive = active || hovered;

  const cardStyle = {
    minWidth: 150,
    flex: 1,
    height: 90,
    borderRadius: 10,
    background: 'var(--bg-card)',
    border: `1px solid ${isActive ? 'var(--border)' : 'var(--divider)'}`,
    padding: '14px 16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxSizing: 'border-box',
    transition: 'border-color var(--motion-fast)',
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
    color: 'var(--text-dim)',
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
