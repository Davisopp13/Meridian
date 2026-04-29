import { useState, useEffect, useRef } from 'react'
import * as ReactDOM from 'react-dom/client'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { supabase } from './lib/supabase.js'
import { logMplEntry, logCall, fetchProfile, fetchCategoriesForTeam, fetchCategoriesForTeamId } from './lib/api.js'
import { usePipWindow } from './hooks/usePipWindow.js'
import { useStats } from './hooks/useStats.js'
import { getMplSizeForState, getMplBarWidth } from './lib/constants.js'
import Onboarding from './components/Onboarding.jsx'
import Dashboard from './components/Dashboard.jsx'
import AuthScreen from './components/auth/AuthScreen.jsx'
import MplPipBar from './mpl/MplPipBar.jsx'
import { PipErrorBoundary } from './components/PipErrorBoundary.jsx'

const STAT_BUTTONS = []  // stat tray merged into action row
const SWIMLANE_H = 220

export default function DashboardApp() {
  // ── Auth state ──────────────────────────────────────────────────────────
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('connected') // eslint-disable-line no-unused-vars

  // ── MPL state ───────────────────────────────────────────────────────────
  const [processes, setProcesses] = useState([])
  const [showSwimlane, setShowSwimlane] = useState(false)
  const [swimlaneOpen, setSwimlaneOpen] = useState(false)
  const [quickLogOpen, setQuickLogOpen] = useState(false)
  const [chipStripProcessId, setChipStripProcessId] = useState(null)
  const [categories, setCategories] = useState([])
  const [isMinimized, setIsMinimized] = useState(false)
  const [pipToast, setPipToast] = useState(null)

  // ── MPL PiP window ──────────────────────────────────────────────────────
  const {
    isOpen: mplIsOpen,     // eslint-disable-line no-unused-vars
    openPip: openMplPip,
    resizeAndPin: resizeAndPinMpl,
    pipRootRef: mplPipRootRef,
  } = usePipWindow()

  // ── Stats (for processCount badge in MPL bar) ───────────────────────────
  const stats = useStats()
  const processCount = stats.processes || 0
  const callsCount = stats.calls || 0
  const totalActivity = (stats.resolved || 0) + (stats.reclass || 0) + (stats.calls || 0) + (stats.processes || 0)
  const refetch = stats.refetch

  // ── Refs ────────────────────────────────────────────────────────────────
  const processTimers = useRef({})
  const toastTimerRef = useRef(null)
  const processesRef = useRef(processes)
  useEffect(() => { processesRef.current = processes }, [processes])

  const currentThemeRef = useRef('dark')
  const userSettingsRef = useRef({ pip_position: 'bottom-right' })
  useEffect(() => {
    currentThemeRef.current = profile?.settings?.theme ?? 'dark'
    userSettingsRef.current = { pip_position: profile?.settings?.pip_position ?? 'bottom-right' }
  }, [profile])

  // ── Auth: fetch current session + listen for changes ───────────────────
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

  // ── Connection status health-check ──────────────────────────────────────
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

  // ── Category fetch when profile loads ──────────────────────────────────
  useEffect(() => {
    if (!user || (!profile?.team_id && !profile?.team)) return
    const fetch = profile.team_id
      ? fetchCategoriesForTeamId(profile.team_id)
      : fetchCategoriesForTeam(profile.team)
    fetch.then(({ data, error }) => {
      if (error) console.error('[Meridian Dashboard] categories fetch failed', error)
      if (data) setCategories(data)
    })
  }, [user, profile])

  // ── Cleanup timers on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(processTimers.current).forEach(clearInterval)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // ── Re-render MPL PiP window after every render ─────────────────────────
  // No dependency array — intentional, matches pre-April-17 App.jsx pattern.
  // React 18 batching makes this cheap; avoids stale closure bugs in handlers.
  useEffect(() => {
    if (!mplPipRootRef.current) return
    mplPipRootRef.current.render(<PipErrorBoundary>{buildMplBar()}</PipErrorBoundary>)
  })

  // ── Profile refresh ─────────────────────────────────────────────────────
  async function refreshProfile() {
    if (!user) return
    const { data } = await fetchProfile(user.id)
    if (data) setProfile(data)
  }

  function handleOnboardingComplete(updatedProfile) {
    setProfile(updatedProfile)
  }

  // ── Toast helper ────────────────────────────────────────────────────────
  function showToast(message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setPipToast(message)
    toastTimerRef.current = setTimeout(() => {
      setPipToast(null)
      toastTimerRef.current = null
    }, 2000)
  }

  // ── Safe Supabase write ─────────────────────────────────────────────────
  async function safeWrite(promise) {
    const { error } = await promise
    if (error) {
      console.error('[Meridian Dashboard] Supabase write failed', error)
      showToast('Save failed: ' + (error.message || 'Unknown error'))
      return false
    }
    return true
  }

  // ── MPL sizing helpers ──────────────────────────────────────────────────
  function pin(stateKey) {
    const { width, height } = getMplSizeForState(stateKey, STAT_BUTTONS)
    resizeAndPinMpl({ width, height }, userSettingsRef.current.pip_position)
  }

  function pinActive() {
    const width = getMplBarWidth('timerActive', STAT_BUTTONS)
    resizeAndPinMpl({ width, height: 64 + SWIMLANE_H }, userSettingsRef.current.pip_position)
  }

  // ── Process timer helpers ───────────────────────────────────────────────
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

  // ── Process pause/resume ────────────────────────────────────────────────
  function handleProcessPause(id) {
    if (!user?.id) return
    const proc = processesRef.current.find(p => p.id === id)
    if (!proc || proc.paused) return
    const now = new Date().toISOString()
    stopTimer(id)
    setProcesses(prev => prev.map(p => p.id === id ? { ...p, paused: true, pausedAt: now } : p))
    supabase.from('mpl_active_timers').upsert({
      process_id: id,
      user_id: user.id,
      accumulated_seconds: proc.elapsed,
      paused_at: now,
      status: 'paused',
      updated_at: now,
    }, { onConflict: 'process_id' }).then(({ error }) => {
      if (error) console.error('[Meridian Dashboard] pause write failed', error)
    })
  }

  function handleProcessResume(id) {
    if (!user?.id) return
    const proc = processesRef.current.find(p => p.id === id)
    if (!proc || !proc.paused) return
    const now = new Date()
    const nowIso = now.toISOString()
    const pauseDur = proc.pausedAt
      ? Math.round((now.getTime() - new Date(proc.pausedAt).getTime()) / 1000)
      : 0
    const newPausedSeconds = (proc.pausedSeconds || 0) + pauseDur
    setProcesses(prev => prev.map(p => p.id === id
      ? { ...p, paused: false, pausedAt: null, pausedSeconds: newPausedSeconds }
      : p))
    startTimer(id)
    supabase.from('mpl_active_timers').upsert({
      process_id: id,
      user_id: user.id,
      accumulated_seconds: proc.elapsed,
      paused_at: null,
      pause_seconds_v2: newPausedSeconds,
      status: 'running',
      updated_at: nowIso,
    }, { onConflict: 'process_id' }).then(({ error }) => {
      if (error) console.error('[Meridian Dashboard] resume write failed', error)
    })
  }

  // ── mountMplPipWindow ───────────────────────────────────────────────────
  function mountMplPipWindow(pw) {
    const existing = pw.document.getElementById('meridian-mpl-pip-root')
    if (existing) existing.remove()
    const container = pw.document.createElement('div')
    container.id = 'meridian-mpl-pip-root'
    container.style.cssText = 'width:100%;height:100%'
    pw.document.body.appendChild(container)
    mplPipRootRef.current = ReactDOM.createRoot(container)
    mplPipRootRef.current.render(<PipErrorBoundary>{buildMplBar()}</PipErrorBoundary>)
  }

  // ── buildMplBar ─────────────────────────────────────────────────────────
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
        totalActivity={totalActivity}
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
        onMinimize={handleMinimize}
        onRestore={handleRestore}
        isMinimized={isMinimized}
        connectionStatus={connectionStatus}
        pipToast={pipToast}
        callsCount={callsCount}
        onCallLog={handleCallLog}
        onProcessPause={handleProcessPause}
        onProcessResume={handleProcessResume}
      />
    )
  }

  // ── MPL handlers ────────────────────────────────────────────────────────

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
      showToast('Call log failed')
      return
    }
    showToast('📞 Call logged')
    refetch()
  }

  async function handleStart() {
    if (!mplIsOpen) {
      const { width, height } = getMplSizeForState('idle', STAT_BUTTONS)
      const result = await openMplPip({ width, height, position: userSettingsRef.current.pip_position, theme: currentThemeRef.current })
      if (!result.ok) { showToast('Could not open widget — try again'); return }
      mountMplPipWindow(result.window)
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

    if (newCount > 2) {
      setSwimlaneOpen(true)
      pinActive()
    }
  }

  function handleProcessLog(id) {
    if (quickLogOpen) setQuickLogOpen(false)
    setChipStripProcessId(id)
    pin('categoryPicker')
  }

  async function handleChipStripConfirm(processId, categoryId, subcategoryId, note) {
    const proc = processesRef.current.find(p => p.id === processId)
    const elapsed = proc?.elapsed || 0
    setChipStripProcessId(null)

    const cat = categories.find(c => c.id === categoryId)
    const catName = cat?.name || 'Process'

    await handleConfirmProcess(processId, categoryId, subcategoryId, elapsed, note)
    showToast(`Logged ${catName} · ${Math.round(elapsed / 60) || 1} min`)
  }

  function handleChipStripCancel() {
    setChipStripProcessId(null)
    if (showSwimlane && swimlaneOpen) pinActive()
    else pin('idle')
  }

  // Quick Log — opens ManualEntryForm in PiP window at categoryPicker size
  function handleQuickLog() {
    // Fast path: widget is already open. Fully synchronous so resizeTo runs
    // inside the click's user activation window.
    if (mplIsOpen) {
      if (chipStripProcessId) setChipStripProcessId(null)
      setQuickLogOpen(true)
      pin('categoryPicker')
      return
    }
    // Slow path: widget not yet open. Must await openMplPip.
    handleQuickLogColdStart()
  }

  async function handleQuickLogColdStart() {
    if (chipStripProcessId) setChipStripProcessId(null)
    const size = getMplSizeForState('categoryPicker', STAT_BUTTONS)
    const result = await openMplPip({ ...size, position: userSettingsRef.current.pip_position, theme: currentThemeRef.current })
    if (!result.ok) { showToast('Could not open widget — try again'); return }
    mountMplPipWindow(result.window)
    setQuickLogOpen(true)
  }

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
    window.focus()
  }

  // ── CT widget launch (popup + resizeTo) ─────────────────────────────────
  function handleLaunch() {
    const url = window.location.origin + '/?mode=ct-widget'
    window.open(url, 'meridian-ct', 'popup,width=600,height=64,top=0,left=' + (screen.availWidth - 616))
  }

  // ── MPL PiP launch — direct, inside the user's click gesture ───────────
  async function handleLaunchMpl() {
    if (!user || !profile?.onboarding_complete) return
    const { width, height } = getMplSizeForState('idle', STAT_BUTTONS)
    const result = await openMplPip({
      width,
      height,
      position: userSettingsRef.current.pip_position,
      theme: currentThemeRef.current,
    })
    if (!result.ok) {
      showToast('Could not open widget — try again')
      return
    }
    mountMplPipWindow(result.window)
  }

  // ── Auth gate ───────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ background: '#0f0f1e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes meridian-spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(232,84,10,0.2)', borderTopColor: '#E8540A', borderRadius: '50%', animation: 'meridian-spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  if (!profile?.onboarding_complete) {
    return <Onboarding user={user} onComplete={handleOnboardingComplete} />
  }

  const initialTheme = profile?.settings?.theme ?? 'dark'

  return (
    <ThemeProvider initialTheme={initialTheme}>
      <Dashboard
        user={user}
        profile={profile}
        onLaunchPip={handleLaunch}
        onLaunchMpl={handleLaunchMpl}
        onRefreshProfile={refreshProfile}
      />
    </ThemeProvider>
  )
}
