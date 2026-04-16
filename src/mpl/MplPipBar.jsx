import { Plus } from 'lucide-react'
import { C } from '../lib/constants.js'
import ProcessesLane from '../components/ProcessesLane.jsx'

const CONNECTION_COLORS = { connected: '#4ade80', degraded: '#fbbf24', offline: '#f87171' }

/**
 * MplPipBar — MPL widget bar (processes only).
 *
 * Props:
 *   processes        — [{ id, elapsed, paused }]
 *   categories       — mpl_categories rows (for ProcessesLane)
 *   showSwimlane     — boolean — show the ProcessesLane tray below the bar
 *   processCount     — number (today's completed processes)
 *   onOpenDashboard  — click M° logo
 *   onStart          — add a new timer (▶ Open when idle, + Add when active)
 *   onQuickLog       — open manual entry
 *   onConfirmProcess(id, categoryId, subcategoryId, durationSeconds) — log a process
 *   onCancelProcess(id) — discard a process
 *   onMinimize       — minimize to strip
 *   onRestore        — restore from strip
 *   isMinimized      — boolean
 *   connectionStatus — 'connected' | 'degraded' | 'offline'
 *   pipToast         — string or null
 *   children         — overlay slot (ManualEntryForm)
 */
export default function MplPipBar({
  processes = [],
  categories = [],
  showSwimlane = false,
  swimlaneOpen = false,
  onToggleSwimlane,
  processCount = 0,
  onOpenDashboard,
  onStart,
  onQuickLog,
  onConfirmProcess,
  onCancelProcess,
  onMinimize,
  onRestore,
  isMinimized = false,
  connectionStatus = 'connected',
  pipToast = null,
  children,
}) {
  const connDotColor = CONNECTION_COLORS[connectionStatus] || '#4ade80'
  const hasProcesses = processes.length > 0
  const runningCount = processes.filter(p => !p.paused).length

  // ── Minimized restore strip ───────────────────────────────────────
  if (isMinimized) {
    return (
      <div
        onClick={() => onRestore && onRestore()}
        style={{
          height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
          cursor: 'pointer', fontFamily: '"Inter", system-ui, sans-serif',
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
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: connDotColor, flexShrink: 0 }} />
      </div>
    )
  }

  const divider = (
    <div style={{ width: 1, height: 20, background: C.divider, flexShrink: 0 }} />
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-card)', boxShadow: 'var(--shadow-subtle)',
      border: '1px solid var(--border)', borderRadius: 12,
      overflow: 'hidden', height: '100%', minHeight: 0,
    }}>
      {/* ── Bar row ──────────────────────────────────────────────── */}
      <div style={{
        minHeight: 64, display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 8, flexShrink: 0,
        fontFamily: '"Inter", system-ui, sans-serif', position: 'relative',
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
            /* Idle — no swimlane open */
            <>
              <button
                onClick={() => onStart && onStart()}
                style={{
                  height: 28, padding: '0 14px', borderRadius: 14,
                  background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)',
                  color: '#60a5fa', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  fontFamily: '"Inter", system-ui, sans-serif', flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                ▶ Open
              </button>
              <button
                onClick={() => onQuickLog && onQuickLog()}
                style={{
                  height: 28, padding: '0 14px', borderRadius: 14,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: '"Inter", system-ui, sans-serif', flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                Quick Log
              </button>
            </>
          ) : (
            /* Processes active — count badge + Quick Log + chevron */
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                height: 26, padding: '0 8px', borderRadius: 13, flexShrink: 0,
                background: hasProcesses && runningCount > 0
                  ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${hasProcesses && runningCount > 0
                  ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.1)'}`,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: hasProcesses && runningCount > 0 ? '#60a5fa' : 'rgba(255,255,255,0.2)',
                }} />
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: hasProcesses && runningCount > 0 ? '#60a5fa' : 'var(--text-sec)',
                  fontFamily: '"Inter", system-ui, sans-serif',
                }}>
                  {hasProcesses
                    ? `${processes.length} active`
                    : 'Processes'}
                </span>
              </div>

              <button
                onClick={() => onQuickLog && onQuickLog()}
                style={{
                  height: 26, padding: '0 10px', borderRadius: 13,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: '"Inter", system-ui, sans-serif', flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                Quick Log
              </button>

              <button
                onClick={() => onToggleSwimlane && onToggleSwimlane()}
                title={swimlaneOpen ? 'Collapse' : 'Expand timers'}
                style={{
                  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-sec)', fontSize: 10, flexShrink: 0, borderRadius: 4,
                  fontFamily: '"Inter", system-ui, sans-serif',
                }}
              >
                {swimlaneOpen ? '▲' : '▼'}
              </button>
            </>
          )}
        </div>

        {divider}

        {/* Process count stat */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minWidth: 40, flexShrink: 0,
        }}>
          <span style={{
            fontSize: 14, fontWeight: 700, color: '#60a5fa',
            lineHeight: 1, fontFamily: '"Inter", system-ui, sans-serif',
          }}>
            {processCount}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 600, color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 1,
            fontFamily: '"Inter", system-ui, sans-serif',
          }}>
            Done
          </span>
        </div>

        {divider}

        <span style={{ width: 6, height: 6, borderRadius: '50%', background: connDotColor, flexShrink: 0 }} />

        <button
          onClick={() => onMinimize && onMinimize()}
          style={{
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-sec)', fontSize: 12, fontWeight: 600,
            flexShrink: 0, borderRadius: 4, fontFamily: '"Inter", system-ui, sans-serif',
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
          borderTop: '1px solid rgba(96,165,250,0.15)',
          fontFamily: '"Inter", system-ui, sans-serif', textAlign: 'center',
        }}>
          {pipToast}
        </div>
      )}

      {/* ── Swimlane tray ─────────────────────────────────────────── */}
      {showSwimlane && swimlaneOpen && !children && (
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
    </div>
  )
}
