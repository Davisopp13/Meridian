import { useState, useEffect, useRef } from 'react'
import * as ReactDOM from 'react-dom/client'
import { usePipWindow } from '../hooks/usePipWindow.js'
import { usePendingTriggers } from '../hooks/usePendingTriggers.js'
import { useStats } from '../hooks/useStats.js'
import { supabase } from '../lib/supabase.js'
import { logMplEntry, fetchProfile, fetchCategoriesForTeamId, fetchCategoriesForTeam } from '../lib/api.js'
import MplPipBar from './MplPipBar.jsx'
import AuthScreen from '../components/auth/AuthScreen.jsx'
import { PipErrorBoundary } from '../components/PipErrorBoundary.jsx'
import MplLaunchError from '../components/MplLaunchError.jsx'
import { getMplSizeForState, getMplBarWidth } from '../lib/constants.js'

// ── Widget mode detection ──────────────────────────────────────────────────
const isMplWidget = new URLSearchParams(window.location.search).get('mode') === 'mpl-widget'

const STAT_BUTTONS = ['processes', 'total']
const SWIMLANE_H = 220   // px — tray height below the bar row

export default function MplApp() {
  const { isOpen, openPip, resizeAndPin, pipRootRef } = usePipWindow()

  // ── Auth state ─────────────────────────────────────────────────────────
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // ── MPL state ──────────────────────────────────────────────────────────
  const [processes, setProcesses] = useState([])    // [{ id, elapsed, paused }]
  const [showSwimlane, setShowSwimlane] = useState(false)
  const [swimlaneOpen, setSwimlaneOpen] = useState(false)
  const [quickLogOpen, setQuickLogOpen] = useState(false)
  const [chipStripProcessId, setChipStripProcessId] = useState(null)
  const [categories, setCategories] = useState([])
  const [isMinimized, setIsMinimized] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connected')
  const [pipToast, setPipToast] = useState(null)
  const [launchError, setLaunchError] = useState(null)  // null | 'unsupported' | 'denied' | 'setup'

  // ── Stats ──────────────────────────────────────────────────────────────
  const { processes: processCount, refetch } = useStats()

  // ── Refs ──────────────────────────────────────────────────────────────
  const processTimers = useRef({})  // { [id]: intervalId }
  const toastTimerRef = useRef(null)
  const widgetInitRef = useRef(false)
  const processesRef = useRef(processes)
  useEffect(() => { processesRef.current = processes }, [processes])

  // ── Toast helper ──────────────────────────────────────────────────────
  function showToast(message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setPipToast(message)
    toastTimerRef.current = setTimeout(() => {
      setPipToast(null)
      toastTimerRef.current = null
    }, 2000)
  }

  // ── Safe Supabase write ───────────────────────────────────────────────
  async function safeWrite(promise) {
    const { error } = await promise
    if (error) {
      console.error('[Meridian MPL] Supabase write failed', error)
      showToast('Save failed: ' + (error.message || 'Unknown error'))
      return false
    }
    return true
  }

  // ── Sizing helpers ────────────────────────────────────────────────────
  function pin(stateKey) {
    const { width, height } = getMplSizeForState(stateKey, STAT_BUTTONS)
    resizeAndPin({ width, height }, 'bottom-right')
  }

  function pinActive() {
    const width = getMplBarWidth('timerActive', STAT_BUTTONS)
    resizeAndPin({ width, height: 64 + SWIMLANE_H }, 'bottom-right')
  }

  // ── Timer helpers ─────────────────────────────────────────────────────
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

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(processTimers.current).forEach(clearInterval)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // ── Auth: fetch current session + listen for changes ──────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchProfile(u.id).then(({ data: p }) => { setProfile(p); setAuthLoading(false) })
      } else {
        setAuthLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchProfile(u.id).then(({ data: p }) => setProfile(p))
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Category fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || (!profile?.team_id && !profile?.team)) return
    const fetch = profile.team_id
      ? fetchCategoriesForTeamId(profile.team_id)
      : fetchCategoriesForTeam(profile.team)
    fetch.then(({ data, error }) => {
      if (error) console.error('[Meridian MPL] mpl_categories fetch failed', error)
      if (data) setCategories(data)
    })
  }, [user, profile])

  // ── Connection health-check ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function pingConnection() {
      const { error } = await supabase.from('platform_users').select('id').limit(1)
      setConnectionStatus(error ? 'offline' : 'connected')
    }
    pingConnection()
    const intervalId = setInterval(pingConnection, 30000)
    return () => clearInterval(intervalId)
  }, [user])

  // ── Auto-launch PiP when tab opens as ?mode=mpl-widget ───────────────
  useEffect(() => {
    if (!isMplWidget) return
    if (authLoading || !user || !profile?.onboarding_complete) return
    if (widgetInitRef.current) return
    widgetInitRef.current = true

    document.body.classList.add('widget-mode')

    ;(async () => {
      const { width, height } = getMplSizeForState('idle', STAT_BUTTONS)
      const result = await openPip({ width, height, position: 'bottom-right' })
      if (!result.ok) {
        widgetInitRef.current = false
        setLaunchError(result.reason)
        return
      }
      mountPipWindow(result.window)
      setTimeout(() => { try { window.close() } catch (e) {} }, 400)
    })()
  }, [isMplWidget, authLoading, user, profile])

  // ── Pending triggers ───────────────────────────────────────────────────
  // Guard bookmarklet-triggered starts so they can't interrupt an in-progress log.
  // Two defenses:
  //   1. If the user has the TIMED picker or the UNTIMED Quick Log open, drop the
  //      trigger. A new timer arriving mid-drill-down unmounts the overlay and
  //      strands the original timer (Wanda bug, 4/17).
  //   2. Debounce repeated triggers within 2s. Covers double-clicks on the
  //      bookmarklet and Realtime+poll firing for the same row.
  const lastProcessStartRef = useRef(0)
  const uiStateRef = useRef({ chipStripProcessId: null, quickLogOpen: false })
  useEffect(() => {
    uiStateRef.current = { chipStripProcessId, quickLogOpen }
  }, [chipStripProcessId, quickLogOpen])

  usePendingTriggers(user?.id, {
    handleCaseStart: () => {},
    handleProcessStart: () => {
      const now = Date.now()
      if (now - lastProcessStartRef.current < 2000) {
        console.log('[Meridian MPL] Dropped duplicate process start (debounce)')
        return
      }
      const { chipStripProcessId: cs, quickLogOpen: ql } = uiStateRef.current
      if (cs || ql) {
        console.log('[Meridian MPL] Dropped process start — picker open, finish current log first')
        showToast('Finish logging the current process first')
        return
      }
      lastProcessStartRef.current = now
      handleStart()
    },
  })

  // ── Handlers ──────────────────────────────────────────────────────────

  async function handleStart() {
    // Open PiP if not already open — use idle height since swimlane defaults to collapsed
    if (!isOpen) {
      const { width, height } = getMplSizeForState('idle', STAT_BUTTONS)
      const result = await openPip({ width, height, position: 'bottom-right' })
      if (!result.ok) { showToast('Could not open widget — try again'); return }
      mountPipWindow(result.window)
      setTimeout(() => { try { window.close() } catch (e) {} }, 300)
    } else {
      pin('idle')
    }

    const id = crypto.randomUUID()
    const newCount = processesRef.current.length + 1
    setProcesses(prev => [...prev, { id, elapsed: 0, paused: false }])
    setShowSwimlane(true)
    setQuickLogOpen(false)
    setChipStripProcessId(null)
    startTimer(id)

    // Auto-open tray only when 3+ processes — for 1-2, pills on bar + chip strip handle logging
    if (newCount > 2) {
      setSwimlaneOpen(true)
      pinActive()
    }
  }

  // Called when "Log" button is tapped on a bar pill — opens category drill-down
  function handleProcessLog(id) {
    if (quickLogOpen) setQuickLogOpen(false)    // mutual exclusivity
    setChipStripProcessId(id)
    pin('categoryPicker')
  }

  // Called when a category/sub chip is selected in the timed chip strip
  async function handleChipStripConfirm(processId, categoryId, subcategoryId) {
    const proc = processesRef.current.find(p => p.id === processId)
    const elapsed = proc?.elapsed || 0
    setChipStripProcessId(null)

    const cat = categories.find(c => c.id === categoryId)
    const catName = cat?.name || 'Process'

    await handleConfirmProcess(processId, categoryId, subcategoryId, elapsed)
    showToast(`Logged ${catName} · ${Math.round(elapsed / 60) || 1} min`)
  }

  // Called when timed chip strip is cancelled
  function handleChipStripCancel() {
    setChipStripProcessId(null)
    if (showSwimlane && swimlaneOpen) pinActive()
    else pin('idle')
  }

  // Quick Log — opens chip strip in untimed mode (same 108px height)
  async function handleQuickLog() {
    if (chipStripProcessId) setChipStripProcessId(null)  // mutual exclusivity
    if (!isOpen) {
      const size = getMplSizeForState('quickLog', STAT_BUTTONS)
      const result = await openPip({ ...size, position: 'bottom-right' })
      if (!result.ok) { showToast('Could not open widget — try again'); return }
      mountPipWindow(result.window)
      setTimeout(() => { try { window.close() } catch (e) {} }, 300)
    } else {
      pin('quickLog')
    }
    setQuickLogOpen(true)
  }

  // Called from CategoryChipStrip (untimed) when category + duration are selected
  async function handleQuickLogConfirm(categoryId, subcategoryId, minutes) {
    if (!user || !minutes) return
    setQuickLogOpen(false)

    const cat = categories.find(c => c.id === categoryId)
    const catName = cat?.name || 'Process'

    const ok = await safeWrite(logMplEntry({ userId: user.id, categoryId, subcategoryId, minutes, source: 'manual' }))
    if (ok) {
      showToast(`Logged ${catName} · ${minutes} min`)
      if (showSwimlane && swimlaneOpen) pinActive()
      else pin('idle')
      refetch()
    }
  }

  function handleQuickLogCancel() {
    setQuickLogOpen(false)
    if (showSwimlane && swimlaneOpen) pinActive()
    else pin('idle')
  }

  // Called by CategoryChipStrip when its internal step changes (category → subcategory → duration)
  function handleQuickLogStepChange(step) {
    if (!quickLogOpen) return
    if (step === 'duration') {
      pin('quickLogDuration')
    } else {
      pin('quickLog')
    }
  }

  function handleToggleSwimlane() {
    const next = !swimlaneOpen
    setSwimlaneOpen(next)
    if (next) pinActive()
    else pin('idle')
  }

  // Called from ProcessLaneRow when user selects a category — logs the process
  async function handleConfirmProcess(id, categoryId, subcategoryId, durationSeconds) {
    if (!user) return
    stopTimer(id)
    const next = processesRef.current.filter(p => p.id !== id)
    setProcesses(next)
    if (next.length === 0) {
      setShowSwimlane(false)
      setSwimlaneOpen(false)
      pin('idle')
    }
    const ok = await safeWrite(logMplEntry({ userId: user.id, categoryId, subcategoryId, minutes: Math.round(durationSeconds / 60) || 1, source: 'pip' }))
    if (ok) refetch()
  }

  // Called from ProcessLaneRow × button — discard without logging
  function handleCancelProcess(id) {
    stopTimer(id)
    const next = processesRef.current.filter(p => p.id !== id)
    setProcesses(next)
    if (next.length === 0) {
      setShowSwimlane(false)
      setSwimlaneOpen(false)
      pin('idle')
    }
  }

  function handleMinimize() {
    setIsMinimized(true)
    pin('minimized')
  }

  function handleRestore() {
    setIsMinimized(false)
    if (quickLogOpen) { pin('quickLog'); return }
    if (chipStripProcessId) { pin('chipStrip'); return }
    if (showSwimlane && swimlaneOpen) { pinActive(); return }
    pin('idle')
  }

  function handleOpenDashboard() {
    window.open(window.location.origin, 'meridian-dashboard')
  }

  // ── Retry launch after failure ────────────────────────────────────────
  function handleRetry() {
    setLaunchError(null)
    widgetInitRef.current = true
    ;(async () => {
      const { width, height } = getMplSizeForState('idle', STAT_BUTTONS)
      const result = await openPip({ width, height, position: 'bottom-right' })
      if (!result.ok) {
        widgetInitRef.current = false
        setLaunchError(result.reason)
        return
      }
      mountPipWindow(result.window)
      setTimeout(() => { try { window.close() } catch (e) {} }, 400)
    })()
  }

  // ── buildMplBar — JSX rendered into PiP window ────────────────────────
  function buildMplBar() {
    return (
      <MplPipBar
        processes={processes}
        categories={categories}
        showSwimlane={showSwimlane}
        swimlaneOpen={swimlaneOpen}
        chipStripProcessId={chipStripProcessId}
        quickLogOpen={quickLogOpen}
        onToggleSwimlane={handleToggleSwimlane}
        processCount={processCount}
        onOpenDashboard={handleOpenDashboard}
        onStart={handleStart}
        onQuickLog={handleQuickLog}
        onConfirmProcess={handleConfirmProcess}
        onCancelProcess={handleCancelProcess}
        onLogProcess={handleProcessLog}
        onChipStripConfirm={handleChipStripConfirm}
        onChipStripCancel={handleChipStripCancel}
        onQuickLogConfirm={handleQuickLogConfirm}
        onQuickLogCancel={handleQuickLogCancel}
        onQuickLogStepChange={handleQuickLogStepChange}
        onMinimize={handleMinimize}
        onRestore={handleRestore}
        isMinimized={isMinimized}
        connectionStatus={connectionStatus}
        pipToast={pipToast}
      />
    )
  }

  // ── mountPipWindow — create React root in PiP window ─────────────────
  function mountPipWindow(pw) {
    const existing = pw.document.getElementById('meridian-pip-root')
    if (existing) existing.remove()
    const container = pw.document.createElement('div')
    container.id = 'meridian-pip-root'
    container.style.cssText = 'width:100%;height:100%'
    pw.document.body.appendChild(container)
    pipRootRef.current = ReactDOM.createRoot(container)
    pipRootRef.current.render(<PipErrorBoundary>{buildMplBar()}</PipErrorBoundary>)
  }

  // ── Re-render PiP window after every render ───────────────────────────
  useEffect(() => {
    if (!pipRootRef.current) return
    pipRootRef.current.render(<PipErrorBoundary>{buildMplBar()}</PipErrorBoundary>)
  })

  // ── Auth loading / not logged in ───────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0f0f1e',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12,
      }}>
        Loading…
      </div>
    )
  }

  if (!user) return <AuthScreen />

  if (!profile?.onboarding_complete) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0f0f1e',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12,
        textAlign: 'center', padding: 24,
      }}>
        Please complete onboarding in the main Meridian dashboard first.
      </div>
    )
  }

  if (launchError) {
    return <MplLaunchError reason={launchError} onRetry={handleRetry} />
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/meridian-mark-192.png" width={48} height={48}
          style={{ borderRadius: 10, marginBottom: 16, opacity: 0.8 }} />
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          Opening widget…
        </div>
      </div>
    </div>
  )
}
