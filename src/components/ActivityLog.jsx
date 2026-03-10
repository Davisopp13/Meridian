import { useState, useMemo } from 'react';
import { useActivityData } from '../hooks/useActivityData';

const C = {
  bg: '#0f1117',
  bgCard: '#1a1d27',
  bgHover: '#1e2130',
  border: 'rgba(255,255,255,0.07)',
  orange: '#E8540A',
  green: '#16a34a',
  greenBg: 'rgba(22,163,74,0.12)',
  greenBorder: 'rgba(22,163,74,0.28)',
  red: '#dc2626',
  redBg: 'rgba(220,38,38,0.12)',
  redBorder: 'rgba(220,38,38,0.28)',
  blue: '#0284c7',
  blueBg: 'rgba(2,132,199,0.12)',
  blueBorder: 'rgba(2,132,199,0.28)',
  lightBlue: '#60a5fa',
  lightBlueBg: 'rgba(96,165,250,0.12)',
  lightBlueBorder: 'rgba(96,165,250,0.28)',
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#6b7280',
};

const TYPE_STYLE = {
  Resolved: { color: C.green, bg: C.greenBg, border: C.greenBorder },
  Reclassified: { color: C.red, bg: C.redBg, border: C.redBorder },
  Call: { color: C.blue, bg: C.blueBg, border: C.blueBorder },
  Process: { color: C.lightBlue, bg: C.lightBlueBg, border: C.lightBlueBorder },
  Awaiting: { color: C.orange, bg: 'rgba(232,84,10,0.12)', border: 'rgba(232,84,10,0.28)' },
  'Not a Case': { color: C.textMuted, bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.28)' },
};

const FILTER_TABS = [
  { key: 'Resolved', label: 'Resolved' },
  { key: 'Reclassified', label: 'Reclassified' },
  { key: 'Call', label: 'Calls' },
  { key: 'Process', label: 'Processes' },
];

const RANGES = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '2days', label: '2 Days', days: 1 },
  { key: 'week', label: 'This Week', days: 6 },
  { key: 'month', label: 'Month', days: 29 },
];

const MOCK_ENTRIES = [
  {
    id: '1',
    type: 'Resolved',
    src: 'case',
    case_number: '130971881',
    category: 'Inland / Inland Precarriage',
    dur: 134,
    rfc: true,
    ts: new Date(Date.now() - 3 * 60 * 1000),
  },
  {
    id: '2',
    type: 'Reclassified',
    src: 'case',
    case_number: '130855234',
    category: 'Documentation / Bill of Lading',
    dur: 87,
    rfc: false,
    ts: new Date(Date.now() - 25 * 60 * 1000),
  },
  {
    id: '3',
    type: 'Call',
    src: 'case',
    case_number: '130799012',
    category: 'Detention & Demurrage',
    dur: 312,
    rfc: false,
    ts: new Date(Date.now() - 48 * 60 * 1000),
  },
  {
    id: '4',
    type: 'Process',
    src: 'process',
    case_number: null,
    category: 'Work Order Creation',
    dur: 540,
    rfc: false,
    ts: new Date(Date.now() - 72 * 60 * 1000),
  },
  {
    id: '5',
    type: 'Resolved',
    src: 'case',
    case_number: '130944567',
    category: 'Customs / Import Entry',
    dur: 220,
    rfc: false,
    ts: new Date(Date.now() - 90 * 60 * 1000),
  },
  {
    id: '6',
    type: 'Process',
    src: 'process',
    case_number: null,
    category: 'Rate Quote',
    dur: 180,
    rfc: false,
    ts: new Date(Date.now() - 110 * 60 * 1000),
  },
  {
    id: '7',
    type: 'Not a Case',
    src: 'case',
    case_number: '130911234',
    category: 'Spam / Junk',
    dur: 15,
    rfc: false,
    ts: new Date(Date.now() - 130 * 60 * 1000),
  },
];

function formatDur(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// Defined outside ActivityLog to avoid hooks-in-loop
function FilterTab({ filterKey, label, count, active, onClick }) {
  const ts = TYPE_STYLE[filterKey] || { color: C.textPrimary, bg: 'transparent', border: C.border };
  return (
    <button
      onClick={() => onClick(filterKey)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 12px',
        height: 32,
        borderRadius: 16,
        border: `1px solid ${active ? ts.border : C.border}`,
        background: active ? ts.bg : 'transparent',
        color: active ? ts.color : C.textSecondary,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 120ms',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: active ? ts.color : C.textMuted, fontSize: 10 }}>●</span>
      {label}
      <span
        style={{
          background: 'rgba(255,255,255,0.08)',
          color: C.textSecondary,
          borderRadius: 10,
          padding: '1px 6px',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </button>
  );
}

// Defined outside ActivityLog to avoid hooks-in-loop
function EntryRow({ entry }) {
  const [hovered, setHovered] = useState(false);
  const ts = TYPE_STYLE[entry.type] || { color: C.textMuted, bg: 'transparent', border: C.border };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 36,
        borderBottom: `1px solid ${C.border}`,
        background: hovered ? C.bgHover : 'transparent',
        transition: 'background 100ms',
        overflow: 'hidden',
      }}
    >
      {/* 3px accent bar */}
      <div style={{ width: 3, alignSelf: 'stretch', background: ts.color, flexShrink: 0 }} />

      {/* Type label — 110px */}
      <div
        style={{
          width: 110,
          flexShrink: 0,
          paddingLeft: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          overflow: 'hidden',
        }}
      >
        <span style={{ color: ts.color, fontSize: 10, flexShrink: 0 }}>●</span>
        <span
          style={{
            color: ts.color,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {entry.type}
        </span>
        {entry.rfc && (
          <span style={{ fontSize: 10, color: C.orange, fontWeight: 700, flexShrink: 0 }}>RFC</span>
        )}
      </div>

      {/* Separator */}
      <span style={{ color: C.textMuted, fontSize: 12, flexShrink: 0, marginRight: 8 }}>·</span>

      {/* Case # — 96px */}
      <div style={{ width: 96, flexShrink: 0, overflow: 'hidden' }}>
        <span
          style={{
            color: C.textSecondary,
            fontSize: 12,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.case_number || 'Manual'}
        </span>
      </div>

      {/* Separator */}
      <span style={{ color: C.textMuted, fontSize: 12, flexShrink: 0, marginRight: 8 }}>·</span>

      {/* Category — flex grow */}
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <span
          style={{
            color: C.textSecondary,
            fontSize: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
          }}
        >
          {entry.category}
        </span>
      </div>

      {/* Duration */}
      <div style={{ flexShrink: 0, marginLeft: 12, marginRight: 12 }}>
        <span style={{ color: C.textSecondary, fontSize: 12 }}>{formatDur(entry.dur)}</span>
      </div>

      {/* Time — 68px monospace right-aligned */}
      <div style={{ width: 68, flexShrink: 0, textAlign: 'right', paddingRight: 8 }}>
        <span style={{ color: C.textMuted, fontSize: 11, fontFamily: 'monospace' }}>
          {formatTime(entry.ts)}
        </span>
      </div>

      {/* Edit icon — hover only */}
      <div
        style={{
          width: 28,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: hovered ? 0.6 : 0,
          transition: 'opacity 120ms',
          cursor: 'pointer',
        }}
        onClick={() => console.log('edit', entry.id)}
      >
        <span style={{ fontSize: 13, color: C.textSecondary }}>✎</span>
      </div>
    </div>
  );
}

export default function ActivityLog({ userId }) {
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [range, setRange] = useState('today');

  const rangeDays = RANGES.find(r => r.key === range)?.days ?? 0;
  const { entries, loading, error } = useActivityData({ userId, rangeDays });

  // Count badges reflect total count for range regardless of other active filters
  const typeCounts = useMemo(() => {
    const counts = {};
    FILTER_TABS.forEach(f => {
      counts[f.key] = entries.filter(e => e.type === f.key).length;
    });
    return counts;
  }, [entries]);

  function toggleFilter(key) {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function clearFilters() {
    setActiveFilters(new Set());
  }

  // If no filters active, all entries visible; else only matching type is visible
  function isVisible(entry) {
    if (activeFilters.size === 0) return true;
    return activeFilters.has(entry.type);
  }

  function rangeTabStyle(active) {
    return {
      padding: '0 10px',
      height: 28,
      borderRadius: 14,
      border: 'none',
      background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
      color: active ? C.textPrimary : C.textMuted,
      fontSize: 12,
      fontWeight: active ? 600 : 400,
      cursor: 'pointer',
      transition: 'all 120ms',
    };
  }

  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${C.border}`,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {/* Filter tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* All button */}
          <button
            onClick={clearFilters}
            style={{
              padding: '0 12px',
              height: 32,
              borderRadius: 16,
              border: `1px solid ${activeFilters.size === 0 ? 'rgba(255,255,255,0.25)' : C.border}`,
              background: activeFilters.size === 0 ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeFilters.size === 0 ? C.textPrimary : C.textMuted,
              fontSize: 12,
              fontWeight: activeFilters.size === 0 ? 700 : 400,
              cursor: 'pointer',
              transition: 'all 120ms',
            }}
          >
            All
          </button>

          {FILTER_TABS.map(f => (
            <FilterTab
              key={f.key}
              filterKey={f.key}
              label={f.label}
              count={typeCounts[f.key] || 0}
              active={activeFilters.has(f.key)}
              onClick={toggleFilter}
            />
          ))}

          {activeFilters.size > 0 && (
            <button
              onClick={clearFilters}
              style={{
                padding: '0 8px',
                height: 28,
                border: 'none',
                background: 'transparent',
                color: C.textMuted,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Clear all
            </button>
          )}
        </div>

        {/* Range selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {RANGES.map(r => (
            <button
              key={r.key}
              style={rangeTabStyle(range === r.key)}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div style={{ maxHeight: 400, overflowY: 'auto', opacity: loading ? 0.5 : 1, transition: 'opacity 200ms' }}>
        {error ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: C.textMuted,
              fontSize: 13,
            }}
          >
            Could not load activity
          </div>
        ) : entries.length === 0 && !loading ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: C.textMuted,
              fontSize: 13,
            }}
          >
            No activity yet
          </div>
        ) : (
          entries.map(entry => (
            <div
              key={entry.id}
              style={{ opacity: isVisible(entry) ? 1 : 0.15, transition: 'opacity 150ms' }}
            >
              <EntryRow entry={entry} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
