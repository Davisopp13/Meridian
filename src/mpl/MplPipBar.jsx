import { C, formatElapsed } from '../lib/constants.js';

const CONNECTION_COLORS = { connected: '#4ade80', degraded: '#fbbf24', offline: '#f87171' };

/**
 * MplPipBar — MPL widget bar (processes only). Built from scratch.
 *
 * Props:
 *   activeProcess    — { id, elapsed, paused } or null
 *   processCount     — number (today's completed processes)
 *   mplState         — 'idle' | 'timerActive' | 'categoryPicker' | 'manualEntry'
 *   onOpenDashboard  — click M° logo
 *   onStart          — click Open button (opens/activates widget)
 *   onQuickLog       — click Quick Log button (opens manual entry)
 *   onLog            — click Log button (opens category picker for active timer)
 *   onDiscard        — click Discard button
 *   onPause          — pause active process
 *   onResume         — resume paused process
 *   onMinimize       — minimize to strip
 *   onRestore        — restore from strip
 *   isMinimized      — boolean
 *   connectionStatus — 'connected' | 'degraded' | 'offline'
 *   pipToast         — string or null
 *   children         — overlay/picker slot
 */
export default function MplPipBar({
  activeProcess = null,
  processCount = 0,
  mplState = 'idle',
  onOpenDashboard,
  onStart,
  onQuickLog,
  onLog,
  onDiscard,
  onPause,
  onResume,
  onMinimize,
  onRestore,
  isMinimized = false,
  connectionStatus = 'connected',
  pipToast = null,
  children,
}) {
  const connDotColor = CONNECTION_COLORS[connectionStatus] || '#4ade80';

  // ── Minimized restore strip ───────────────────────────────────────
  if (isMinimized) {
    return (
      <div
        onClick={() => onRestore && onRestore()}
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: '"Inter", system-ui, sans-serif',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-sec)',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 11, color: '#60a5fa' }}>▲</span>
        <span>Meridian — Processes</span>
        {activeProcess && (
          <span style={{ color: '#60a5fa', fontVariantNumeric: 'tabular-nums' }}>
            {formatElapsed(activeProcess.elapsed)}
          </span>
        )}
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: connDotColor, flexShrink: 0 }} />
      </div>
    );
  }

  // ── Full bar ─────────────────────────────────────────────────────
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
      height: '100%',
      minHeight: 0,
    }}>
      {/* Bar row */}
      <div style={{
        minHeight: 64,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 8,
        flexShrink: 0,
        fontFamily: '"Inter", system-ui, sans-serif',
        position: 'relative',
      }}>
        {/* M° logo */}
        <img
          src="/meridian-icon-512.png"
          width={32}
          height={32}
          style={{ borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
          onClick={() => onOpenDashboard && onOpenDashboard()}
        />

        {divider}

        {/* Center content: idle or timer active */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {mplState === 'idle' && (
            <>
              {/* Open button */}
              <button
                onClick={() => onStart && onStart()}
                style={{
                  height: 28,
                  padding: '0 14px',
                  borderRadius: 14,
                  background: 'rgba(96,165,250,0.15)',
                  border: '1px solid rgba(96,165,250,0.3)',
                  color: '#60a5fa',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: '"Inter", system-ui, sans-serif',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                ▶ Open
              </button>

              {/* Quick Log button */}
              <button
                onClick={() => onQuickLog && onQuickLog()}
                style={{
                  height: 28,
                  padding: '0 14px',
                  borderRadius: 14,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-sec)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: '"Inter", system-ui, sans-serif',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Quick Log
              </button>
            </>
          )}

          {(mplState === 'timerActive' || mplState === 'categoryPicker') && activeProcess && (
            <>
              {/* Active process pill */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                height: 26,
                padding: '0 8px',
                borderRadius: 13,
                background: 'rgba(96,165,250,0.12)',
                border: '1px solid rgba(96,165,250,0.25)',
                flexShrink: 0,
                minWidth: 0,
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: activeProcess.paused ? 'rgba(96,165,250,0.4)' : '#60a5fa',
                  flexShrink: 0,
                  animation: activeProcess.paused ? 'none' : undefined,
                }} />
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#60a5fa',
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: '"Inter", system-ui, sans-serif',
                }}>
                  {formatElapsed(activeProcess.elapsed)}
                </span>
                {/* Pause / Resume button */}
                <button
                  onClick={() => activeProcess.paused
                    ? (onResume && onResume())
                    : (onPause && onPause())
                  }
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 9,
                    color: 'rgba(96,165,250,0.6)',
                    lineHeight: 1,
                    marginLeft: 2,
                  }}
                >
                  {activeProcess.paused ? '▶' : '⏸'}
                </button>
              </div>

              {/* Log button */}
              <button
                onClick={() => onLog && onLog()}
                style={{
                  height: 28,
                  padding: '0 14px',
                  borderRadius: 14,
                  background: 'rgba(96,165,250,0.15)',
                  border: '1px solid rgba(96,165,250,0.3)',
                  color: '#60a5fa',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: '"Inter", system-ui, sans-serif',
                  flexShrink: 0,
                }}
              >
                Log
              </button>

              {/* Discard button */}
              <button
                onClick={() => onDiscard && onDiscard()}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  fontFamily: '"Inter", system-ui, sans-serif',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </>
          )}

          {mplState === 'manualEntry' && (
            <span style={{
              fontSize: 11,
              color: 'var(--text-sec)',
              fontFamily: '"Inter", system-ui, sans-serif',
            }}>
              Quick Log
            </span>
          )}
        </div>

        {divider}

        {/* Process count stat */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 40,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#60a5fa',
            lineHeight: 1,
            fontFamily: '"Inter", system-ui, sans-serif',
          }}>
            {processCount}
          </span>
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginTop: 1,
            fontFamily: '"Inter", system-ui, sans-serif',
          }}>
            Done
          </span>
        </div>

        {divider}

        {/* Connection dot */}
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: connDotColor,
          flexShrink: 0,
        }} />

        {/* Minimize button */}
        <button
          onClick={() => onMinimize && onMinimize()}
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-sec)',
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
            borderRadius: 4,
            fontFamily: '"Inter", system-ui, sans-serif',
          }}
          title="Minimize"
        >
          —
        </button>
      </div>

      {/* Toast */}
      {pipToast && (
        <div style={{
          padding: '6px 12px',
          fontSize: 10,
          fontWeight: 600,
          color: '#60a5fa',
          background: 'rgba(96,165,250,0.08)',
          borderTop: '1px solid rgba(96,165,250,0.15)',
          fontFamily: '"Inter", system-ui, sans-serif',
          textAlign: 'center',
        }}>
          {pipToast}
        </div>
      )}

      {/* Children slot (CategoryDrillDown, ManualEntryForm, etc.) */}
      {children}
    </div>
  );
}
