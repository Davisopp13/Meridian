import { useState, useEffect, useRef } from 'react'
import * as ReactDOM from 'react-dom/client'
import { usePipWindow } from '../hooks/usePipWindow.js'
import { usePendingTriggers } from '../hooks/usePendingTriggers.js'
import { useStats } from '../hooks/useStats.js'
import { supabase } from '../lib/supabase.js'
import MplPipBar from './MplPipBar.jsx'
import ProcessPicker from '../components/overlays/ProcessPicker.jsx'
import ManualEntryForm from '../components/ManualEntryForm.jsx'
import AuthScreen from '../components/auth/AuthScreen.jsx'
import { PipErrorBoundary } from '../components/PipErrorBoundary.jsx'
import { getMplSizeForState } from '../lib/constants.js'

export default function MplApp() {
  const { isOpen, openPip, resizeAndPin, pipRootRef } = usePipWindow()

  // ── Auth state ─────────────────────────────────────────────────────────
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // ── MPL state ──────────────────────────────────────────────────────────
  const [activeProcess, setActiveProcess] = useState(null) // { id, elapsed, paused } | null
  const [mplState, setMplState] = useState('idle')         // 'idle' | 'timerActive' | 'categoryPicker' | 'manualEntry'
  const [categories, setCategories] = useState([])
  const [isMinimized, setIsMinimized] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connected')
  const [pipToast, setPipToast] = useState(null)
  const [pendingLaunch, setPendingLaunch] = useState(false)

  // ── Stats ──────────────────────────────────────────────────────────────
  const { processes: processCount, refetch } = useStats()

  // ── Timer ref ──────────────────────────────────────────────────────────
  const timerRef = useRef(null)
  const toastTimerRef = useRef(null)

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

  // ── pin helper (replaces resizeTo) ────────────────────────────────────
  function pin(stateKey) {
    const { width, height } = getMplSizeForState(stateKey, ['processes', 'total'])
    resizeAndPin({ width, height }, 'bottom-right')
  }

  // ── Timer helpers ─────────────────────────────────────────────────────
  function startTimer() {
    if (timerRef.current) return
    timerRef.current = setInterval(() => {
      setActiveProcess(prev => prev ? { ...prev, elapsed: prev.elapsed + 1 } : prev)
    }, 1000)
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopTimer()
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // ── Auth: fetch current session + listen for changes ──────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        supabase.from('platform_users').select('*').eq('id', u.id).single()
          .then(({ data: p }) => { setProfile(p); setAuthLoading(false) })
      } else {
        setAuthLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        supabase.from('platform_users').select('*').eq('id', u.id).single()
          .then(({ data: p }) => setProfile(p))
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Category fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !profile?.team) return
    supabase
      .from('mpl_categories')
      .select('id, name, team, display_order, mpl_subcategories(id, name, display_order)')
      .eq('team', profile.team)
      .eq('is_active', true)
      .order('display_order')
      .order('display_order', { referencedTable: 'mpl_subcategories' })
      .then(({ data, error }) => {
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

  // ── Pending triggers ───────────────────────────────────────────────────
  usePendingTriggers(user?.id, {
    handleCaseStart: () => {},
    handleProcessStart: () => {
      if (isOpen) {
        // PiP already running — start timer directly (no openPip needed)
        handleStart()
      } else {
        // PiP not open — flag it, show prompt on host page for user to click
        setPendingLaunch(true)
      }
    },
  })

  // ── buildMplBar — JSX rendered into PiP window ────────────────────────
  function buildMplBar() {
    return (
      <MplPipBar
        activeProcess={activeProcess}
        processCount={processCount}
        mplState={mplState}
        onOpenDashboard={handleOpenDashboard}
        onStart={handleStart}
        onQuickLog={handleQuickLog}
        onLog={handleLog}
        onDiscard={handleDiscard}
        onPause={handlePause}
        onResume={handleResume}
        onMinimize={handleMinimize}
        onRestore={handleRestore}
        isMinimized={isMinimized}
        connectionStatus={connectionStatus}
        pipToast={pipToast}
      >
        {mplState === 'categoryPicker' && activeProcess && (
          <ProcessPicker
            categories={categories}
            elapsed={activeProcess.elapsed}
            onConfirm={handlePickerConfirm}
            onCancel={handleDiscard}
          />
        )}
        {mplState === 'manualEntry' && (
          <ManualEntryForm
            categories={categories}
            onClose={() => { setMplState('idle'); pin('idle') }}
            onLog={handleManualLog}
          />
        )}
      </MplPipBar>
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

  // ── Handlers ──────────────────────────────────────────────────────────

  async function handleStart() {
    if (!isOpen) {
      const size = getMplSizeForState('timerActive', ['processes', 'total'])
      const pw = await openPip({ ...size, position: 'bottom-right' })
      if (!pw) return
      mountPipWindow(pw)
      // Close host tab — only works if opened by script; silently ignored otherwise
      setTimeout(() => { try { window.close() } catch (e) {} }, 300)
    } else {
      pin('timerActive')
    }
    const id = crypto.randomUUID()
    setActiveProcess({ id, elapsed: 0, paused: false })
    setMplState('timerActive')
    startTimer()
  }

  async function handleQuickLog() {
    if (!isOpen) {
      const size = getMplSizeForState('manualEntry', ['processes', 'total'])
      const pw = await openPip({ ...size, position: 'bottom-right' })
      if (!pw) return
      mountPipWindow(pw)
      // Close host tab — only works if opened by script; silently ignored otherwise
      setTimeout(() => { try { window.close() } catch (e) {} }, 300)
    } else {
      pin('manualEntry')
    }
    setMplState('manualEntry')
  }

  function handleLog() {
    stopTimer()
    setMplState('categoryPicker')
    pin('categoryPicker')
  }

  function handleDiscard() {
    stopTimer()
    setActiveProcess(null)
    setMplState('idle')
    pin('idle')
  }

  function handlePause() {
    stopTimer()
    setActiveProcess(prev => prev ? { ...prev, paused: true } : prev)
  }

  function handleResume() {
    setActiveProcess(prev => prev ? { ...prev, paused: false } : prev)
    startTimer()
  }

  function handleMinimize() {
    setIsMinimized(true)
    pin('minimized')
  }

  function handleRestore() {
    setIsMinimized(false)
    pin(mplState)
  }

  async function handlePickerConfirm(categoryId, subcategoryId, durationSeconds) {
    if (!user) return
    pin('idle')
    const minutes = Math.round(durationSeconds / 60) || 1
    const ok = await safeWrite(supabase.from('mpl_entries').insert({
      user_id: user.id,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      minutes,
      source: 'pip',
    }))
    if (ok) {
      setActiveProcess(null)
      setMplState('idle')
      refetch()
    }
  }

  async function handleManualLog(categoryId, subcategoryId, minutes) {
    if (!user) return
    pin('idle')
    const ok = await safeWrite(supabase.from('mpl_entries').insert({
      user_id: user.id,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      minutes,
      source: 'manual',
    }))
    if (ok) {
      setMplState('idle')
      refetch()
    }
  }

  function handleOpenDashboard() {
    window.open(window.location.origin, 'meridian-dashboard')
  }

  // ── Auth loading / not logged in ───────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0f0f1e',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: '"Inter", system-ui, sans-serif',
        fontSize: 12,
      }}>
        Loading…
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  if (!profile?.onboarding_complete) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0f0f1e',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: '"Inter", system-ui, sans-serif',
        fontSize: 12,
        textAlign: 'center',
        padding: 24,
      }}>
        Please complete onboarding in the main Meridian dashboard first.
      </div>
    )
  }

  // ── Launcher page render ───────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/meridian-mark-192.png" width={48} height={48} style={{ borderRadius: 10, marginBottom: 16 }} />
        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Meridian — Processes
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 24 }}>
          {isOpen ? 'Widget is running — this tab will close' : pendingLaunch ? 'Trigger received — click to start' : 'Click to launch widget'}
        </div>
        {!isOpen && (
          <button
            onClick={() => { setPendingLaunch(false); handleStart() }}
            style={{
              height: 36, padding: '0 20px', borderRadius: 18,
              background: pendingLaunch ? 'rgba(96,165,250,0.25)' : 'rgba(96,165,250,0.15)',
              border: '1px solid rgba(96,165,250,0.3)',
              color: '#60a5fa', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ▶ {pendingLaunch ? 'Start Process Timer' : 'Launch Widget'}
          </button>
        )}
      </div>
    </div>
  )
}
