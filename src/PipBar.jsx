import { C, formatElapsed } from './lib/constants.js';
import MButton from './components/MButton.jsx';
import PillZone from './components/PillZone.jsx';
import StatButton from './components/StatButton.jsx';
import MinimizeButton from './components/MinimizeButton.jsx';
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
  children,
}) {
  // ── Minimized restore strip ──────────────────────────────────────────────
  if (isMinimized) {
    const focusedCase = focusedCaseId ? cases.find(c => c.id === focusedCaseId) : null;

    let minContent;
    if (focusedCase) {
      // Active Case Focus
      minContent = (
        <>
          <span style={{ color: C.textSec, fontSize: 10, transition: 'transform 0.2s ease' }} className="restore-arrow">▲</span>
          <span style={{ color: C.textPri, fontSize: 12, fontWeight: 600 }}>#{focusedCase.caseNum}</span>
          <span style={{ color: C.textSec, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            ({formatElapsed(focusedCase.elapsed)})
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (focusedCase.paused) {
                onResumeCase && onResumeCase(focusedCase.id);
              } else {
                onPauseCase && onPauseCase(focusedCase.id);
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '2px 6px',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 'auto', // push to right
              color: focusedCase.paused ? '#10b981' : '#f59e0b',
              fontSize: 12,
            }}
          >
            {focusedCase.paused ? '▶' : '⏸'}
          </button>
        </>
      );
    } else {
      // Summary Stats
      minContent = (
        <>
          <span style={{ color: C.textSec, fontSize: 10, transition: 'transform 0.2s ease' }} className="restore-arrow">▲</span>
          <span style={{ color: C.textPri, fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>Meridian</span>
          <div style={{ width: 1, height: 12, background: C.divider, margin: '0 4px', marginLeft: 'auto' }} />
          <div style={{ display: 'flex', gap: 6, fontSize: 11, fontWeight: 600, color: C.textSec }}>
            <span style={{ color: C.resolved, display: 'flex', alignItems: 'center', gap: 2 }}>{stats.resolved} <Check size={12} strokeWidth={3} /></span>
            <span style={{ color: C.calls, display: 'flex', alignItems: 'center', gap: 2 }}>{stats.calls} <Phone size={12} strokeWidth={3} /></span>
          </div>
        </>
      );
    }

    return (
      <div
        onClick={() => onRestore && onRestore()}
        style={{
          height: 32,
          padding: '0 12px',
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          userSelect: 'none',
          fontFamily: '"Inter", system-ui, sans-serif',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; }}
      >
        {minContent}
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
