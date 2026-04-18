import { useState } from 'react';
import SuggestionStatusBadge from './SuggestionStatusBadge.jsx';

const TYPE_ICON = {
  bug:         '🐛',
  feature:     '✨',
  category:    '🗂️',
  subcategory: '📂',
  other:       '💬',
};

const TYPE_LABEL = {
  bug:         'Bug',
  feature:     'Feature',
  category:    'Category',
  subcategory: 'Subcategory',
  other:       'Other',
};

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

const C = {
  row:     'var(--card-bg-subtle)',
  rowHov:  'var(--bg-card)',
  border:  'var(--border)',
  textPri: 'var(--text-pri)',
  textSec: 'var(--text-sec)',
  textDim: 'var(--text-dim)',
};

export default function SuggestionRow({ suggestion, onClick, showSubmitter }) {
  const [hovered, setHovered] = useState(false);

  const submitterName = suggestion.platform_users?.full_name || suggestion.platform_users?.email || '';

  return (
    <div
      onClick={() => onClick && onClick(suggestion)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: hovered ? C.rowHov : C.row,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 120ms',
        marginBottom: 6,
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }} title={TYPE_LABEL[suggestion.type]}>
        {TYPE_ICON[suggestion.type] || '💬'}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: C.textPri,
          fontSize: 14,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {suggestion.title}
        </div>
        {showSubmitter && submitterName && (
          <div style={{ color: C.textSec, fontSize: 12, marginTop: 2 }}>
            {submitterName}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ color: C.textDim, fontSize: 12 }}>
          {relativeTime(suggestion.created_at)}
        </span>
        <SuggestionStatusBadge status={suggestion.status} />
      </div>
    </div>
  );
}
