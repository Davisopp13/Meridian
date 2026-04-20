export default function ReportsTab() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '64px 24px',
      gap: 16,
    }}>
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 0.4 }}
      >
        <rect x="6" y="28" width="8" height="14" rx="2" fill="#003087" />
        <rect x="20" y="18" width="8" height="24" rx="2" fill="#003087" />
        <rect x="34" y="8" width="8" height="34" rx="2" fill="#003087" />
      </svg>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-pri)' }}>
        Reports are coming soon
      </p>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-sec)', maxWidth: 480, textAlign: 'center', lineHeight: 1.6 }}>
        Saved reports will let you answer specific questions — handle time by category, re-resolves by agent, MPL time breakdowns — and export to CSV.
      </p>
    </div>
  );
}
