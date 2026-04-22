const SEGMENT_COLORS = {
  resolved: '#16a34a',
  reclass: '#dc2626',
  calls: '#0d9488',
  notACase: '#6b7280',
};

const SEGMENT_KEYS = ['resolved', 'reclass', 'calls', 'notACase'];
const SEGMENT_LABELS = { resolved: 'Resolved', reclass: 'Reclassified', calls: 'Calls', notACase: 'Not a Case' };

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
  marginBottom: 4,
};

const totalStyle = {
  fontSize: 36,
  fontWeight: 800,
  color: 'var(--text-pri)',
  lineHeight: 1,
  marginBottom: 16,
};

const agentNameStyle = {
  fontSize: 13,
  color: 'var(--text-sec)',
  width: 120,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const agentCountStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-pri)',
  width: 32,
  textAlign: 'right',
  flexShrink: 0,
};

function StackedBar({ stats, maxCases }) {
  const total = SEGMENT_KEYS.reduce((s, k) => s + (stats[k] ?? 0), 0);
  if (maxCases === 0) return <svg width="100%" height={16} />;

  const pct = (v) => (v / maxCases) * 100;
  let offset = 0;
  const rects = SEGMENT_KEYS.map((k) => {
    const val = stats[k] ?? 0;
    const width = pct(val);
    const rect = (
      <rect
        key={k}
        x={`${offset}%`}
        y={0}
        width={`${width}%`}
        height={16}
        fill={SEGMENT_COLORS[k]}
        rx={k === 'resolved' ? 4 : 0}
        style={{ rx: k === 'notACase' && offset + width >= 99.5 ? 4 : undefined }}
      />
    );
    offset += width;
    return rect;
  });

  return (
    <svg width="100%" height={16} style={{ borderRadius: 4, overflow: 'hidden', display: 'block' }}>
      {rects}
    </svg>
  );
}

export default function TeamCaseVolumePanel({ perAgentStats, teamTotals }) {
  const totalCases = teamTotals
    ? SEGMENT_KEYS.reduce((s, k) => s + (teamTotals[k] ?? 0), 0)
    : 0;

  const agents = perAgentStats ? Object.entries(perAgentStats) : [];
  const maxCases = agents.reduce((m, [, s]) => {
    const t = SEGMENT_KEYS.reduce((sum, k) => sum + (s[k] ?? 0), 0);
    return Math.max(m, t);
  }, 0);

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Team Case Volume</div>
      <div style={totalStyle}>{totalCases}</div>

      {agents.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-sec)' }}>No agent data for this period.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {agents.map(([agentId, entry]) => {
            const { agent, stats } = entry;
            const agentTotal = SEGMENT_KEYS.reduce((s, k) => s + (stats[k] ?? 0), 0);
            return (
              <div key={agentId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={agentNameStyle}>{agent?.full_name || agent?.email || agentId}</span>
                <div style={{ flex: 1 }}>
                  <StackedBar stats={stats} maxCases={maxCases} />
                </div>
                <span style={agentCountStyle}>{agentTotal}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        {SEGMENT_KEYS.map((k) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: SEGMENT_COLORS[k], flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>{SEGMENT_LABELS[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/*
// Mock data smoke test (uncomment to verify in isolation):
// const mockPerAgentStats = {
//   'user-1': { agent: { full_name: 'Alice Smith' }, stats: { resolved: 12, reclass: 3, calls: 5, notACase: 1 } },
//   'user-2': { agent: { full_name: 'Bob Jones' }, stats: { resolved: 8, reclass: 1, calls: 9, notACase: 2 } },
// };
// const mockTeamTotals = { resolved: 20, reclass: 4, calls: 14, notACase: 3 };
// <TeamCaseVolumePanel perAgentStats={mockPerAgentStats} teamTotals={mockTeamTotals} />
*/
