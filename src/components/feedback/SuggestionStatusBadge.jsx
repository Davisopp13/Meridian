const STATUS_STYLES = {
  new:          { bg: '#1d4ed8', color: '#eff6ff', label: 'New' },
  acknowledged: { bg: '#b45309', color: '#fef3c7', label: 'Acknowledged' },
  in_progress:  { bg: 'var(--color-mbtn)', color: '#e0e7ff', label: 'In progress' },
  shipped:      { bg: '#15803d', color: '#f0fdf4', label: 'Shipped' },
  wont_fix:     { bg: '#4b5563', color: '#f9fafb', label: "Won't fix" },
};

export default function SuggestionStatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.new;
  return (
    <span style={{
      display: 'inline-block',
      background: s.bg,
      color: s.color,
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 10,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}
