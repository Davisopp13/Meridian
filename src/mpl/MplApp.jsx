import { useState, useEffect, useRef } from 'react'
import * as ReactDOM from 'react-dom/client'
import { usePipWindow } from '../hooks/usePipWindow.js'
import { usePendingTriggers } from '../hooks/usePendingTriggers.js'
import { useStats } from '../hooks/useStats.js'
import { supabase } from '../lib/supabase.js'
import MplPipBar from './MplPipBar.jsx'
import ManualEntryForm from '../components/ManualEntryForm.jsx'
import AuthScreen from '../components/auth/AuthScreen.jsx'
import { PipErrorBoundary } from '../components/PipErrorBoundary.jsx'
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
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [categories, setCategories] = useState([])
  const [isMinimized, setIsMinimized] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connected')
  const [pipToast, setPipToast] = useState(null)

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

  // ── Auto-launch PiP when tab opens as ?mode=mpl-widget ───────────────
  useEffect(() => {
    if (!isMplWidget) return
    if (authLoading || !user || !profile?.onboarding_complete) return
    if (widgetInitRef.current) return
    widgetInitRef.current = true

    document.body.classList.add('widget-mode')

    ;(async () => {
      const { width, height } = getMplSizeForState('idle', STAT_BUTTONS)
      const pw = await openPip({ width, height, position: 'bottom-right' })
      if (!pw) return
      mountPipWindow(pw)
      setTimeout(() => { try { window.close() } catch (e) {} }, 400)
    })()
  }, [isMplWidget, authLoading, user, profile])

  // ── Pending triggers ───────────────────────────────────────────────────
  usePendingTriggers(user?.id, {
    handleCaseStart: () => {},
    handleProcessStart: () => handleStart(),
  })

  // ── Handlers ──────────────────────────────────────────────────────────

  async function handleStart() {
    // Open PiP if not already open — use idle height since swimlane defaults to collapsed
    if (!isOpen) {
      try {
        const { width, height } = getMplSizeForState('idle', STAT_BUTTONS)
        const pw = await openPip({ width, height, position: 'bottom-right' })
        if (!pw) { showToast('Open the widget first from the dashboard'); return }
        mountPipWindow(pw)
        setTimeout(() => { try { window.close() } catch (e) {} }, 300)
      } catch (e) {
        showToast('Open the widget first from the dashboard')
        return
      }
    } else {
      pin('idle')
    }

    const id = crypto.randomUUID()
    setProcesses(prev => [...prev, { id, elapsed: 0, paused: false }])
    setShowSwimlane(true)
    setShowManualEntry(false)
    startTimer(id)
  }

  async function handleQuickLog() {
    if (!isOpen) {
      const size = getMplSizeForState('manualEntry', STAT_BUTTONS)
      const pw = await openPip({ ...size, position: 'bottom-right' })
      if (!pw) return
      mountPipWindow(pw)
      setTimeout(() => { try { window.close() } catch (e) {} }, 300)
    } else {
      pin('manualEntry')
    }
    setShowManualEntry(true)
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
    const ok = await safeWrite(supabase.from('mpl_entries').insert({
      user_id: user.id,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      minutes: Math.round(durationSeconds / 60) || 1,
      source: 'pip',
    }))
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

  async function handleManualLog(categoryId, subcategoryId, minutes) {
    if (!user) return
    const ok = await safeWrite(supabase.from('mpl_entries').insert({
      user_id: user.id,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      minutes,
      source: 'manual',
    }))
    if (ok) {
      setShowManualEntry(false)
      if (showSwimlane) pinActive()
      else pin('idle')
      refetch()
    }
  }

  function handleMinimize() {
    setIsMinimized(true)
    pin('minimized')
  }

  function handleRestore() {
    setIsMinimized(false)
    if (showManualEntry) { pin('manualEntry'); return }
    if (showSwimlane && swimlaneOpen) { pinActive(); return }
    pin('idle')
  }

  function handleOpenDashboard() {
    window.open(window.location.origin, 'meridian-dashboard')
  }

  // ── buildMplBar — JSX rendered into PiP window ────────────────────────
  function buildMplBar() {
    return (
      <MplPipBar
        processes={processes}
        categories={categories}
        showSwimlane={showSwimlane}
        swimlaneOpen={swimlaneOpen}
        onToggleSwimlane={handleToggleSwimlane}
        processCount={processCount}
        onOpenDashboard={handleOpenDashboard}
        onStart={handleStart}
        onQuickLog={handleQuickLog}
        onConfirmProcess={handleConfirmProcess}
        onCancelProcess={handleCancelProcess}
        onMinimize={handleMinimize}
        onRestore={handleRestore}
        isMinimized={isMinimized}
        connectionStatus={connectionStatus}
        pipToast={pipToast}
      >
        {showManualEntry && (
          <ManualEntryForm
            categories={categories}
            onClose={() => {
              setShowManualEntry(false)
              if (showSwimlane) pinActive()
              else pin('idle')
            }}
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
