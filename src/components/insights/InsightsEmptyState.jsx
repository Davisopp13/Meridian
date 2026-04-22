const C = {
  card: 'var(--bg-card)',
  border: 'var(--border)',
  textSec: 'var(--text-sec)',
  textDim: 'var(--text-dim)',
};

export default function InsightsEmptyState({ reason }) {
  const message =
    reason === 'not-supervisor'
      ? 'Insights is available to supervisors only.'
      : reason === 'no-teams'
      ? 'No teams assigned yet. Contact an administrator.'
      : 'No team data in this period.';

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 32, lineHeight: 1 }}>📊</div>
      <div style={{ fontSize: 14, color: C.textSec, textAlign: 'center', maxWidth: 320 }}>
        {message}
      </div>
    </div>
  );
}
