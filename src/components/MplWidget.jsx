import { useState, useRef, useEffect } from 'react'
import { Phone, Play, Pause, Square, Clock, Plus } from 'lucide-react'
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
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [callConfirm, setCallConfirm] = useState(false)

  const intervalRef = useRef(null)
  const callConfirmTimerRef = useRef(null)

  // ── Timer helpers ───────────────────────────────────────────────────
  function startInterval() {
    intervalRef.current = setInterval(() => {
      setElapsed(s => s + 1)
    }, 1000)
  }

  function clearTimerInterval() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function handleStart() {
    setElapsed(0)
    setPaused(false)
    setTimerRunning(true)
    startInterval()
  }

  function handlePause() {
    clearTimerInterval()
    setPaused(true)
  }

  function handleResume() {
    setPaused(false)
    startInterval()
  }

  function handleDiscard() {
    clearTimerInterval()
    setTimerRunning(false)
    setElapsed(0)
    setPaused(false)
  }

  function handleLogOpen() {
    setShowPicker(true)
  }

  // ── Picker / manual callbacks ────────────────────────────────────────
  async function handlePickerConfirm(categoryId, subcategoryId, durationSeconds) {
    const minutes = Math.round(durationSeconds / 60) || 1
    await onLog?.(categoryId, subcategoryId, minutes, 'mpl_timer')
    clearTimerInterval()
    setShowPicker(false)
    setTimerRunning(false)
    setElapsed(0)
    setPaused(false)
    refetch?.()
  }

  function handlePickerCancel() {
    setShowPicker(false)
  }

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
      clearTimerInterval()
      clearTimeout(callConfirmTimerRef.current)
    }
  }, [])

  // ── Derived ──────────────────────────────────────────────────────────
  const processCount = stats.processes ?? 0
  const callCount = stats.calls ?? 0

  // ── Top bar timer pill ───────────────────────────────────────────────
  function TimerPill() {
    if (!timerRunning) return null
    const pillStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      fontVariantNumeric: 'tabular-nums',
      background: paused ? 'rgba(245,158,11,0.12)' : 'rgba(96,165,250,0.12)',
      border: paused ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(96,165,250,0.3)',
      color: paused ? '#fbbf24' : '#ffffff',
      cursor: 'default',
    }
    return (
      <div style={pillStyle}>
        <span style={{ fontSize: 8, lineHeight: 1 }}>●</span>
        {formatElapsed(elapsed)}
      </div>
    )
  }

  // ── Top bar ──────────────────────────────────────────────────────────
  const topBar = (
    <div style={{
      height: 60,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 12px',
      background: 'rgba(255,255,255,0.03)',
      borderBottom: `1px solid ${C.divider}`,
      boxSizing: 'border-box',
    }}>
      {/* Meridian icon */}
      <img
        src="/meridian-mark-192.png"
        alt="Meridian"
        onClick={() => window.open(window.location.origin, 'meridian-dashboard')}
        style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
      />

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: C.divider, flexShrink: 0 }} />

      {/* Timer pill (when running) */}
      <TimerPill />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Log Call button */}
      <button
        onClick={handleLogCall}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 10px',
          borderRadius: 8,
          border: `1px solid rgba(2,132,199,0.35)`,
          background: callConfirm ? 'rgba(2,132,199,0.25)' : 'rgba(2,132,199,0.12)',
          color: callConfirm ? '#7dd3fc' : C.calls,
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        <Phone size={12} />
        {callConfirm ? 'Logged!' : `${callCount} Calls`}
      </button>

      {/* Process stat */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.process, flexShrink: 0 }}>
        {processCount} Processes
      </div>

      {/* Connection dot */}
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: '#4ade80', flexShrink: 0,
      }} />
    </div>
  )

  // ── Main area ────────────────────────────────────────────────────────
  const mainArea = (
    <div style={{
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {showPicker ? (
        <ProcessPicker
          categories={categories}
          elapsed={elapsed}
          onConfirm={handlePickerConfirm}
          onCancel={handlePickerCancel}
        />
      ) : showManualEntry ? (
        <ManualEntryForm
          categories={categories}
          onClose={() => setShowManualEntry(false)}
          onLog={handleManualLog}
        />
      ) : timerRunning ? (
        /* Timer running state */
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: 24,
        }}>
          {/* Elapsed display */}
          <div style={{
            fontSize: 48,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: paused ? '#fbbf24' : C.textPri,
            letterSpacing: '-1px',
            lineHeight: 1,
          }}>
            {formatElapsed(elapsed)}
          </div>

          {/* Timer controls */}
          <div style={{ display: 'flex', gap: 10 }}>
            {/* Log (opens picker) */}
            <button
              onClick={handleLogOpen}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                background: C.process, border: 'none',
                color: '#ffffff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Clock size={14} />
              Log
            </button>

            {/* Pause / Resume */}
            {paused ? (
              <button
                onClick={handleResume}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8,
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  color: '#fbbf24', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <Play size={14} />
                Resume
              </button>
            ) : (
              <button
                onClick={handlePause}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${C.border}`,
                  color: C.textSec, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <Pause size={14} />
                Pause
              </button>
            )}

            {/* Discard */}
            <button
              onClick={handleDiscard}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${C.border}`,
                color: C.textDim, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Square size={14} />
              Discard
            </button>
          </div>
        </div>
      ) : (
        /* Idle state */
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
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

          {/* Action buttons */}
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
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${C.border}`,
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
      width: '100%',
      height: '100vh',
      background: '#0f1117',
      display: 'flex',
      flexDirection: 'column',
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
