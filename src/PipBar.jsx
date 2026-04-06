import { useState } from 'react';
import { C, formatElapsed, DEFAULT_SETTINGS } from './lib/constants.js';
import PillZone from './components/PillZone.jsx';
import StatButton from './components/StatButton.jsx';
import MinimizeButton from './components/MinimizeButton.jsx';
import MinimizedStrip from './components/MinimizedStrip.jsx';
import { Check, Phone, ClipboardList, CornerUpLeft } from 'lucide-react';

const STAT_BUTTON_CONFIG = {
  resolved:  { icon: <Check size={14} strokeWidth={2.5} />, label: 'Resolved',  color: C.resolved,    key: 'resolved' },
  reclass:   { icon: <CornerUpLeft size={14} strokeWidth={2.5} />, label: 'Reclass',   color: C.reclass,     key: 'reclass' },
  calls:     { icon: <Phone size={14} strokeWidth={2.5} />, label: 'Calls',      color: C.calls,       key: 'calls' },
  processes: { icon: <ClipboardList size={14} strokeWidth={2.5} />, label: 'Processes', color: C.processNavy, key: 'processes' },
  total:     { icon: null,  label: 'Total',      color: C.process,     key: null },
}

/**
 * PipBar — rendered into the PiP window via ReactDOM.createRoot.
 * All state flows in as props. All actions fire callbacks up to App.jsx.
 *
 * Props:
 *   cases            — array of { id, caseNum, elapsed, paused, awaiting }
 *   processes        — array of { id, elapsed }
 *   focusedCaseId    — id of focused case (or null)
 *   trayOpen         — bool
 *   isMinimized      — bool — when true, renders compact restore strip
 *   stats            — { resolved, reclass, calls, processes }
 *   onOpenDashboard  — click M° button
 *   onMinimize       — click — button
 *   onRestore        — click restore strip
 *   onToggleTray     — chevron click
 *   onFocusCase(id)
 *   onPauseCase(id)
 *   onResumeCase(id)
 *   onCloseCase(id)
 *   onLogProcess(id)
 *   onCloseProcess(id)
 *   onResolve        — stat button: resolve focused case
 *   onReclass        — stat button: reclass focused case
 *   onCall           — stat button: log call on focused case
 *   onNewProcess     — stat button: start/open process picker
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

export default function PipBar({
  cases = [],
  processes = [],
  focusedCaseId = null,
  trayOpen = false,
  isMinimized = false,
  stats = { resolved: 0, reclass: 0, calls: 0, processes: 0 },
  onOpenDashboard,
  onMinimize,
  onRestore,
  onToggleTray,
  onFocusCase,
  onPauseCase,
  onResumeCase,
  onCloseCase,
  onLogProcess,
  onCloseProcess,
  onResolve,
  onReclass,
  onCall,
  onNewProcess,
  userSettings = DEFAULT_SETTINGS,
  pipToast = null,
  connectionStatus = 'connected',
  todayScorecard = { resolved: 0, calls: 0, processEntries: 0 },
  activeStripSession = null,
  onStripSwap,
  hasPendingActivity = false,
  onProcessPause,
  onProcessResume,
  onProcessLog,
  onProcessDiscard,
  onSnapToCorner,
  children,
}) {
  console.log('[PipBar] onSnapToCorner prop:', typeof onSnapToCorner);
  const CONNECTION_COLORS = { connected: '#4ade80', degraded: '#fbbf24', offline: '#f87171' }
  const connDotColor = CONNECTION_COLORS[connectionStatus] || '#4ade80'
  // ── Minimized restore strip ──────────────────────────────────────────────
  if (isMinimized) {
    const focusedCase = focusedCaseId ? cases.find(c => c.id === focusedCaseId) : (cases[0] || null)
    const activeProcess = processes[0] || null
    return (
      <MinimizedStrip
        focusedCase={focusedCase}
        activeProcess={activeProcess}
        activeStripSession={activeStripSession}
        connectionStatus={connectionStatus}
        todayScorecard={todayScorecard}
        hasPendingActivity={hasPendingActivity}
        onRestore={onRestore}
        onOpenDashboard={onOpenDashboard}
        onStripSwap={onStripSwap}
        onPauseCase={onPauseCase}
        onResumeCase={onResumeCase}
        onProcessPause={onProcessPause}
        onProcessResume={onProcessResume}
        onProcessLog={onProcessLog}
        onProcessDiscard={onProcessDiscard}
      />
    )
  }

  // ── Stat button disabled: no focused case ────────────────────────────────
  const hasFocused = !!focusedCaseId;
  const hasActiveProcess = processes.length > 0;

  // ── Full bar ─────────────────────────────────────────────────────────────
  const divider = (
    <div style={{ width: 1, height: 20, background: C.divider, flexShrink: 0 }} />
  );

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
      {/* Bar row — fits within the new 60px height (using 60px root, padded) */}
      <div
        style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          flexShrink: 0,
          fontFamily: '"Inter", system-ui, sans-serif',
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

        {/* Pill zone: up to 2 case pills + 2 process pills + chevron */}
        <PillZone
          cases={cases}
          processes={processes}
          focusedCaseId={focusedCaseId}
          trayOpen={trayOpen}
          onFocusCase={onFocusCase}
          onPauseCase={onPauseCase}
          onResumeCase={onResumeCase}
          onCloseCase={onCloseCase}
          onLogProcess={onLogProcess}
          onCloseProcess={onCloseProcess}
          onToggleTray={onToggleTray}
        />

        <div style={{ flex: 1 }} />
        {/* Stat buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {(userSettings.stat_buttons || DEFAULT_SETTINGS.stat_buttons).map(btnKey => {
            const cfg = STAT_BUTTON_CONFIG[btnKey]
            if (!cfg) return null
            let value
            if (cfg.key === null) {
              // total — sum whichever stats are in total_includes
              const includes = userSettings.total_includes || DEFAULT_SETTINGS.total_includes
              value = includes.reduce((sum, k) => sum + (stats[k] || 0), 0)
            } else {
              value = stats[cfg.key] || 0
            }
            const labelText = `${value} ${cfg.label}`
            const STAT_BUTTON_HANDLERS = {
              resolved:  onResolve,
              reclass:   onReclass,
              calls:     onCall,
              processes: onNewProcess,
              total:     null,
            }
            const STAT_BUTTON_DISABLED = {
              resolved:  !hasFocused,
              reclass:   !hasFocused,
              calls:     !hasFocused,
              processes: false,
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
        {/* Snap to corner button */}
        {onSnapToCorner && (
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
          fontFamily: '"Inter", system-ui, sans-serif',
        }}>
          {pipToast}
        </div>
      )}
    </div>
  );
}
