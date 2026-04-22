import { useState, useEffect, useMemo } from 'react';
import { useActivityData } from '../hooks/useActivityData';
import { useTheme } from '../context/ThemeContext.jsx';
import CaseLink from './CaseLink.jsx';

const TYPE_STYLE = {
  Resolved:     { color: '#16a34a', bg: 'rgba(22,163,74,0.12)',   border: 'rgba(22,163,74,0.28)' },
  Reclassified: { color: '#dc2626', bg: 'rgba(220,38,38,0.12)',   border: 'rgba(220,38,38,0.28)' },
  Call:         { color: '#0284c7', bg: 'rgba(2,132,199,0.12)',   border: 'rgba(2,132,199,0.28)' },
  Process:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.28)' },
  Awaiting:     { color: '#E8540A', bg: 'rgba(232,84,10,0.12)',   border: 'rgba(232,84,10,0.28)' },
  'Not a Case': { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.28)' },
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
    sf_case_id: '500abc123def4567',
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
    sf_case_id: '500XYZ987uvw3456',
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
function FilterTab({ filterKey, label, count, active, onClick, C }) {
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

const CASE_TYPE_OPTIONS = [
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Reclassified', label: 'Reclassified' },
  { value: 'Call', label: 'Call' },
  { value: 'Not a Case', label: 'Not a Case' },
];

const MINUTES_CHIPS = [5, 10, 15, 20, 30, 45, 60];

const MC = {
  bgCard: '#1a1d27',
  bgInput: '#141720',
  border: 'rgba(255,255,255,0.07)',
  borderFocus: 'rgba(232,84,10,0.5)',
  orange: '#E8540A',
  orangeBg: 'rgba(232,84,10,0.12)',
  orangeBorder: 'rgba(232,84,10,0.28)',
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

const TYPE_COLOR = {
  Resolved: { color: MC.green, bg: MC.greenBg, border: MC.greenBorder },
  Reclassified: { color: MC.red, bg: MC.redBg, border: MC.redBorder },
  Call: { color: MC.blue, bg: MC.blueBg, border: MC.blueBorder },
  'Not a Case': { color: MC.textMuted, bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.28)' },
};

function EditModal({ entry, onClose, onSave, onDelete }) {
  const isCaseEntry = entry.src === 'case';

  const [type, setType] = useState(entry.type);
  const [caseNumber, setCaseNumber] = useState(entry.case_number || '');
  const [durMinutes, setDurMinutes] = useState(Math.floor(entry.dur / 60));
  const [durSeconds, setDurSeconds] = useState(entry.dur % 60);
  const [minutes, setMinutes] = useState(entry.minutes || Math.round(entry.dur / 60));
  const [rfc, setRfc] = useState(entry.rfc || false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (isCaseEntry) {
        await onSave(entry, {
          type,
          rfc,
          case_number: caseNumber.trim() || null,
          dur: durMinutes * 60 + durSeconds,
        });
      } else {
        await onSave(entry, { minutes: parseInt(minutes, 10) || 0 });
      }
      onClose();
    } catch { /* parent handles */ } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(entry);
      onClose();
    } catch { /* parent handles */ } finally { setDeleting(false); }
  };

  const inputStyle = {
    background: MC.bgInput,
    border: `1px solid ${MC.border}`,
    borderRadius: 8,
    color: MC.textPrimary,
    outline: 'none',
  };

  const labelStyle = {
    color: MC.textMuted,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 8,
  };

  return (
    <>
      <style>{`@keyframes editSlideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }`}</style>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: MC.bgCard,
            border: `1px solid ${MC.border}`,
            borderRadius: 12,
            width: '100%',
            maxWidth: 420,
            margin: '0 16px',
            overflow: 'hidden',
            animation: 'editSlideUp 180ms ease-out',
          }}
        >
          {showDeleteConfirm ? (
            <div style={{ padding: 24 }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
                <div style={{ color: MC.textPrimary, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                  Delete this entry?
                </div>
                <div style={{ color: MC.textMuted, fontSize: 13 }}>
                  This action cannot be undone.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 8,
                    border: `1px solid ${MC.border}`,
                    background: 'transparent',
                    color: MC.textSecondary,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 8,
                    border: 'none',
                    background: MC.red,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: deleting ? 'default' : 'pointer',
                    opacity: deleting ? 0.7 : 1,
                  }}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div
                style={{
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, rgba(232,84,10,0.15) 0%, rgba(232,84,10,0.05) 100%)',
                  borderBottom: `1px solid ${MC.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: MC.orange, fontSize: 14 }}>✎</span>
                  <span style={{ color: MC.textPrimary, fontSize: 14, fontWeight: 600 }}>Edit Activity</span>
                  {entry.case_number && (
                    <>
                      <span style={{ color: MC.textMuted, fontSize: 12, fontFamily: 'monospace' }}>
                        #{entry.case_number}
                      </span>
                      <CaseLink sfCaseId={entry.sf_case_id} showOnHover={false} />
                    </>
                  )}
                </div>
                <button
                  onClick={onClose}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: MC.textMuted,
                    fontSize: 18,
                    cursor: 'pointer',
                    lineHeight: 1,
                    padding: '0 2px',
                  }}
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {isCaseEntry ? (
                  <>
                    {/* Status pills */}
                    <div>
                      <div style={labelStyle}>Status</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {CASE_TYPE_OPTIONS.map(opt => {
                          const tc = TYPE_COLOR[opt.value] || { color: MC.textMuted, bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.28)' };
                          const active = type === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setType(opt.value)}
                              style={{
                                padding: '0 12px',
                                height: 30,
                                borderRadius: 15,
                                border: `1px solid ${active ? tc.border : MC.border}`,
                                background: active ? tc.bg : 'transparent',
                                color: active ? tc.color : MC.textMuted,
                                fontSize: 12,
                                fontWeight: active ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 120ms',
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Case Number */}
                    <div>
                      <div style={labelStyle}>Case Number</div>
                      <input
                        value={caseNumber}
                        onChange={e => setCaseNumber(e.target.value)}
                        style={{
                          ...inputStyle,
                          width: '100%',
                          height: 36,
                          fontSize: 13,
                          fontFamily: 'monospace',
                          padding: '0 10px',
                          boxSizing: 'border-box',
                        }}
                        onFocus={e => { e.target.style.borderColor = MC.borderFocus; }}
                        onBlur={e => { e.target.style.borderColor = MC.border; }}
                      />
                    </div>

                    {/* Duration */}
                    <div>
                      <div style={labelStyle}>Duration</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <input
                            type="number"
                            min={0}
                            value={durMinutes}
                            onChange={e => setDurMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            style={{ ...inputStyle, width: 64, height: 36, fontSize: 14, fontFamily: 'monospace', textAlign: 'center', padding: 0 }}
                            onFocus={e => { e.target.style.borderColor = MC.borderFocus; }}
                            onBlur={e => { e.target.style.borderColor = MC.border; }}
                          />
                          <span style={{ color: MC.textMuted, fontSize: 11 }}>min</span>
                        </div>
                        <span style={{ color: MC.textMuted, fontSize: 16, marginBottom: 18 }}>:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <input
                            type="number"
                            min={0}
                            max={59}
                            value={durSeconds}
                            onChange={e => setDurSeconds(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                            style={{ ...inputStyle, width: 64, height: 36, fontSize: 14, fontFamily: 'monospace', textAlign: 'center', padding: 0 }}
                            onFocus={e => { e.target.style.borderColor = MC.borderFocus; }}
                            onBlur={e => { e.target.style.borderColor = MC.border; }}
                          />
                          <span style={{ color: MC.textMuted, fontSize: 11 }}>sec</span>
                        </div>
                      </div>
                    </div>

                    {/* RFC — only when Resolved */}
                    {type === 'Resolved' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={rfc}
                          onChange={e => setRfc(e.target.checked)}
                          style={{ width: 15, height: 15, accentColor: MC.orange }}
                        />
                        <span style={{ color: MC.textSecondary, fontSize: 13 }}>
                          Resolved First Contact (RFC)
                        </span>
                      </label>
                    )}
                  </>
                ) : (
                  <>
                    {/* Process: category read-only */}
                    <div>
                      <div style={labelStyle}>Category</div>
                      <div
                        style={{
                          color: MC.textSecondary,
                          fontSize: 13,
                          padding: '8px 10px',
                          background: MC.bgInput,
                          borderRadius: 8,
                          border: `1px solid ${MC.border}`,
                        }}
                      >
                        {entry.category || '—'}
                      </div>
                      <div style={{ color: MC.textMuted, fontSize: 11, marginTop: 6 }}>
                        Category cannot be changed. Delete and re-log if needed.
                      </div>
                    </div>

                    {/* Minutes chips + input */}
                    <div>
                      <div style={labelStyle}>Minutes</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {MINUTES_CHIPS.map(chip => (
                          <button
                            key={chip}
                            onClick={() => setMinutes(chip)}
                            style={{
                              padding: '0 12px',
                              height: 30,
                              borderRadius: 15,
                              border: `1px solid ${minutes === chip ? MC.orangeBorder : MC.border}`,
                              background: minutes === chip ? MC.orangeBg : 'transparent',
                              color: minutes === chip ? MC.orange : MC.textMuted,
                              fontSize: 12,
                              fontWeight: minutes === chip ? 600 : 400,
                              cursor: 'pointer',
                              transition: 'all 120ms',
                            }}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={minutes}
                        onChange={e => setMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        style={{ ...inputStyle, width: 80, height: 36, fontSize: 14, fontFamily: 'monospace', textAlign: 'center', padding: 0 }}
                        onFocus={e => { e.target.style.borderColor = MC.borderFocus; }}
                        onBlur={e => { e.target.style.borderColor = MC.border; }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: '12px 16px',
                  borderTop: `1px solid ${MC.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    padding: '0 12px',
                    height: 34,
                    borderRadius: 8,
                    border: `1px solid ${MC.redBorder}`,
                    background: MC.redBg,
                    color: MC.red,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={onClose}
                    style={{
                      padding: '0 16px',
                      height: 34,
                      borderRadius: 8,
                      border: `1px solid ${MC.border}`,
                      background: 'transparent',
                      color: MC.textSecondary,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: '0 16px',
                      height: 34,
                      borderRadius: 8,
                      border: 'none',
                      background: MC.orange,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: saving ? 'default' : 'pointer',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Defined outside ActivityLog to avoid hooks-in-loop
function EntryRow({ entry, onEdit, allowMutations, C }) {
  const [hovered, setHovered] = useState(false);
  const ts = TYPE_STYLE[entry.type] || { color: C.textMuted, bg: 'transparent', border: C.border };

  return (
    <div
      className="case-link-host"
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

      {/* Case # — 116px (extra 20px for SF link icon slot) */}
      <div style={{ width: 116, flexShrink: 0, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
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
        {entry.case_number && <CaseLink sfCaseId={entry.sf_case_id} />}
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

      {/* Edit icon — hover only, hidden when mutations disabled */}
      {allowMutations && (
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
          onClick={() => onEdit(entry)}
        >
          <span style={{ fontSize: 13, color: C.textSecondary }}>✎</span>
        </div>
      )}
    </div>
  );
}

export default function ActivityLog({ userId, userIds, allowMutations = true }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const C = {
    bg:              isLight ? '#f1f5f9'              : '#0f1117',
    bgCard:          isLight ? '#ffffff'              : '#1a1d27',
    bgHover:         isLight ? '#f8fafc'              : '#1e2130',
    border:          isLight ? 'rgba(0,0,0,0.08)'    : 'rgba(255,255,255,0.07)',
    orange:          '#E8540A',
    green:           '#16a34a',
    greenBg:         'rgba(22,163,74,0.12)',
    greenBorder:     'rgba(22,163,74,0.28)',
    red:             '#dc2626',
    redBg:           'rgba(220,38,38,0.12)',
    redBorder:       'rgba(220,38,38,0.28)',
    blue:            '#0284c7',
    blueBg:          'rgba(2,132,199,0.12)',
    blueBorder:      'rgba(2,132,199,0.28)',
    lightBlue:       '#60a5fa',
    lightBlueBg:     'rgba(96,165,250,0.12)',
    lightBlueBorder: 'rgba(96,165,250,0.28)',
    textPrimary:     isLight ? '#0f172a'              : '#f1f5f9',
    textSecondary:   isLight ? '#475569'              : '#cbd5e1',
    textMuted:       isLight ? '#64748b'              : '#6b7280',
  };

  const [activeFilters, setActiveFilters] = useState(new Set());
  const [range, setRange] = useState('today');
  const [editingEntry, setEditingEntry] = useState(null);

  const rangeDays = RANGES.find(r => r.key === range)?.days ?? 0;
  const { entries, loading, error, editEntry, deleteEntry } = useActivityData({ userId, userIds, rangeDays });

  async function handleSave(entry, updates) {
    const ok = await editEntry(entry, updates);
    if (!ok) throw new Error('Save failed');
  }

  async function handleDelete(entry) {
    const ok = await deleteEntry(entry);
    if (!ok) throw new Error('Delete failed');
  }

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
              border: `1px solid ${activeFilters.size === 0 ? (isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)') : C.border}`,
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
              C={C}
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

      {allowMutations && editingEntry && (
        <EditModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

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
              <EntryRow entry={entry} onEdit={setEditingEntry} allowMutations={allowMutations} C={C} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
