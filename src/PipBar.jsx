import { C, formatElapsed } from './lib/constants.js';
import MButton from './components/MButton.jsx';
import PillZone from './components/PillZone.jsx';
import StatButton from './components/StatButton.jsx';
import MinimizeButton from './components/MinimizeButton.jsx';
import MinimizedStrip from './components/MinimizedStrip.jsx';
import { Check, Phone } from 'lucide-react';

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
  children,
}) {
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
      background: '#ffffff',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      border: '1px solid rgba(0,0,0,0.05)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MButton onClick={() => onOpenDashboard && onOpenDashboard()} />
          <span style={{
            color: C.textPri,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            fontFamily: '"Inter", system-ui, sans-serif'
          }}>
            Meridian
          </span>
        </div>

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
