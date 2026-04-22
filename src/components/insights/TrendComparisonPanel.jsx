import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

const PERIOD_LABELS = {
  this_week: ['This Week', 'Last Week'],
  last_week: ['Last Week', 'Week Before'],
  this_month: ['This Month', 'Last Month'],
  last_month: ['Last Month', 'Month Before'],
  ytd: ['Year to Date', 'Prior Year'],
};

function sumTotalActivity(perAgentStats) {
  if (!perAgentStats) return 0;
  return Object.values(perAgentStats).reduce((sum, entry) => sum + (entry?.stats?.totalActivity ?? 0), 0);
}

function formatPct(current, previous) {
  if (previous === 0) return '—';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export default function TrendComparisonPanel({ period, perAgentStats, previousPerAgentStats }) {
  const current = sumTotalActivity(perAgentStats);
  const previous = sumTotalActivity(previousPerAgentStats);
  const pctChange = formatPct(current, previous);
  const isPositive = previous > 0 && current >= previous;
  const isNegative = previous > 0 && current < previous;

  const [currentLabel, previousLabel] = PERIOD_LABELS[period] ?? ['Current', 'Previous'];

  const chartData = [
    { name: previousLabel, value: previous },
    { name: currentLabel, value: current },
  ];

  const pctColor = isPositive ? '#4ade80' : isNegative ? '#f87171' : 'var(--text-sec)';

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Trend Comparison</div>

      <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 2 }}>{currentLabel}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-pri)' }}>{current}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 2 }}>{previousLabel}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-sec)' }}>{previous}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 2 }}>Change</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: pctColor }}>{pctChange}</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={chartData} barSize={40} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-sec)' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            <Cell fill="#6b7280" />
            <Cell fill="#60a5fa" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/*
// Mock data smoke test (uncomment to verify in isolation):
// const mockCurrent = { 'u1': { stats: { totalActivity: 42 } }, 'u2': { stats: { totalActivity: 31 } } };
// const mockPrev = { 'u1': { stats: { totalActivity: 38 } }, 'u2': { stats: { totalActivity: 27 } } };
// <TrendComparisonPanel period="this_week" perAgentStats={mockCurrent} previousPerAgentStats={mockPrev} />
*/
