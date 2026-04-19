import { useState, useMemo } from 'react';
import { useAllSuggestions } from '../hooks/useAllSuggestions.js';
import { formatSuggestionListForClaude } from '../lib/suggestionFormat.js';
import SuggestionList from './feedback/SuggestionList.jsx';
import SuggestionDetailPanel from './feedback/SuggestionDetailPanel.jsx';

const C = {
  textPri: 'var(--text-pri)',
  textSec: 'var(--text-sec)',
  textDim: 'var(--text-dim)',
  bg:      'var(--bg-card)',
  border:  'var(--border)',
  input:   'var(--card-bg-subtle)',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'wont_fix', label: "Won't fix" },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature request' },
  { value: 'category', label: 'New category' },
  { value: 'subcategory', label: 'New subcategory' },
  { value: 'other', label: 'Other' },
];

const SELECT_STYLE = {
  background: C.input,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.textPri,
  fontSize: 13,
  padding: '6px 10px',
  cursor: 'pointer',
};

export default function AdminTab({ user, profile }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter]     = useState('');
  const [selectedId, setSelectedId]     = useState(null);
  const [copyMsg, setCopyMsg]           = useState(null);

  const { suggestions, loading, error, refetch } = useAllSuggestions({
    statusFilter: statusFilter || null,
    typeFilter:   typeFilter   || null,
  });

  // Unfiltered counts — recompute from the filtered list because we only have
  // one fetch. When filters are active, counts reflect the filtered set.
  // For accurate total/new/in_progress counts, fetch unfiltered separately.
  const { suggestions: all } = useAllSuggestions({});

  const counts = useMemo(() => {
    const newCount  = all.filter(s => s.status === 'new').length;
    const inProg    = all.filter(s => s.status === 'in_progress').length;
    return { newCount, inProg, total: all.length };
  }, [all]);

  const selected = suggestions.find(s => s.id === selectedId) ?? null;

  if (profile?.role !== 'admin') {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
        <p style={{ color: C.textSec, fontSize: 15 }}>
          Not authorized. Admin access only.
        </p>
      </div>
    );
  }

  function handleRowClick(suggestion) {
    setSelectedId(prev => (prev === suggestion.id ? null : suggestion.id));
  }

  function handleUpdated() {
    refetch();
    // keep panel open so admin can continue editing
  }

  function handleClose() {
    setSelectedId(null);
  }

  async function handleCopyAllForClaude() {
    const text = formatSuggestionListForClaude(suggestions, { statusFilter, typeFilter });
    try {
      await navigator.clipboard.writeText(text);
      const n = suggestions.length;
      setCopyMsg(`Copied ${n} ${n === 1 ? 'suggestion' : 'suggestions'} to clipboard.`);
    } catch (err) {
      setCopyMsg('Copy failed.');
    }
    setTimeout(() => setCopyMsg(null), 2500);
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
      <h2 style={{ color: C.textPri, fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
        Admin
      </h2>

      {/* Counts summary */}
      <p style={{ color: C.textDim, fontSize: 13, margin: '0 0 24px' }}>
        {counts.newCount} new · {counts.inProg} in progress · {counts.total} total
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setSelectedId(null); }}
          style={SELECT_STYLE}
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setSelectedId(null); }}
          style={SELECT_STYLE}
        >
          {TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        <button
          onClick={handleCopyAllForClaude}
          disabled={suggestions.length === 0}
          style={{
            padding: '6px 14px', borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: 'transparent', color: C.textPri,
            cursor: suggestions.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13, opacity: suggestions.length === 0 ? 0.45 : 1,
          }}
        >
          Copy all for Claude
        </button>
        {copyMsg && (
          <span style={{ fontSize: 12, color: C.textDim }}>{copyMsg}</span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>
          Error loading suggestions. Please refresh.
        </p>
      )}

      {/* List */}
      {loading ? (
        <div style={{ color: C.textSec, fontSize: 14, padding: '12px 0' }}>Loading…</div>
      ) : (
        suggestions.map(suggestion => (
          <div key={suggestion.id}>
            <SuggestionList
              suggestions={[suggestion]}
              onRowClick={handleRowClick}
              showSubmitter={true}
              emptyMessage=""
            />
            {selectedId === suggestion.id && (
              <SuggestionDetailPanel
                suggestion={suggestion}
                onClose={handleClose}
                onUpdated={handleUpdated}
              />
            )}
          </div>
        ))
      )}

      {!loading && suggestions.length === 0 && (
        <p style={{ color: C.textSec, fontSize: 14, padding: '12px 0' }}>
          No suggestions match the current filters.
        </p>
      )}
    </div>
  );
}
