import { useTheme } from '../../context/ThemeContext.jsx';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'activity', label: 'Activity Log' },
  { key: 'reports', label: 'Reports' },
];

export default function InsightsTabs({ activeTab, onTabChange }) {
  const { theme } = useTheme();

  function tabStyle(active) {
    return {
      height: 40,
      padding: '0 20px',
      borderRadius: 20,
      border: 'none',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: active ? 700 : 500,
      background: active ? 'var(--color-mmark)' : (theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'),
      color: active ? '#fff' : (theme === 'light' ? '#475569' : 'rgba(255,255,255,0.55)'),
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
