import { useState } from 'react';

function chipLabel(agent) {
  if (!agent.full_name) return agent.email || agent.id;
  const parts = agent.full_name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function Chip({ label, title, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  const base = {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 16,
    fontSize: 13,
    cursor: 'pointer',
    border: 'none',
    transition: 'background 0.15s, color 0.15s',
    marginRight: 6,
    marginBottom: 6,
  };
  const activeStyle = {
    background: '#E8540A',
    color: '#fff',
  };
  const inactiveStyle = {
    background: hovered ? 'rgba(232,84,10,0.15)' : 'rgba(255,255,255,0.08)',
    color: hovered ? '#E8540A' : 'var(--text-sec)',
  };
  return (
    <button
      style={{ ...base, ...(active ? activeStyle : inactiveStyle) }}
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
    </button>
  );
}

export default function AgentFilterStrip({ agents, selectedAgentId, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
      <Chip
        label="All agents"
        title="Show all agents"
        active={selectedAgentId === null}
        onClick={() => onChange(null)}
      />
      {(agents || []).map(agent => (
        <Chip
          key={agent.id}
          label={chipLabel(agent)}
          title={agent.full_name || agent.email || agent.id}
          active={selectedAgentId === agent.id}
          onClick={() => onChange(agent.id)}
        />
      ))}
    </div>
  );
}
