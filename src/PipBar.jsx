import { C } from './lib/constants.js';
import MButton from './components/MButton.jsx';
import PillZone from './components/PillZone.jsx';
import StatButton from './components/StatButton.jsx';
import MinimizeButton from './components/MinimizeButton.jsx';

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
  children,
}) {
  // ── Minimized restore strip ──────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div
        onClick={() => onRestore && onRestore()}
        style={{
          height: 36,
          background: C.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'pointer',
          userSelect: 'none',
          fontFamily: '"Segoe UI", sans-serif',
        }}
      >
        <span style={{ color: C.textSec, fontSize: 10 }}>▲</span>
        <span style={{ color: C.textPri, fontSize: 12, fontWeight: 700 }}>Meridian</span>
      </div>
    );
  }

  // ── Stat button disabled: no focused case ────────────────────────────────
  const hasFocused = !!focusedCaseId;
  const hasActiveProcess = processes.length > 0;

  // ── Full bar ─────────────────────────────────────────────────────────────
  const divider = (
    <div style={{ width: 1, height: 20, background: C.divider, flexShrink: 0 }} />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: C.bg }}>
      {/* Bar row — 36px */}
      <div
        style={{
          height: 36,
          display: 'flex',
          alignItems: 'center',
          padding: '0 6px',
          gap: 4,
          flexShrink: 0,
          fontFamily: '"Segoe UI", sans-serif',
        }}
      >
        {/* M° button */}
        <MButton onClick={() => onOpenDashboard && onOpenDashboard()} />

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

        {divider}

        {/* Stat buttons */}
        <StatButton
          label={`✓ ${stats.resolved}`}
          color={C.resolved}
          disabled={!hasFocused}
          onClick={() => hasFocused && onResolve && onResolve()}
          title="Resolved"
        />
        <StatButton
          label={`↩ ${stats.reclass}`}
          color={C.reclass}
          disabled={!hasFocused}
          onClick={() => hasFocused && onReclass && onReclass()}
          title="Reclassified"
        />
        <StatButton
          label={`📞 ${stats.calls}`}
          color={C.calls}
          disabled={!hasFocused}
          onClick={() => hasFocused && onCall && onCall()}
          title="Call"
        />
        <StatButton
          label={`📋 ${stats.processes}`}
          color={hasActiveProcess ? C.process : C.processNavy}
          active={hasActiveProcess}
          onClick={() => onNewProcess && onNewProcess()}
          title="Processes"
        />

        {divider}

        {/* Minimize button */}
        <MinimizeButton onClick={() => onMinimize && onMinimize()} />
      </div>

      {/* Tray / overlay slot */}
      {children}

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
          fontFamily: '"Segoe UI", sans-serif',
        }}>
          {pipToast}
        </div>
      )}
    </div>
  );
}
