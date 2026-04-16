import { useState, useRef, useEffect } from 'react'
import { Phone, Play, Pause, Plus, Clock } from 'lucide-react'
import { C, formatElapsed } from '../lib/constants.js'
import ProcessPicker from './overlays/ProcessPicker.jsx'
import ManualEntryForm from './ManualEntryForm.jsx'

/**
 * MplWidget — full-page MPL interface rendered at ?mode=mpl.
 *
 * Props:
 *   user           — Supabase auth user
 *   profile        — platform_users row
 *   categories     — [{ id, name, team, mpl_subcategories[] }]
 *   stats          — { resolved, reclass, calls, processes } from useStats
 *   refetch        — () refresh stats after logging
 *   onLog          — async (categoryId, subcategoryId, minutes, source) for timer entries
 *   onManualLog    — async (categoryId, subcategoryId, minutes) for manual entries
 *   onCall         — async () for call logging
 */
export default function MplWidget({
  user,
  profile,
  categories = [],
  stats = {},
  refetch,
  onLog,
  onManualLog,
  onCall,
}) {
  // ── State ───────────────────────────────────────────────────────────
  const [processes, setProcesses] = useState([])       // [{ id, elapsed, paused }]
  const [pickerTarget, setPickerTarget] = useState(null) // { id, elapsed } when logging
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [callConfirm, setCallConfirm] = useState(false)

  const processTimers = useRef({})   // { [id]: intervalId }
  const callConfirmTimerRef = useRef(null)

  // ── Timer helpers ───────────────────────────────────────────────────
  function startTimer(id) {
    if (processTimers.current[id]) return
    processTimers.current[id] = setInterval(() => {
      setProcesses(prev => prev.map(p => p.id === id ? { ...p, elapsed: p.elapsed + 1 } : p))
    }, 1000)
  }

  function stopTimer(id) {
    clearInterval(processTimers.current[id])
    delete processTimers.current[id]
  }

  // ── Process handlers ─────────────────────────────────────────────────
  function handleStart() {
    const id = crypto.randomUUID()
    setProcesses(prev => [...prev, { id, elapsed: 0, paused: false }])
    startTimer(id)
  }

  function handlePause(id) {
    stopTimer(id)
    setProcesses(prev => prev.map(p => p.id === id ? { ...p, paused: true } : p))
  }

  function handleResume(id) {
    setProcesses(prev => prev.map(p => p.id === id ? { ...p, paused: false } : p))
    startTimer(id)
  }

  function handleDiscard(id) {
    stopTimer(id)
    setProcesses(prev => prev.filter(p => p.id !== id))
  }

  function handleLogOpen(id) {
    const process = processes.find(p => p.id === id)
    if (!process) return
    stopTimer(id)
    setProcesses(prev => prev.map(p => p.id === id ? { ...p, paused: true } : p))
    setPickerTarget({ id, elapsed: process.elapsed })
  }

  // ── Picker callbacks ─────────────────────────────────────────────────
  async function handlePickerConfirm(categoryId, subcategoryId, durationSeconds) {
    const minutes = Math.round(durationSeconds / 60) || 1
    await onLog?.(categoryId, subcategoryId, minutes, 'mpl_timer')
    const id = pickerTarget?.id
    if (id) {
      stopTimer(id)
      setProcesses(prev => prev.filter(p => p.id !== id))
    }
    setPickerTarget(null)
    refetch?.()
  }

  function handlePickerCancel() {
    const id = pickerTarget?.id
    setPickerTarget(null)
    if (id) {
      setProcesses(prev => prev.map(p => p.id === id ? { ...p, paused: false } : p))
      startTimer(id)
    }
  }

  // ── Manual log ───────────────────────────────────────────────────────
  async function handleManualLog(categoryId, subcategoryId, minutes) {
    await onManualLog?.(categoryId, subcategoryId, minutes)
    setShowManualEntry(false)
    refetch?.()
  }

  // ── Log Call ─────────────────────────────────────────────────────────
  async function handleLogCall() {
    await onCall?.()
    refetch?.()
    setCallConfirm(true)
    clearTimeout(callConfirmTimerRef.current)
    callConfirmTimerRef.current = setTimeout(() => setCallConfirm(false), 1500)
  }

  // ── Cleanup ──────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(processTimers.current).forEach(clearInterval)
      clearTimeout(callConfirmTimerRef.current)
    }
  }, [])

  // ── Derived ──────────────────────────────────────────────────────────
  const processCount = stats.processes ?? 0
  const callCount = stats.calls ?? 0
  const hasProcesses = processes.length > 0

  // ── Top bar timer pill ───────────────────────────────────────────────
  let timerPill = null
  if (processes.length === 1) {
    const p = processes[0]
    timerPill = (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 4px 3px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        background: p.paused ? 'rgba(245,158,11,0.12)' : 'rgba(96,165,250,0.12)',
        border: p.paused ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(96,165,250,0.3)',
        color: p.paused ? '#fbbf24' : '#ffffff',
      }}>
        <span style={{ fontSize: 8, lineHeight: 1, color: p.paused ? '#fbbf24' : C.process }}>●</span>
        {formatElapsed(p.elapsed)}
        <button
          onClick={p.paused ? () => handleResume(p.id) : () => handlePause(p.id)}
          title={p.paused ? 'Resume' : 'Pause'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 20, height: 20, borderRadius: '50%', border: 'none',
            background: p.paused ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.1)',
            color: p.paused ? '#fbbf24' : 'rgba(255,255,255,0.7)',
            cursor: 'pointer', padding: 0, flexShrink: 0, lineHeight: 1,
          }}
        >
          {p.paused ? <Play size={10} /> : <Pause size={10} />}
        </button>
      </div>
    )
  } else if (processes.length > 1) {
    const runningCount = processes.filter(p => !p.paused).length
    timerPill = (
      <div style={{
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: 'rgba(96,165,250,0.12)',
        border: '1px solid rgba(96,165,250,0.3)',
        color: '#60a5fa',
      }}>
        {runningCount > 0 ? `${processes.length} running` : `${processes.length} paused`}
      </div>
    )
  }

  // ── Top bar ──────────────────────────────────────────────────────────
  const topBar = (
    <div style={{
      height: 60, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 12px',
      background: 'rgba(255,255,255,0.03)',
      borderBottom: `1px solid ${C.divider}`,
      boxSizing: 'border-box',
    }}>
      <img
        src="/meridian-mark-192.png"
        alt="Meridian"
        onClick={() => window.open(window.location.origin, 'meridian-dashboard')}
        style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
      />
      <div style={{ width: 1, height: 28, background: C.divider, flexShrink: 0 }} />

      {timerPill}

      <div style={{ flex: 1 }} />

      <button
        onClick={handleLogCall}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 8,
          border: `1px solid rgba(2,132,199,0.35)`,
          background: callConfirm ? 'rgba(2,132,199,0.25)' : 'rgba(2,132,199,0.12)',
          color: callConfirm ? '#7dd3fc' : C.calls,
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
          transition: 'background 0.15s', flexShrink: 0,
        }}
      >
        <Phone size={12} />
        {callConfirm ? 'Logged!' : `${callCount} Calls`}
      </button>

      <div style={{ fontSize: 11, fontWeight: 700, color: C.process, flexShrink: 0 }}>
        {processCount} Processes
      </div>

      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
    </div>
  )

  // ── Process list row ─────────────────────────────────────────────────
  function ProcessRow({ p }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px',
        borderRadius: 10,
        background: p.paused ? 'rgba(245,158,11,0.06)' : 'rgba(96,165,250,0.06)',
        border: p.paused ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(96,165,250,0.2)',
      }}>
        {/* Indicator dot */}
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: p.paused ? 'rgba(245,158,11,0.5)' : '#60a5fa',
        }} />

        {/* Elapsed */}
        <span style={{
          fontSize: 15, fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: p.paused ? '#fbbf24' : C.textPri,
          flex: 1, letterSpacing: '-0.3px',
        }}>
          {formatElapsed(p.elapsed)}
        </span>

        {/* Pause / Resume */}
        <button
          onClick={p.paused ? () => handleResume(p.id) : () => handlePause(p.id)}
          title={p.paused ? 'Resume' : 'Pause'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6, border: 'none',
            background: p.paused ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.08)',
            color: p.paused ? '#fbbf24' : C.textSec,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {p.paused ? <Play size={12} /> : <Pause size={12} />}
        </button>

        {/* Log */}
        <button
          onClick={() => handleLogOpen(p.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 6, border: 'none',
            background: C.process, color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Clock size={11} />
          Log
        </button>

        {/* Discard */}
        <button
          onClick={() => handleDiscard(p.id)}
          title="Discard"
          style={{
            width: 24, height: 24, borderRadius: 4,
            background: 'none', border: 'none',
            color: C.textDim, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>
    )
  }

  // ── Main area ────────────────────────────────────────────────────────
  const mainArea = (
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {pickerTarget ? (
        <ProcessPicker
          categories={categories}
          elapsed={pickerTarget.elapsed}
          onConfirm={handlePickerConfirm}
          onCancel={handlePickerCancel}
        />
      ) : showManualEntry ? (
        <ManualEntryForm
          categories={categories}
          onClose={() => setShowManualEntry(false)}
          onLog={handleManualLog}
        />
      ) : hasProcesses ? (
        /* Active timers list */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Scrollable process rows */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {processes.map(p => <ProcessRow key={p.id} p={p} />)}
          </div>

          {/* Bottom action bar */}
          <div style={{
            flexShrink: 0,
            display: 'flex', gap: 10, padding: '10px 16px',
            borderTop: `1px solid ${C.divider}`,
          }}>
            <button
              onClick={handleStart}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 0', borderRadius: 8,
                background: C.process, border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              Add Timer
            </button>
            <button
              onClick={() => setShowManualEntry(true)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 0', borderRadius: 8,
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
                color: C.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              Manual Entry
            </button>
          </div>
        </div>
      ) : (
        /* Idle state */
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16, padding: 24,
        }}>
          {/* Today's counts */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.process, lineHeight: 1 }}>
                {processCount}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.textSec, marginTop: 4 }}>
                PROCESSES
              </div>
            </div>
            <div style={{ width: 1, background: C.divider }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.calls, lineHeight: 1 }}>
                {callCount}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.textSec, marginTop: 4 }}>
                CALLS
              </div>
            </div>
          </div>

          <button
            onClick={handleStart}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 10,
              background: C.process, border: 'none',
              color: '#ffffff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              width: 200, justifyContent: 'center',
            }}
          >
            <Play size={16} />
            Start Timer
          </button>

          <button
            onClick={() => setShowManualEntry(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 24px', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
              color: C.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              width: 200, justifyContent: 'center',
            }}
          >
            <Plus size={14} />
            Manual Entry
          </button>
        </div>
      )}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: '100%', height: '100vh',
      background: '#0f1117',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
      color: C.textPri,
      boxSizing: 'border-box',
    }}>
      {topBar}
      {mainArea}
    </div>
  )
}
