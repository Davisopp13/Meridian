import { Play, Pause, Clock, Plus } from 'lucide-react'
import { C, formatElapsed } from '../lib/constants.js';

const CONNECTION_COLORS = { connected: '#4ade80', degraded: '#fbbf24', offline: '#f87171' };

/**
 * MplPipBar — MPL widget bar (processes only).
 *
 * Props:
 *   processes        — [{ id, elapsed, paused }]
 *   overlayActive    — boolean (picker or manual entry open — hides process rows)
 *   processCount     — number (today's completed processes)
 *   onOpenDashboard  — click M° logo
 *   onStart          — add a new timer
 *   onQuickLog       — open manual entry
 *   onPause(id)      — pause a specific timer
 *   onResume(id)     — resume a specific timer
 *   onLog(id)        — open category picker for a specific timer
 *   onDiscard(id)    — discard a specific timer
 *   onMinimize       — minimize to strip
 *   onRestore        — restore from strip
 *   isMinimized      — boolean
 *   connectionStatus — 'connected' | 'degraded' | 'offline'
 *   pipToast         — string or null
 *   children         — overlay slot (ProcessPicker, ManualEntryForm)
 */
export default function MplPipBar({
  processes = [],
  overlayActive = false,
  processCount = 0,
  onOpenDashboard,
  onStart,
  onQuickLog,
  onPause,
  onResume,
  onLog,
  onDiscard,
  onMinimize,
  onRestore,
  isMinimized = false,
  connectionStatus = 'connected',
  pipToast = null,
  children,
}) {
  const connDotColor = CONNECTION_COLORS[connectionStatus] || '#4ade80';
  const hasProcesses = processes.length > 0;
  const runningCount = processes.filter(p => !p.paused).length;

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
    );
  }

  const divider = (
    <div style={{ width: 1, height: 20, background: C.divider, flexShrink: 0 }} />
  );

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
          {!hasProcesses ? (
            /* Idle state — no active timers */
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
            /* Active timers — show summary badge + Add button */
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                height: 26, padding: '0 8px', borderRadius: 13,
                background: runningCount > 0 ? 'rgba(96,165,250,0.12)' : 'rgba(245,158,11,0.12)',
                border: `1px solid ${runningCount > 0 ? 'rgba(96,165,250,0.25)' : 'rgba(245,158,11,0.25)'}`,
                flexShrink: 0,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: runningCount > 0 ? '#60a5fa' : 'rgba(245,158,11,0.6)',
                }} />
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: runningCount > 0 ? '#60a5fa' : '#fbbf24',
                  fontFamily: '"Inter", system-ui, sans-serif',
                }}>
                  {processes.length} timer{processes.length > 1 ? 's' : ''}
                </span>
              </div>

              <button
                onClick={() => onStart && onStart()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  height: 26, padding: '0 10px', borderRadius: 13,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-sec)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: '"Inter", system-ui, sans-serif', flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                <Plus size={10} />
                Add
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

        {/* Connection dot */}
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: connDotColor, flexShrink: 0 }} />

        {/* Minimize button */}
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

      {/* ── Process rows (hidden when overlay is active) ──────────── */}
      {hasProcesses && !overlayActive && processes.map(p => (
        <div
          key={p.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 12px',
            height: 44, flexShrink: 0,
            borderTop: '1px solid var(--border)',
            fontFamily: '"Inter", system-ui, sans-serif',
          }}
        >
          {/* Running indicator dot */}
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: p.paused ? 'rgba(245,158,11,0.5)' : '#60a5fa',
          }} />

          {/* Elapsed */}
          <span style={{
            fontSize: 13, fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: p.paused ? '#fbbf24' : 'var(--text-pri)',
            flex: 1, letterSpacing: '-0.2px',
            fontFamily: '"Inter", system-ui, sans-serif',
          }}>
            {formatElapsed(p.elapsed)}
          </span>

          {/* Pause / Resume */}
          <button
            onClick={() => p.paused ? (onResume && onResume(p.id)) : (onPause && onPause(p.id))}
            title={p.paused ? 'Resume' : 'Pause'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 6, border: 'none',
              background: p.paused ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.07)',
              color: p.paused ? '#fbbf24' : 'var(--text-sec)',
              cursor: 'pointer', flexShrink: 0, padding: 0,
            }}
          >
            {p.paused ? <Play size={11} /> : <Pause size={11} />}
          </button>

          {/* Log */}
          <button
            onClick={() => onLog && onLog(p.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 6, border: 'none',
              background: 'rgba(96,165,250,0.18)', color: '#60a5fa',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: '"Inter", system-ui, sans-serif', flexShrink: 0,
            }}
          >
            <Clock size={10} />
            Log
          </button>

          {/* Discard */}
          <button
            onClick={() => onDiscard && onDiscard(p.id)}
            title="Discard"
            style={{
              width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', fontSize: 13, flexShrink: 0, borderRadius: 4, padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      ))}

      {/* ── Overlay slot (ProcessPicker, ManualEntryForm) ─────────── */}
      {children}
    </div>
  );
}
