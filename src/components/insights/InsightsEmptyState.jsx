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
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
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
      <div style={{ fontSize: 14, color: 'var(--text-sec)', textAlign: 'center', maxWidth: 320 }}>
        {message}
      </div>
    </div>
  );
}
