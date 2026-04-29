import { formatElapsed } from '../lib/constants.js'
import { Check, Phone, FileText, Pause, Play, X, Clock } from 'lucide-react'

const iconBtnStyle = {
  background: 'transparent',
  border: 'none',
  padding: '2px 3px',
  borderRadius: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 18,
  height: 18,
}

/**
 * MinimizedStrip — 220×32px compact PiP strip with 3 zones.
 *
 * Zone 1 (left, 32px): Logo — click opens dashboard
 * Zone 2 (flex 1): Session content — varies by state, strip click restores
 * Zone 3 (right, ~68px): Scorecard — resolved / calls / processEntries + connection dot
 *
 * Props:
 *   focusedCase         — { id, caseNum, elapsed, paused } | null
 *   activeProcess       — { id, elapsed, paused } | null
 *   activeStripSession  — { type: 'case'|'process', session } | null
 *   connectionStatus    — 'connected' | 'degraded' | 'offline'
 *   todayScorecard      — { resolved, calls, processEntries }
 *   hasPendingActivity  — bool — pulses logo when bookmarklet fired while minimized
 *   onRestore           — () => void
 *   onOpenDashboard     — () => void
 *   onStripSwap         — () => void
 *   onPauseCase(id)
 *   onResumeCase(id)
 *   onProcessPause(id)
 *   onProcessResume(id)
 *   onProcessLog(id)
 *   onProcessDiscard(id)
 */
export default function MinimizedStrip({
  focusedCase = null,
  activeProcess = null,
  activeStripSession = null,
  connectionStatus = 'connected',
  todayScorecard = { resolved: 0, calls: 0, processEntries: 0 },
  hasPendingActivity = false,
  onRestore,
  onOpenDashboard,
  onStripSwap,
  onPauseCase,
  onResumeCase,
  onAwaitingCase,
  onResumeAwaitingCase,
  onProcessPause,
  onProcessResume,
  onProcessLog,
  onProcessDiscard,
}) {
  const CONNECTION_COLORS = { connected: '#4ade80', degraded: '#fbbf24', offline: '#f87171' }
  const connDotColor = CONNECTION_COLORS[connectionStatus] || '#4ade80'

  const bothActive = !!focusedCase && !!activeProcess
  const showType = activeStripSession?.type

  // ── Zone 2 content by state ─────────────────────────────────────────────
  let zone2Content

  if (!focusedCase && !activeProcess) {
    // Idle
    zone2Content = (
      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, fontStyle: 'italic', paddingLeft: 8 }}>ready</span>
    )
  } else if (focusedCase && !activeProcess) {
    // Case only
    zone2Content = (
      <>
        <span style={{
          color: 'var(--color-mmark)', fontSize: 10, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          paddingLeft: 8, flexShrink: 1, minWidth: 0,
        }}>
          #{focusedCase.caseNum}
        </span>
        <span style={{
          color: 'rgba(255,255,255,0.85)', fontSize: 10,
          fontVariantNumeric: 'tabular-nums', flexShrink: 0, paddingLeft: 4,
        }}>
          {formatElapsed(focusedCase.elapsed)}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={e => {
              e.stopPropagation()
              focusedCase.paused ? onResumeCase?.(focusedCase.id) : onPauseCase?.(focusedCase.id)
            }}
            title={focusedCase.paused ? 'Resume from pause' : 'Pause (agent stepped away)'}
            style={{ ...iconBtnStyle, color: focusedCase.paused ? '#4ade80' : 'rgba(255,255,255,0.7)' }}
          >
            {focusedCase.paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
          <button
            onClick={e => {
              e.stopPropagation()
              focusedCase.awaiting ? onResumeAwaitingCase?.(focusedCase.id) : onAwaitingCase?.(focusedCase.id)
            }}
            title={focusedCase.awaiting ? 'Resume from awaiting' : 'Awaiting customer reply'}
            style={{ ...iconBtnStyle, color: focusedCase.awaiting ? '#fbbf24' : 'rgba(255,255,255,0.7)' }}
          >
            {focusedCase.awaiting ? <Play size={12} /> : <Clock size={12} />}
          </button>
        </div>
      </>
    )
  } else if (!focusedCase && activeProcess) {
    // Process only — static dot (blue normally, amber when paused)
    zone2Content = (
      <>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: activeProcess.paused ? '#fbbf24' : '#4da6ff',
          flexShrink: 0, marginLeft: 8,
        }} />
        <span style={{
          color: '#4da6ff', fontSize: 10, fontVariantNumeric: 'tabular-nums', paddingLeft: 4,
        }}>
          {formatElapsed(activeProcess.elapsed)}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          <button
            onClick={e => {
              e.stopPropagation()
              activeProcess.paused ? onProcessResume?.(activeProcess.id) : onProcessPause?.(activeProcess.id)
            }}
            style={{ ...iconBtnStyle, color: '#4da6ff' }}
          >
            {activeProcess.paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onProcessLog?.(activeProcess.id) }}
            style={{ ...iconBtnStyle, color: '#4da6ff' }}
          >
            <FileText size={12} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onProcessDiscard?.(activeProcess.id) }}
            style={{ ...iconBtnStyle, color: '#f87171' }}
          >
            <X size={12} />
          </button>
        </div>
      </>
    )
  } else if (bothActive && showType === 'process') {
    // Both active — showing process: pulsing orange dot (case is hidden)
    zone2Content = (
      <>
        <div
          className="swap-dot-pulse"
          onClick={e => { e.stopPropagation(); onStripSwap?.() }}
          style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--color-mmark)',
            flexShrink: 0, marginLeft: 8, cursor: 'pointer',
          }}
        />
        <span style={{
          color: '#4da6ff', fontSize: 10, fontVariantNumeric: 'tabular-nums', paddingLeft: 4,
        }}>
          {formatElapsed(activeProcess.elapsed)}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          <button
            onClick={e => {
              e.stopPropagation()
              activeProcess.paused ? onProcessResume?.(activeProcess.id) : onProcessPause?.(activeProcess.id)
            }}
            style={{ ...iconBtnStyle, color: '#4da6ff' }}
          >
            {activeProcess.paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onProcessLog?.(activeProcess.id) }}
            style={{ ...iconBtnStyle, color: '#4da6ff' }}
          >
            <FileText size={12} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onProcessDiscard?.(activeProcess.id) }}
            style={{ ...iconBtnStyle, color: '#f87171' }}
          >
            <X size={12} />
          </button>
        </div>
      </>
    )
  } else if (bothActive && showType === 'case') {
    // Both active — showing case: pulsing blue dot (process is hidden)
    zone2Content = (
      <>
        <div
          className="swap-dot-pulse"
          onClick={e => { e.stopPropagation(); onStripSwap?.() }}
          style={{
            width: 6, height: 6, borderRadius: '50%', background: '#4da6ff',
            flexShrink: 0, marginLeft: 8, cursor: 'pointer',
          }}
        />
        <span style={{
          color: 'var(--color-mmark)', fontSize: 10, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          paddingLeft: 4, flexShrink: 1, minWidth: 0,
        }}>
          #{focusedCase.caseNum}
        </span>
        <span style={{
          color: 'rgba(255,255,255,0.85)', fontSize: 10,
          fontVariantNumeric: 'tabular-nums', flexShrink: 0, paddingLeft: 4,
        }}>
          {formatElapsed(focusedCase.elapsed)}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={e => {
              e.stopPropagation()
              focusedCase.paused ? onResumeCase?.(focusedCase.id) : onPauseCase?.(focusedCase.id)
            }}
            title={focusedCase.paused ? 'Resume from pause' : 'Pause (agent stepped away)'}
            style={{ ...iconBtnStyle, color: focusedCase.paused ? '#4ade80' : 'rgba(255,255,255,0.7)' }}
          >
            {focusedCase.paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
          <button
            onClick={e => {
              e.stopPropagation()
              focusedCase.awaiting ? onResumeAwaitingCase?.(focusedCase.id) : onAwaitingCase?.(focusedCase.id)
            }}
            title={focusedCase.awaiting ? 'Resume from awaiting' : 'Awaiting customer reply'}
            style={{ ...iconBtnStyle, color: focusedCase.awaiting ? '#fbbf24' : 'rgba(255,255,255,0.7)' }}
          >
            {focusedCase.awaiting ? <Play size={12} /> : <Clock size={12} />}
          </button>
        </div>
      </>
    )
  }

  return (
    <div
      onClick={() => onRestore?.()}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.12)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '0.5px solid rgba(255,255,255,0.18)',
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Zone 1: Logo */}
      <div
        onClick={e => { e.stopPropagation(); onOpenDashboard?.() }}
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderRight: '0.5px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
        }}
      >
        <img
          src="/meridian-icon-512.png"
          width={20}
          height={20}
          style={{ objectFit: 'contain' }}
          className={hasPendingActivity ? 'swap-dot-pulse' : undefined}
        />
      </div>

      {/* Zone 2: Session content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        {zone2Content}
      </div>

      {/* Zone 3: Scorecard */}
      <div style={{
        width: 68,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        flexShrink: 0,
        borderLeft: '0.5px solid rgba(255,255,255,0.2)',
        paddingLeft: 4,
        paddingRight: 4,
        boxSizing: 'border-box',
      }}>
        <span style={{ color: '#4ade80', fontSize: 9, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Check size={9} strokeWidth={3} />{todayScorecard.resolved}
        </span>
        <span style={{ color: '#4da6ff', fontSize: 9, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Phone size={9} strokeWidth={3} />{todayScorecard.calls}
        </span>
        <span style={{ color: '#94a3b8', fontSize: 9, display: 'flex', alignItems: 'center', gap: 1 }}>
          <FileText size={9} strokeWidth={3} />{todayScorecard.processEntries}
        </span>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: connDotColor, flexShrink: 0 }} />
      </div>
    </div>
  )
}
