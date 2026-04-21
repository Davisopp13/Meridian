const TABS = [
  { key: 'users', label: 'Users' },
  { key: 'teams', label: 'Teams' },
  { key: 'suggestions', label: 'Suggestions' },
  { key: 'categories', label: 'Categories' },
];

function tabStyle(active) {
  return {
    height: 40,
    padding: '0 20px',
    borderRadius: 20,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    background: active ? 'var(--color-mmark)' : 'rgba(255,255,255,0.06)',
    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
    transition: 'background 150ms, color 150ms',
  };
}

export default function AdminTabs({ activeTab, onTabChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {TABS.map(t => (
        <button key={t.key} style={tabStyle(activeTab === t.key)} onClick={() => onTabChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
