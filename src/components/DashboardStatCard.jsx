import { useState } from 'react';

export default function DashboardStatCard({ label, value, color, icon, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isActive = active || hovered;

  const cardStyle = {
    minWidth: 150,
    flex: 1,
    height: 130,
    borderRadius: 16,
    background: color,
    opacity: isActive ? 1 : 0.9,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `2px solid ${isActive ? 'rgba(255,255,255,0.6)' : 'transparent'}`,
    padding: 16,
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
    boxShadow: `0 8px 16px ${color}40`,
    transform: pressed ? 'scale(0.97)' : hovered ? 'scale(1.02) translateY(-2px)' : 'scale(1)',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
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
    transition: 'color 0.2s',
  };

  const iconStyle = {
    fontSize: 18,
    flexShrink: 0,
    lineHeight: 1,
    color: '#fff',
    transition: 'color 0.2s',
  };

  const valueStyle = {
    color: '#fff',
    fontSize: 42,
    fontWeight: 800,
    lineHeight: 1,
    transition: 'color 0.2s',
  };

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      <div style={topRowStyle}>
        <span style={labelStyle}>{label}</span>
        <span style={iconStyle}>{icon}</span>
      </div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}
