import { C } from '../lib/constants.js'
import ProcessesLane from '../components/ProcessesLane.jsx'
import ProcessPill from '../components/ProcessPill.jsx'
import ManualEntryForm from '../components/ManualEntryForm.jsx'
import ProcessPicker from '../components/overlays/ProcessPicker.jsx'
import RecoveryPrompt from './RecoveryPrompt.jsx'


/**
 * MplPipBar — MPL widget bar (processes only).
 *
 * Props:
 *   processes            — [{ id, elapsed, paused }]
 *   categories           — mpl_categories rows (for ProcessesLane / ManualEntryForm)
 *   showSwimlane         — boolean — process-active mode (shows pills on bar)
 *   swimlaneOpen         — boolean — tray drawer is expanded
 *   chipStripProcessId   — string|null — process ID whose chip strip is showing
 *   processCount         — number (today's completed processes)
 *   onOpenDashboard      — click M° logo
 *   onStart              — add a new timer (idle: Processes button; active: + Add)
 *   onQuickLog           — open manual entry
 *   onConfirmProcess(id, categoryId, subcategoryId, durationSeconds) — log a process
 *   onCancelProcess(id)  — discard a process
 *   onChipStripConfirm(processId, catId, subId) — log via chip strip
 *   onChipStripCancel()  — close chip strip without logging
 *   onToggleSwimlane     — chevron click
 *   onMinimize           — minimize to strip
 *   onRestore            — restore from strip
 *   isMinimized          — boolean
 *   connectionStatus     — 'connected' | 'degraded' | 'offline'
 *   pipToast             — string or null
 *   children             — overlay slot (ManualEntryForm)
 */
export default function MplPipBar({
  userId,
  processes = [],
  categories = [],
  showSwimlane = false,
  swimlaneOpen = false,
  chipStripProcessId = null,
  onToggleSwimlane,
  totalActivity = 0,
  processCount = 0,
  onOpenDashboard,
  onStart,
  onQuickLog,
  onConfirmProcess,
  onCancelProcess,
  onLogProcess,
  onChipStripConfirm,
  onChipStripCancel,
  quickLogOpen = false,
  onQuickLogConfirm,
  onQuickLogCancel,
  onCallLog,
  callsCount = 0,
  onMinimize,
  onRestore,
  isMinimized = false,
  connectionStatus = 'connected', // unused — preserved for future connection-indicator work
  pipToast = null,
  recoveredProcesses = [],
  onRecoveryResume,
  onRecoveryLogNow,
  onRecoveryDiscard,
  children,
}) {
  const hasProcesses = processes.length > 0
  const runningCount = processes.filter(p => !p.paused).length

  // Process whose chip strip is active (for elapsed display)
  const chipStripProcess = chipStripProcessId
    ? processes.find(p => p.id === chipStripProcessId)
    : null

  // ── Minimized restore strip ───────────────────────────────────────
  if (isMinimized) {
    return (
      <div
        onClick={() => onRestore && onRestore()}
        style={{
          height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
          cursor: 'pointer',
          fontSize: 10, fontWeight: 600, color: 'var(--text-sec)', userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 11, color: '#60a5fa' }}>▲</span>
        <span>Meridian — Processes</span>
        {hasProcesses && (
          <span style={{ color: '#60a5fa' }}>
            {processes.length} timer{processes.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    )
  }

  const divider = (
    <div style={{ width: 1, height: 20, background: C.divider, flexShrink: 0 }} />
  )

  // Up to 2 process pills shown inline in the bar
  const visibleProcesses = processes.slice(0, 2)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-card)', boxShadow: 'var(--shadow-subtle)',
      border: '1px solid var(--border)', borderRadius: 12,
      overflow: 'hidden', height: '100%', minHeight: 0,
      position: 'relative',
    }}>
      {/* ── Bar row ──────────────────────────────────────────────── */}
      <div style={{
        minHeight: 64, display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 8, flexShrink: 0, position: 'relative',
      }}>
        {/* M° logo */}
        <img
          src="/meridian-icon-512.png"
          width={32} height={32}
          style={{ borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
          onClick={() => onOpenDashboard && onOpenDashboard()}
        />

        {divider}

        {/* Center content */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {!showSwimlane ? (
            /* Idle — no processes active */
            <>
              <button
                onClick={() => onStart && onStart()}
                style={{
                  height: 28, padding: '0 14px', borderRadius: 14,
                  background: '#60a5fa', border: 'none',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                {processCount} Processes
              </button>
              <button
                onClick={() => onQuickLog && onQuickLog()}
                style={{
                  height: 28, padding: '0 14px', borderRadius: 14,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                Quick Log
              </button>
              <button
                onClick={() => onCallLog && onCallLog()}
                style={{
                  height: 28, padding: '0 14px', borderRadius: 14,
                  background: '#0d9488', border: 'none',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                {callsCount} Calls
              </button>
            </>
          ) : (
            /* Processes active — inline pills + Quick Log + chevron */
            <>
              {/* Inline process pills (up to 2) */}
              {visibleProcesses.map(p => (
                <ProcessPill
                  key={p.id}
                  elapsed={p.elapsed}
                  onLog={() => onLogProcess && onLogProcess(p.id)}
                  onClose={() => onCancelProcess && onCancelProcess(p.id)}
                />
              ))}

              {/* If more than 2, show overflow count badge */}
              {processes.length > 2 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  height: 26, padding: '0 8px', borderRadius: 13, flexShrink: 0,
                  background: runningCount > 0 ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${runningCount > 0 ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: runningCount > 0 ? '#60a5fa' : 'var(--text-sec)',
                  }}>
                    +{processes.length - 2}
                  </span>
                </div>
              )}

              <button
                onClick={() => onToggleSwimlane && onToggleSwimlane()}
                title={swimlaneOpen ? 'Collapse' : 'Expand timers'}
                style={{
                  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-sec)', fontSize: 10, flexShrink: 0, borderRadius: 4,
                }}
              >
                {swimlaneOpen ? '▲' : '▼'}
              </button>

              <button
                onClick={() => onQuickLog && onQuickLog()}
                style={{
                  height: 26, padding: '0 10px', borderRadius: 13,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                Quick Log
              </button>
              <button
                onClick={() => onCallLog && onCallLog()}
                style={{
                  height: 26, padding: '0 14px', borderRadius: 13,
                  background: '#0d9488', border: 'none',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                {callsCount} Calls
              </button>
            </>
          )}
        </div>

        {divider}

        <button
          onClick={() => onMinimize && onMinimize()}
          style={{
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-sec)', fontSize: 12, fontWeight: 600,
            flexShrink: 0, borderRadius: 4,
          }}
          title="Minimize"
        >
          —
        </button>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {pipToast && (
        <div style={{
          padding: '6px 12px', fontSize: 10, fontWeight: 600,
          color: '#60a5fa', background: 'rgba(96,165,250,0.08)',
          borderTop: '1px solid rgba(96,165,250,0.15)', textAlign: 'center',
        }}>
          {pipToast}
        </div>
      )}

      {/* ── Category drill-down — TIMED (process pill "Log" tap) ──── */}
      {chipStripProcessId && !quickLogOpen && (
        <ProcessPicker
          userId={userId}
          categories={categories}
          elapsed={chipStripProcess?.elapsed || 0}
          onConfirm={(catId, subId, elapsed, note) => onChipStripConfirm && onChipStripConfirm(chipStripProcessId, catId, subId, note)}
          onCancel={() => onChipStripCancel && onChipStripCancel()}
        />
      )}

      {/* ── Quick Log — UNTIMED (2-col grid matching timed Log) ─────── */}
      {quickLogOpen && !chipStripProcessId && (
        <ManualEntryForm
          userId={userId}
          categories={categories}
          onClose={() => onQuickLogCancel && onQuickLogCancel()}
          onLog={(catId, subId, minutes, note) => onQuickLogConfirm && onQuickLogConfirm(catId, subId, minutes, note)}
        />
      )}

      {/* ── Swimlane tray (only when no chip strip is active) ─────── */}
      {showSwimlane && swimlaneOpen && !chipStripProcessId && !quickLogOpen && (
        <div style={{
          flex: 1, minHeight: 0,
          borderTop: `1px solid ${C.divider}`,
          padding: '8px 0 0',
          overflow: 'hidden',
        }}>
          <ProcessesLane
            processes={processes}
            categories={categories}
            onConfirm={onConfirmProcess}
            onCancel={onCancelProcess}
            onNewProcess={onStart}
          />
        </div>
      )}

      {/* ── Overlay slot (ManualEntryForm) ─────────────────────────── */}
      {children}

      {/* ── Recovery overlay — rendered on top of everything ─────── */}
      {recoveredProcesses.length > 0 && (
        <RecoveryPrompt
          recoveredProcesses={recoveredProcesses}
          categories={categories}
          onResume={onRecoveryResume}
          onLogNow={onRecoveryLogNow}
          onDiscard={onRecoveryDiscard}
        />
      )}
    </div>
  )
}
