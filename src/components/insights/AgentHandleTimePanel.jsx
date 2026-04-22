import { useState } from 'react';
import AgentRow from './AgentRow';

// TODO: Real handle time needs session-level duration data from bar_sessions.
// Current calculation uses a fixed 8h/active-day assumption as a placeholder.
const ASSUMED_HOURS_PER_ACTIVE_DAY = 8;

const cardStyle = {
  background: 'var(--bg-card)',
  borderRadius: 16,
  padding: 20,
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--border)',
};

const titleStyle = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-sec)',
  marginBottom: 14,
};

const thStyle = {
  padding: '6px 12px',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-sec)',
  textAlign: 'right',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};

const thNameStyle = {
  ...thStyle,
  textAlign: 'left',
};

const casesPerHourStyle = {
  padding: '8px 12px',
  textAlign: 'right',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-pri)',
};

function computeCasesPerHour(stats, activeDays) {
  const handled = (stats.resolved ?? 0) + (stats.reclass ?? 0);
  const hours = activeDays * ASSUMED_HOURS_PER_ACTIVE_DAY;
  if (hours === 0) return 0;
  return handled / hours;
}

function inferActiveDays(stats) {
  // Rough proxy: assume 1 active day per 5 total activities, minimum 1 if any activity exists
  const total = stats.totalActivity ?? 0;
  if (total === 0) return 0;
  return Math.max(1, Math.round(total / 5));
}

export default function AgentHandleTimePanel({ perAgentStats, onAgentClick }) {
  const [sortKey, setSortKey] = useState('casesPerHour');
  const [sortDir, setSortDir] = useState('desc');

  const rows = perAgentStats ? Object.entries(perAgentStats) : [];

  const enriched = rows.map(([agentId, entry]) => {
    const { agent, stats } = entry;
    const activeDays = inferActiveDays(stats);
    const casesPerHour = computeCasesPerHour(stats, activeDays);
    return { agentId, agent, stats, casesPerHour };
  });

  const sorted = [...enriched].sort((a, b) => {
    let aVal, bVal;
    if (sortKey === 'casesPerHour') {
      aVal = a.casesPerHour;
      bVal = b.casesPerHour;
    } else if (sortKey === 'name') {
      aVal = (a.agent?.full_name || a.agent?.email || '').toLowerCase();
      bVal = (b.agent?.full_name || b.agent?.email || '').toLowerCase();
    } else {
      aVal = a.stats[sortKey] ?? 0;
      bVal = b.stats[sortKey] ?? 0;
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function sortIndicator(key) {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Agent Handle Time</div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-sec)' }}>No agent data for this period.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thNameStyle} onClick={() => handleSort('name')}>Agent{sortIndicator('name')}</th>
                <th style={thStyle} onClick={() => handleSort('resolved')}>Resolved{sortIndicator('resolved')}</th>
                <th style={thStyle} onClick={() => handleSort('reclass')}>Reclass{sortIndicator('reclass')}</th>
                <th style={thStyle} onClick={() => handleSort('calls')}>Calls{sortIndicator('calls')}</th>
                <th style={thStyle} onClick={() => handleSort('processes')}>Procs{sortIndicator('processes')}</th>
                <th style={thStyle} onClick={() => handleSort('totalActivity')}>Total{sortIndicator('totalActivity')}</th>
                <th style={thStyle} onClick={() => handleSort('casesPerHour')}>Cases/hr{sortIndicator('casesPerHour')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ agentId, agent, stats, casesPerHour }) => (
                <tr key={agentId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', textAlign: 'left', fontSize: 14, color: 'var(--text-pri)' }}>
                    {onAgentClick ? (
                      <button
                        onClick={() => onAgentClick(agentId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          font: 'inherit',
                          fontSize: 14,
                          color: 'var(--text-pri)',
                          cursor: 'pointer',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-mmark)'; e.currentTarget.style.textDecoration = 'underline'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-pri)'; e.currentTarget.style.textDecoration = 'none'; }}
                      >
                        {agent?.full_name || agent?.email || agentId}
                      </button>
                    ) : (
                      agent?.full_name || agent?.email || agentId
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#16a34a' }}>{stats.resolved ?? 0}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#dc2626' }}>{stats.reclass ?? 0}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#0d9488' }}>{stats.calls ?? 0}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#60a5fa' }}>{stats.processes ?? 0}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: 'var(--color-mmark)' }}>{stats.totalActivity ?? 0}</td>
                  <td style={casesPerHourStyle}>{casesPerHour > 0 ? casesPerHour.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-sec)', fontStyle: 'italic' }}>
        Cases/hr = (Resolved + Reclassified) ÷ estimated active hours (provisional)
      </div>
    </div>
  );
}
