import { useState, useEffect, useRef } from 'react'
import * as ReactDOM from 'react-dom/client'
import { usePipWindow } from '../hooks/usePipWindow.js'
import { usePendingTriggers } from '../hooks/usePendingTriggers.js'
import useMplRecovery from '../hooks/useMplRecovery.js'
import { useStats } from '../hooks/useStats.js'
import { supabase } from '../lib/supabase.js'
import { logMplEntry, logCall, fetchProfile, fetchCategoriesForTeamId, fetchCategoriesForTeam, fetchMyActiveMplTimers, clearMplActiveTimer } from '../lib/api.js'
import { saveSnapshot, clearSnapshot, loadSnapshot } from '../lib/mplRecoveryStorage.js'
import MplPipBar from './MplPipBar.jsx'
import AuthScreen from '../components/auth/AuthScreen.jsx'
import { PipErrorBoundary } from '../components/PipErrorBoundary.jsx'
import MplLaunchError from '../components/MplLaunchError.jsx'
import { getMplSizeForState, getMplBarWidth } from '../lib/constants.js'

// ── Widget mode detection ──────────────────────────────────────────────────
const isMplWidget = new URLSearchParams(window.location.search).get('mode') === 'mpl-widget'

const STAT_BUTTONS = []  // stat tray merged into action row
const SWIMLANE_H = 220   // px — tray height below the bar row

export default function MplApp() {
  const { isOpen, openPip, resizeAndPin, pipRootRef, pipWindow } = usePipWindow()

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
  const [recoveredProcesses, setRecoveredProcesses] = useState([])
  const recoveryCheckedRef = useRef(false)

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats = useStats()
  const processCount = stats.processes || 0
  const callsCount = stats.calls || 0
  const totalActivity = (stats.resolved || 0) + (stats.reclass || 0) + (stats.calls || 0) + (stats.processes || 0)
  const refetch = stats.refetch

  // ── Refs ──────────────────────────────────────────────────────────────
  const processTimers = useRef({})  // { [id]: intervalId }
  const toastTimerRef = useRef(null)
  const widgetInitRef = useRef(false)
  const processesRef = useRef(processes)
  useEffect(() => { processesRef.current = processes }, [processes])

  const userIdRef = useRef(null)
  const accessTokenRef = useRef(null)
  useEffect(() => { userIdRef.current = user?.id ?? null }, [user])
  useEffect(() => {
    if (!user) { accessTokenRef.current = null; return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      accessTokenRef.current = session?.access_token ?? null
    })
  }, [user])

  // ── Snapshot processes to localStorage on every change ────────────────
  useEffect(() => {
    if (!user?.id) return
    saveSnapshot(user.id, processes)
  }, [user, processes])

  // ── beforeunload sendBeacon flush ─────────────────────────────────────
  const flushHandlerRef = useRef(null)
  useEffect(() => {
    function flushProcesses() {
      const procs = processesRef.current
      if (!procs.length) return
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const userId = userIdRef.current
      const token = accessTokenRef.current
      if (!supabaseUrl || !userId || !token) return
      const url = `${supabaseUrl}/rest/v1/mpl_active_timers`
      procs.forEach(proc => {
        const payload = JSON.stringify([{
          process_id: proc.id,
          user_id: userId,
          accumulated_seconds: proc.elapsed,
          status: proc.paused ? 'paused' : 'running',
          updated_at: new Date().toISOString(),
        }])
        const blob = new Blob([payload], { type: 'application/json' })
        const sent = navigator.sendBeacon(`${url}?on_conflict=process_id`, blob)
        if (!sent) {
          fetch(`${url}?on_conflict=process_id`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': anonKey,
              'Authorization': `Bearer ${token}`,
              'Prefer': 'resolution=merge-duplicates,return=minimal',
            },
            body: payload,
            keepalive: true,
          }).catch(() => {})
        }
      })
    }
    flushHandlerRef.current = flushProcesses
    window.addEventListener('beforeunload', flushProcesses)
    return () => window.removeEventListener('beforeunload', flushProcesses)
  }, [])

  useEffect(() => {
    if (!pipWindow) return
    const pw = pipWindow
    const handler = () => flushHandlerRef.current?.()
    pw.addEventListener('beforeunload', handler)
    return () => pw.removeEventListener('beforeunload', handler)
  }, [pipWindow])

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
      if (processesRef.current.length === 0) clearSnapshot()
    }
  }, [])

  // ── Recovery: cap elapsed to time-since-start ─────────────────────────
  function capElapsed(p) {
    const stored = p.elapsed ?? p.accumulated_seconds ?? 0
    if (!p.startedAt) return stored
    const sinceStart = Math.floor((Date.now() - new Date(p.startedAt).getTime()) / 1000)
    return Math.min(stored, sinceStart)
  }

  // ── Recovery detection — runs once after user + categories load ────────
  useEffect(() => {
    if (!user?.id || categories.length === 0 || recoveryCheckedRef.current) return
    recoveryCheckedRef.current = true

    ;(async () => {
      try {
        const HOUR_MS = 60 * 60 * 1000
        const snapshot = loadSnapshot(user.id)
        let recovered = null

        if (snapshot && snapshot.processes.length > 0 && Date.now() - snapshot.savedAt < HOUR_MS) {
          recovered = snapshot.processes
        } else {
          const [{ data: timers }, { data: barRow }] = await Promise.all([
            fetchMyActiveMplTimers(user.id),
            supabase.from('bar_sessions').select('last_seen_at').eq('user_id', user.id).eq('widget_mode', 'mpl-widget').maybeSingle(),
          ])
          if (timers && timers.length > 0) {
            const CRASH_MS = 5 * 60 * 1000
            const lastSeen = barRow?.last_seen_at ? new Date(barRow.last_seen_at).getTime() : 0
            const isStale = !lastSeen || Date.now() - lastSeen > CRASH_MS
            if (isStale) {
              recovered = timers.map(row => ({
                id: row.process_id,
                elapsed: row.accumulated_seconds ?? 0,
                paused: row.status === 'paused',
                categoryId: row.category_id,
                subcategoryId: row.subcategory_id,
                startedAt: row.started_at,
              }))
            }
          }
        }

        if (!recovered || recovered.length === 0) return
        setRecoveredProcesses(recovered)
        if (!isOpen) {
          const { width, height } = getMplSizeForState('idle', STAT_BUTTONS)
          const result = await openPip({ width, height, position: 'bottom-right' })
          if (result.ok) mountPipWindow(result.window)
        }
      } catch (err) {
        console.warn('[Meridian MPL] Recovery detection failed:', err)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, categories])

  // ── Recovery handlers ──────────────────────────────────────────────────
  function handleRecoveryResume() {
    const restoredProcesses = recoveredProcesses.map(p => ({
      id: p.id,
      elapsed: capElapsed(p),
      paused: false,
      categoryId: p.categoryId,
      subcategoryId: p.subcategoryId,
      startedAt: p.startedAt,
    }))
    setProcesses(restoredProcesses)
    setShowSwimlane(true)
    restoredProcesses.forEach(p => startTimer(p.id))
    setRecoveredProcesses([])
    clearSnapshot()
    showToast(`${restoredProcesses.length} timer${restoredProcesses.length > 1 ? 's' : ''} resumed`)
  }

  async function handleRecoveryLogNow() {
    const categorized = recoveredProcesses.filter(p => p.categoryId)
    const uncategorized = recoveredProcesses.filter(p => !p.categoryId)
    for (const p of categorized) {
      const minutes = Math.round(capElapsed(p) / 60) || 1
      await safeWrite(logMplEntry({ userId: user.id, categoryId: p.categoryId, subcategoryId: p.subcategoryId, minutes, source: 'recovery' }))
      clearMplActiveTimer(p.id)
    }
    clearSnapshot()
    setRecoveredProcesses([])
    if (categorized.length > 0) {
      showToast(`Logged ${categorized.length} process${categorized.length > 1 ? 'es' : ''}`)
      refetch()
    }
    if (uncategorized.length > 0) {
      const restored = uncategorized.map(p => ({
        id: p.id,
        elapsed: capElapsed(p),
        paused: true,
        categoryId: null,
        subcategoryId: null,
        startedAt: p.startedAt,
      }))
      setProcesses(restored)
      setShowSwimlane(true)
      setChipStripProcessId(restored[0].id)
      pin('categoryPicker')
    }
  }

  function handleRecoveryDiscard() {
    clearSnapshot()
    recoveredProcesses.forEach(p => clearMplActiveTimer(p.id))
    setRecoveredProcesses([])
  }

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
  const syncNowRef = useRef(null)
  const { syncNow } = useMplRecovery(user?.id, processes)
  syncNowRef.current = syncNow

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
  async function handleChipStripConfirm(processId, categoryId, subcategoryId, note) {
    const proc = processesRef.current.find(p => p.id === processId)
    const elapsed = proc?.elapsed || 0
    setChipStripProcessId(null)

    const cat = categories.find(c => c.id === categoryId)
    const catName = cat?.name || 'Process'

    await handleConfirmProcess(processId, categoryId, subcategoryId, elapsed, note)
    showToast(`Logged ${catName} · ${Math.round(elapsed / 60) || 1} min`)
  }

  // Called when timed chip strip is cancelled
  function handleChipStripCancel() {
    setChipStripProcessId(null)
    if (showSwimlane && swimlaneOpen) pinActive()
    else pin('idle')
  }

  // Quick Log — opens ManualEntryForm in PiP window
  async function handleCallLog() {
    if (!user?.id) return
    const { error } = await logCall({
      userId: user.id,
      direction: 'outgoing',
      source: 'mpl_widget',
      note: null,
    })
    if (error) {
      console.error('[Meridian MPL] call log failed:', error.message)
      setPipToast('Call log failed')
      setTimeout(() => setPipToast(null), 2500)
      return
    }
    setPipToast('📞 Call logged')
    setTimeout(() => setPipToast(null), 2000)
    refetch()
  }

  function handleQuickLog() {
    // Fast path: widget is already open. Fully synchronous so resizeTo runs
    // inside the click's user activation window.
    if (isOpen) {
      if (chipStripProcessId) setChipStripProcessId(null)
      setQuickLogOpen(true)
      pin('categoryPicker')
      return
    }
    // Slow path: widget not yet open. Must await openPip.
    handleQuickLogColdStart()
  }

  async function handleQuickLogColdStart() {
    if (chipStripProcessId) setChipStripProcessId(null)
    const size = getMplSizeForState('categoryPicker', STAT_BUTTONS)
    const result = await openPip({ ...size, position: 'bottom-right' })
    if (!result.ok) { showToast('Could not open widget — try again'); return }
    mountPipWindow(result.window)
    setTimeout(() => { try { window.close() } catch (e) {} }, 300)
    setQuickLogOpen(true)
  }

  // Called from ManualEntryForm (Quick Log) when category + duration are selected
  async function handleQuickLogConfirm(categoryId, subcategoryId, minutes, note) {
    if (!user || !minutes) return
    setQuickLogOpen(false)

    const cat = categories.find(c => c.id === categoryId)
    const catName = cat?.name || 'Process'

    const ok = await safeWrite(logMplEntry({ userId: user.id, categoryId, subcategoryId, minutes, source: 'manual', note: note || null }))
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

  function handleToggleSwimlane() {
    const next = !swimlaneOpen
    setSwimlaneOpen(next)
    if (next) pinActive()
    else pin('idle')
  }

  // Called from ProcessLaneRow when user selects a category — logs the process
  async function handleConfirmProcess(id, categoryId, subcategoryId, durationSeconds, note) {
    if (!user) return
    stopTimer(id)
    const next = processesRef.current.filter(p => p.id !== id)
    setProcesses(next)
    if (next.length === 0) {
      setShowSwimlane(false)
      setSwimlaneOpen(false)
      pin('idle')
    }
    const ok = await safeWrite(logMplEntry({ userId: user.id, categoryId, subcategoryId, minutes: Math.round(durationSeconds / 60) || 1, source: 'pip', note: note || null }))
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
    if (quickLogOpen) { pin('categoryPicker'); return }
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
      <>
        <MplPipBar
          userId={user?.id}
          processes={processes}
          categories={categories}
          showSwimlane={showSwimlane}
          swimlaneOpen={swimlaneOpen}
          chipStripProcessId={chipStripProcessId}
          quickLogOpen={quickLogOpen}
          onToggleSwimlane={handleToggleSwimlane}
          processCount={processCount}
          callsCount={callsCount}
          totalActivity={totalActivity}
          onOpenDashboard={handleOpenDashboard}
          onStart={handleStart}
          onCallLog={handleCallLog}
          onQuickLog={handleQuickLog}
          onConfirmProcess={handleConfirmProcess}
          onCancelProcess={handleCancelProcess}
          onLogProcess={handleProcessLog}
          onChipStripConfirm={handleChipStripConfirm}
          onChipStripCancel={handleChipStripCancel}
          onQuickLogConfirm={handleQuickLogConfirm}
          onQuickLogCancel={handleQuickLogCancel}
          onMinimize={handleMinimize}
          onRestore={handleRestore}
          isMinimized={isMinimized}
          connectionStatus={connectionStatus}
          pipToast={pipToast}
          recoveredProcesses={recoveredProcesses}
          onRecoveryResume={handleRecoveryResume}
          onRecoveryLogNow={handleRecoveryLogNow}
          onRecoveryDiscard={handleRecoveryDiscard}
        />
      </>
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
        color: 'rgba(255,255,255,0.5)', fontSize: 12,
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
        color: 'rgba(255,255,255,0.5)', fontSize: 12,
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
