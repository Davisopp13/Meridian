import { useState, useEffect, useRef } from 'react'
import { usePendingTriggers } from '../hooks/usePendingTriggers.js'
import { useStats } from '../hooks/useStats.js'
import { supabase } from '../lib/supabase.js'
import MplPipBar from './MplPipBar.jsx'
import ProcessPicker from '../components/overlays/ProcessPicker.jsx'
import ManualEntryForm from '../components/ManualEntryForm.jsx'
import AuthScreen from '../components/auth/AuthScreen.jsx'
import { getMplSizeForState } from '../lib/constants.js'

// ── Widget mode detection ──────────────────────────────────────────────────
const isMplWidget = new URLSearchParams(window.location.search).get('mode') === 'mpl-widget'

export default function MplApp() {
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

  // ── Resize helper ─────────────────────────────────────────────────────
  function resizeTo(stateKey) {
    const { width, height } = getMplSizeForState(stateKey, ['processes', 'total'])
    try { window.resizeTo(width, height) } catch (e) {}
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

  // ── Widget mode init ───────────────────────────────────────────────────
  const widgetInitRef = useRef(false)
  useEffect(() => {
    if (!isMplWidget) return
    if (authLoading || !user || !profile?.onboarding_complete) return
    if (widgetInitRef.current) return
    widgetInitRef.current = true

    document.body.classList.add('widget-mode')
    resizeTo('idle')
  }, [isMplWidget, authLoading, user, profile])

  // ── Dark theme token injection ────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById('meridian-mpl-theme')) return
    const style = document.createElement('style')
    style.id = 'meridian-mpl-theme'
    style.textContent = `
:root {
  --bg-body:        #0f1117;
  --bg-card:        rgba(255,255,255,0.05);
  --card-bg-subtle: rgba(255,255,255,0.03);
  --text-pri:       rgba(255,255,255,0.92);
  --text-sec:       rgba(255,255,255,0.55);
  --text-dim:       rgba(255,255,255,0.30);
  --divider:        rgba(255,255,255,0.08);
  --border:         rgba(255,255,255,0.10);
  --shadow-subtle:  0 2px 8px rgba(0,0,0,0.4);
  --case-focus:     rgba(232,84,10,0.10);
  --case-border:    rgba(232,84,10,0.25);
  --row-focus:      rgba(255,255,255,0.04);
  --amber-row:      rgba(217,119,6,0.15);
  --color-mbtn:     #003087;
  --color-mmark:    #E8540A;
  --color-resolved: #22c55e;
  --color-reclass:  #ef4444;
  --color-calls:    #3b82f6;
  --color-process:  #64748b;
  --color-process-navy: rgba(0,48,135,0.45);
  --color-awaiting: #f59e0b;
  --color-active-dot: #4ade80;
  --dash-bg:        #0f1117;
  --dash-card:      rgba(255,255,255,0.04);
  --dash-border:    rgba(255,255,255,0.08);
  --dash-text-pri:  rgba(255,255,255,0.92);
  --dash-text-sec:  rgba(255,255,255,0.55);
  --dash-text-dim:  rgba(255,255,255,0.30);
}
body { background: #0f1117; }
`
    document.head.appendChild(style)
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
    handleProcessStart: handleStart,
  })

  // ── Handlers ──────────────────────────────────────────────────────────

  function handleStart() {
    const id = crypto.randomUUID()
    setActiveProcess({ id, elapsed: 0, paused: false })
    setMplState('timerActive')
    startTimer()
    resizeTo('timerActive')
  }

  function handleQuickLog() {
    setMplState('manualEntry')
    resizeTo('manualEntry')
  }

  function handleLog() {
    stopTimer()
    setMplState('categoryPicker')
    resizeTo('categoryPicker')
  }

  function handleDiscard() {
    stopTimer()
    setActiveProcess(null)
    setMplState('idle')
    resizeTo('idle')
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
    try { window.resizeTo(300, 32) } catch (e) {}
  }

  function handleRestore() {
    setIsMinimized(false)
    resizeTo(mplState)
  }

  async function handlePickerConfirm(categoryId, subcategoryId, durationSeconds) {
    if (!user) return
    // Resize before await (user activation)
    resizeTo('idle')
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
    resizeTo('idle')
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

  // ── Widget mode render ─────────────────────────────────────────────────
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
          onClose={() => { setMplState('idle'); resizeTo('idle') }}
          onLog={handleManualLog}
        />
      )}
    </MplPipBar>
  )
}
