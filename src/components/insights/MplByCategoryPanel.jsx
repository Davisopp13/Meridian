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
  color: 'var(--text-secondary)',
  marginBottom: 14,
};

const labelStyle = {
  fontSize: 13,
  color: 'var(--text-secondary)',
  width: 160,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const minutesStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)',
  width: 48,
  textAlign: 'right',
  flexShrink: 0,
};

const BAR_COLOR = '#60a5fa';

function HorizBar({ minutes, maxMinutes }) {
  const pct = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0;
  return (
    <div style={{ flex: 1, height: 14, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: BAR_COLOR, borderRadius: 4 }} />
    </div>
  );
}

export default function MplByCategoryPanel({ byCategory }) {
  const entries = byCategory ? Object.entries(byCategory) : [];

  // Sort descending by minutes
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);

  // Bucket: top 8 + "Other" if > 10 categories
  let displayed = sorted;
  if (sorted.length > 10) {
    const top8 = sorted.slice(0, 8);
    const otherMinutes = sorted.slice(8).reduce((sum, [, m]) => sum + m, 0);
    displayed = [...top8, ['Other', otherMinutes]];
  }

  const maxMinutes = displayed.length > 0 ? displayed[0][1] : 0;

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>MPL Minutes by Category</div>
      {displayed.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No process data for this period.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayed.map(([name, minutes]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={labelStyle}>{name}</span>
              <HorizBar minutes={minutes} maxMinutes={maxMinutes} />
              <span style={minutesStyle}>{minutes}m</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/*
// Mock data smoke test (uncomment to verify in isolation):
// const mockByCategory = {
//   'Haulage Planning': 120, 'Documentation': 85, 'Customer Calls': 60,
//   'Data Entry': 45, 'Escalations': 30,
// };
// <MplByCategoryPanel byCategory={mockByCategory} />
*/
