const COLORS = {
  resolved: '#16a34a',
  reclass: '#dc2626',
  calls: '#0d9488',
  notACase: '#6b7280',
  processes: '#60a5fa',
  totalActivity: 'var(--color-mmark)',
};

const cellStyle = {
  padding: '8px 12px',
  textAlign: 'right',
  fontSize: 14,
};

const nameCellStyle = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 14,
  color: 'var(--text-pri)',
};

export default function AgentRow({ agent, stats }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={nameCellStyle}>{agent.full_name || agent.email}</td>
      <td style={{ ...cellStyle, color: COLORS.resolved, fontWeight: 600 }}>{stats.resolved ?? 0}</td>
      <td style={{ ...cellStyle, color: COLORS.reclass, fontWeight: 600 }}>{stats.reclass ?? 0}</td>
      <td style={{ ...cellStyle, color: COLORS.calls, fontWeight: 600 }}>{stats.calls ?? 0}</td>
      <td style={{ ...cellStyle, color: COLORS.processes, fontWeight: 600 }}>{stats.processes ?? 0}</td>
      <td style={{ ...cellStyle, color: COLORS.totalActivity, fontWeight: 600 }}>{stats.totalActivity ?? 0}</td>
    </tr>
  );
}
