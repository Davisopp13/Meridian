import { useState } from 'react';

export default function DashboardStatCard({ label, value, color, icon, active, onClick }) {
  const [hovered, setHovered] = useState(false);

  const cardStyle = {
    minWidth: 150,
    flex: 1,
    height: 130,
    borderRadius: 12,
    background: color,
    padding: 16,
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
    boxShadow: active ? 'inset 0 0 0 3px rgba(255,255,255,0.5)' : 'none',
    filter: hovered ? 'brightness(1.08)' : 'brightness(1)',
    transition: 'filter 150ms, box-shadow 150ms',
  };

  const topRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 4,
  };

  const labelStyle = {
    color: '#fff',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    lineHeight: 1.3,
    flex: 1,
    wordBreak: 'break-word',
  };

  const iconStyle = {
    fontSize: 18,
    flexShrink: 0,
    lineHeight: 1,
  };

  const valueStyle = {
    color: '#fff',
    fontSize: 42,
    fontWeight: 800,
    lineHeight: 1,
  };

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={topRowStyle}>
        <span style={labelStyle}>{label}</span>
        <span style={iconStyle}>{icon}</span>
      </div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}
