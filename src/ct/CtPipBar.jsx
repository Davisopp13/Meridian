import { useState } from 'react';
import { C, formatElapsed, DEFAULT_SETTINGS } from '../lib/constants.js';
import PillZone from '../components/PillZone.jsx';
import StatButton from '../components/StatButton.jsx';
import MinimizeButton from '../components/MinimizeButton.jsx';
import MinimizedStrip from '../components/MinimizedStrip.jsx';
import { Check, Phone, CornerUpLeft } from 'lucide-react';

const STAT_BUTTON_CONFIG = {
  resolved:  { icon: <Check size={14} strokeWidth={2.5} />, label: 'Resolved',  color: C.resolved,    key: 'resolved' },
  reclass:   { icon: <CornerUpLeft size={14} strokeWidth={2.5} />, label: 'Reclass',   color: C.reclass,     key: 'reclass' },
  calls:     { icon: <Phone size={14} strokeWidth={2.5} />, label: 'Calls',      color: C.calls,       key: 'calls' },
  total:     { icon: null,  label: 'Total',      color: C.process,     key: null },
}

const CT_DEFAULT_STAT_BUTTONS = ['resolved', 'reclass', 'calls', 'total'];

/**
 * CtPipBar — CT widget bar (cases only). Forked from PipBar.jsx.
 * Process-related props and UI removed. Renders into the PiP window via ReactDOM.createRoot.
 *
 * Props:
 *   cases            — array of { id, caseNum, elapsed, paused, awaiting }
 *   focusedCaseId    — id of focused case (or null)
 *   trayOpen         — bool
 *   isMinimized      — bool — when true, renders compact restore strip
 *   stats            — { resolved, reclass, calls }
 *   onOpenDashboard  — click M° button
 *   onMinimize       — click — button
 *   onRestore        — click restore strip
 *   onToggleTray     — chevron click
 *   onFocusCase(id)
 *   onPauseCase(id)
 *   onResumeCase(id)
 *   onCloseCase(id)
 *   onResolve        — stat button: resolve focused case
 *   onReclass        — stat button: reclass focused case
 *   onCall           — stat button: log call on focused case
 *   children         — optional: overlay or tray rendered below bar row
 */
function SnapButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title="Snap to corner"
      onClick={() => { console.log('SNAP CLICKED'); onClick && onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 16,
        height: 16,
        padding: 0,
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: hovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)',
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 12 12" width="11" height="11" fill="none">
        <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" />
        <circle cx="6" cy="6" r="1.5" fill="currentColor" />
      </svg>
    </button>
  );
}

export default function CtPipBar({
  cases = [],
  focusedCaseId = null,
  trayOpen = false,
  isMinimized = false,
  stats = { resolved: 0, reclass: 0, calls: 0 },
  onOpenDashboard,
  onMinimize,
  onRestore,
  onToggleTray,
  onFocusCase,
  onPauseCase,
  onResumeCase,
  onResumeAwaitingCase,
  onCloseCase,
  onResolve,
  onReclass,
  onCall,
  userSettings = DEFAULT_SETTINGS,
  pipToast = null,
  connectionStatus = 'connected',
  todayScorecard = { resolved: 0, calls: 0 },
  activeStripSession = null,
  onStripSwap,
  hasPendingActivity = false,
  onSnapToCorner,
  onStartCase,
  onAwaitingCase,
  onNotACase,
  children,
}) {
  const [showCaseInput, setShowCaseInput] = useState(false);
  const [caseInput, setCaseInput] = useState('');
  const CONNECTION_COLORS = { connected: '#4ade80', degraded: '#fbbf24', offline: '#f87171' }
  const connDotColor = CONNECTION_COLORS[connectionStatus] || '#4ade80'

  // ── Minimized restore strip ──────────────────────────────────────────────
  if (isMinimized) {
    const focusedCase = focusedCaseId ? cases.find(c => c.id === focusedCaseId) : (cases[0] || null)
    return (
      <MinimizedStrip
        focusedCase={focusedCase}
        activeProcess={null}
        activeStripSession={activeStripSession}
        connectionStatus={connectionStatus}
        todayScorecard={todayScorecard}
        hasPendingActivity={hasPendingActivity}
        onRestore={onRestore}
        onOpenDashboard={onOpenDashboard}
        onStripSwap={onStripSwap}
        onPauseCase={onPauseCase}
        onResumeCase={onResumeCase}
        onAwaitingCase={onAwaitingCase}
        onResumeAwaitingCase={onResumeAwaitingCase}
        onProcessPause={undefined}
        onProcessResume={undefined}
        onProcessLog={undefined}
        onProcessDiscard={undefined}
      />
    )
  }

  // ── Stat button disabled: no focused case ────────────────────────────────
  const hasFocused = !!focusedCaseId;

  // ── Full bar ─────────────────────────────────────────────────────────────
  const divider = (
    <div style={{ width: 1, height: 20, background: C.divider, flexShrink: 0 }} />
  );

  // CT stat buttons: use CT_DEFAULT_STAT_BUTTONS, ignore 'processes' from userSettings
  const statButtonKeys = (userSettings.stat_buttons || CT_DEFAULT_STAT_BUTTONS)
    .filter(k => k !== 'processes');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-card)',
      boxShadow: 'var(--shadow-subtle)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      height: '100%'
    }}>
      {/* Bar row */}
      <div
        style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          flexShrink: 0,
        }}
      >
        {/* M° button */}
        <img
          src="/meridian-icon-512.png"
          width={32}
          height={32}
          style={{ borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
          onClick={() => onOpenDashboard && onOpenDashboard()}
        />

        {divider}

        {/* + Case quick-trigger button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {showCaseInput ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <input
                type="text"
                placeholder="Case #"
                value={caseInput}
                onChange={e => setCaseInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && caseInput.length >= 8) {
                    onStartCase && onStartCase(caseInput);
                    setCaseInput('');
                    setShowCaseInput(false);
                  }
                  if (e.key === 'Escape') {
                    setCaseInput('');
                    setShowCaseInput(false);
                  }
                }}
                autoFocus
                style={{
                  width: 80, height: 24, padding: '0 6px', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)',
                  color: '#fff', fontSize: 11, outline: 'none',
                }}
              />
              <button
                onClick={() => {
                  if (caseInput.length >= 8) {
                    onStartCase && onStartCase(caseInput);
                    setCaseInput('');
                    setShowCaseInput(false);
                  }
                }}
                disabled={caseInput.length < 8}
                style={{
                  height: 24, padding: '0 8px', borderRadius: 6,
                  border: 'none', background: caseInput.length >= 8 ? '#003087' : 'rgba(255,255,255,0.06)',
                  color: '#fff', fontSize: 10, fontWeight: 600, cursor: caseInput.length >= 8 ? 'pointer' : 'default',
                  opacity: caseInput.length >= 8 ? 1 : 0.4,
                }}
              >Go</button>
              <button
                onClick={() => { setCaseInput(''); setShowCaseInput(false); }}
                style={{ background: 'none', border: 'none', color: C.textSec, fontSize: 12, cursor: 'pointer', padding: '0 2px' }}
              >×</button>
            </div>
          ) : (
            <button
              onClick={() => setShowCaseInput(true)}
              style={{
                height: 24, padding: '0 8px', borderRadius: 12,
                border: '1px solid rgba(0,48,135,0.3)', background: 'rgba(0,48,135,0.1)',
                color: '#4a90d9', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 3,
              }}
            >+ Case</button>
          )}
        </div>

        {/* Pill zone: PillZone for 1-2 cases; compact tab row for 3+ (tray handles detail) */}
        {cases.length >= 3 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, overflow: 'hidden', maxWidth: 220 }}>
            {cases.map(c => {
              const isFocused = c.id === focusedCaseId
              const dotColor = c.awaiting ? '#fbbf24' : c.paused ? '#6b7280' : '#e8540a'
              return (
                <button
                  key={c.id}
                  onClick={() => onFocusCase && onFocusCase(c.id)}
                  title={c.awaiting ? `#${c.caseNum} – awaiting` : c.paused ? `#${c.caseNum} – paused` : `#${c.caseNum}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '0 6px', height: 26, borderRadius: 5,
                    border: `1px solid ${isFocused ? 'rgba(232,84,10,0.4)' : 'rgba(255,255,255,0.12)'}`,
                    background: isFocused ? 'rgba(232,84,10,0.12)' : 'rgba(255,255,255,0.05)',
                    color: isFocused ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                    fontSize: 10, fontWeight: 500, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: 6, color: dotColor, lineHeight: 1 }}>●</span>
                  {c.caseNum}
                </button>
              )
            })}
            <button
              onClick={() => onToggleTray && onToggleTray()}
              style={{
                background: 'none', border: 'none',
                color: trayOpen ? C.process : C.textSec,
                fontSize: 10, cursor: 'pointer', padding: '0 3px', lineHeight: 1,
                transition: 'color 150ms', flexShrink: 0,
              }}
              title={trayOpen ? 'Close tray' : 'Open tray'}
            >
              {trayOpen ? '▲' : '▼'}
            </button>
          </div>
        ) : (
          <PillZone
            cases={cases}
            processes={[]}
            focusedCaseId={focusedCaseId}
            trayOpen={trayOpen}
            onFocusCase={onFocusCase}
            onPauseCase={onPauseCase}
            onResumeCase={onResumeCase}
            onCloseCase={onCloseCase}
            onLogProcess={undefined}
            onCloseProcess={undefined}
            onToggleTray={onToggleTray}
            onAwaitingCase={onAwaitingCase}
            onNotACase={onNotACase}
          />
        )}

        <div style={{ flex: 1 }} />

        {/* Stat buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {statButtonKeys.map(btnKey => {
            const cfg = STAT_BUTTON_CONFIG[btnKey]
            if (!cfg) return null
            let value
            if (cfg.key === null) {
              // total — sum whichever stats are in total_includes
              const includes = userSettings.total_includes || DEFAULT_SETTINGS.total_includes
              value = includes.filter(k => k !== 'processes').reduce((sum, k) => sum + (stats[k] || 0), 0)
            } else {
              value = stats[cfg.key] || 0
            }
            const labelText = `${value} ${cfg.label}`
            const STAT_BUTTON_HANDLERS = {
              resolved:  onResolve,
              reclass:   onReclass,
              calls:     onCall,
              total:     null,
            }
            const STAT_BUTTON_DISABLED = {
              resolved:  !hasFocused,
              reclass:   !hasFocused,
              calls:     false,
              total:     true,
            }
            return (
              <StatButton
                key={btnKey}
                icon={cfg.icon}
                label={labelText}
                color={cfg.color}
                onClick={STAT_BUTTON_HANDLERS[btnKey] || undefined}
                disabled={STAT_BUTTON_DISABLED[btnKey] ?? false}
              />
            )
          })}
        </div>

        {/* Snap to corner button (hidden) */}
        {false && onSnapToCorner && (
          <SnapButton onClick={onSnapToCorner} />
        )}

        {/* Connection status dot */}
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: connDotColor, flexShrink: 0 }} />

        {/* Minimize button */}
        <MinimizeButton onClick={() => onMinimize && onMinimize()} />

      </div>

      {/* Tray / overlay slot */}
      {children ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {children}
        </div>
      ) : null}

      {/* PiP toast — fixed bottom, auto-dismisses after 2s */}
      {pipToast && (
        <div style={{
          position: 'fixed',
          bottom: 8,
          left: 8,
          right: 8,
          background: '#dc2626',
          color: '#fff',
          borderRadius: 6,
          padding: '5px 10px',
          fontSize: 11,
          fontWeight: 600,
          textAlign: 'center',
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          {pipToast}
        </div>
      )}
    </div>
  );
}
