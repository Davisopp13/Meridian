const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'activity', label: 'Activity Log' },
  { key: 'reports', label: 'Reports' },
];

export default function InsightsTabs({ activeTab, onTabChange }) {
  function tabStyle(active) {
    return {
      height: 40,
      padding: '0 20px',
      borderRadius: 20,
      border: 'none',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: active ? 700 : 500,
      background: active ? 'var(--tab-active-bg)' : 'var(--hover-surface)',
      color: active ? 'var(--tab-active-fg)' : 'var(--text-dim)',
      transition: 'background 150ms, color 150ms',
    };
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
      {TABS.map(t => (
        <button key={t.key} style={tabStyle(activeTab === t.key)} onClick={() => onTabChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
