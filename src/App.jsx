import { useState, useEffect, useRef } from 'react'
import * as ReactDOM from 'react-dom/client'
import { usePipWindow } from './hooks/usePipWindow.js'
import { useStats } from './hooks/useStats.js'
import { useContextFocus } from './hooks/useContextFocus.js'
import { supabase } from './lib/supabase.js'
import PipBar from './PipBar.jsx'
import Onboarding from './components/Onboarding.jsx'
import Dashboard from './components/Dashboard.jsx'
import AuthScreen from './components/auth/AuthScreen.jsx'
import SwimlaneTray from './components/SwimlaneTray.jsx'
import RFCPrompt from './components/overlays/RFCPrompt.jsx'
import ProcessPicker from './components/overlays/ProcessPicker.jsx'

const MERIDIAN_HOST = import.meta.env.VITE_APP_URL || window.location.origin

function getBarSize(cases, processes, trayOpen, overlayOpen) {
  if (overlayOpen) return 'overlay'
  if (trayOpen) return 'trayOpen'
  if (cases.length > 0 && processes.length > 0) return 'bothActive'
  if (cases.length > 0) return 'caseActive'
  if (processes.length > 0) return 'processActive'
  return 'idle'
}

export default function App() {
  const { pipWindow, isOpen, openPip, resizePip, pipRootRef } = usePipWindow()

  // ── App state ─────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [cases, setCases] = useState([])
  const [processes, setProcesses] = useState([])
  const [focusedCaseId, setFocusedCaseId] = useState(null)
  const [trayOpen, setTrayOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [rfcPending, setRfcPending] = useState(null) // { sessionId, caseNum, elapsed }
  const [pickerPending, setPickerPending] = useState(null) // { processId, elapsed }
  const [lastTrigger, setLastTrigger] = useState('cases')
  const [categories, setCategories] = useState([])
  const [barSessionId, setBarSessionId] = useState(null)
  const [pipToast, setPipToast] = useState(null)

  // ── Toast helper ──────────────────────────────────────────────────────────
  const toastTimerRef = useRef(null)
  function showPipToast(message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setPipToast(message)
    toastTimerRef.current = setTimeout(() => {
      setPipToast(null)
      toastTimerRef.current = null
    }, 2000)
  }

  // ── Safe Supabase write — shows toast on error, returns bool ──────────────
  async function safeWrite(promise) {
    const { error } = await promise
    if (error) {
      console.error('[Meridian] Supabase write failed', error)
      showPipToast('Connection error — data may not have saved.')
      return false
    }
    return true
  }

  // ── Timer ref maps (keyed by session id) ─────────────────────────────────
  const caseTimers = useRef({})     // { [caseId]: intervalId }
  const processTimers = useRef({})  // { [processId]: intervalId }

  // ── Timer helpers ─────────────────────────────────────────────────────────
  function startCaseTimer(id) {
    if (caseTimers.current[id]) return
    caseTimers.current[id] = setInterval(() => {
      setCases(prev => prev.map(c => c.id === id ? { ...c, elapsed: c.elapsed + 1 } : c))
    }, 1000)
  }

  function stopCaseTimer(id) {
    clearInterval(caseTimers.current[id])
    delete caseTimers.current[id]
  }

  function startProcessTimer(id) {
    if (processTimers.current[id]) return
    processTimers.current[id] = setInterval(() => {
      setProcesses(prev => prev.map(p => p.id === id ? { ...p, elapsed: p.elapsed + 1 } : p))
    }, 1000)
  }

  function stopProcessTimer(id) {
    clearInterval(processTimers.current[id])
    delete processTimers.current[id]
  }

  // ── bar_sessions tracking ─────────────────────────────────────────────────
  // Ref always has latest values so the isOpen effect avoids stale closures
  const closeBarRef = useRef(null)
  closeBarRef.current = { barSessionId, cases, processes }

  const prevIsOpenRef = useRef(false)
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current
    prevIsOpenRef.current = isOpen
    if (wasOpen && !isOpen) {
      // Close bar_sessions row
      if (closeBarRef.current.barSessionId) {
        const { barSessionId: bsId, cases: c, processes: p } = closeBarRef.current
        supabase.from('bar_sessions')
          .update({
            ended_at: new Date().toISOString(),
            total_cases: c.length,
            total_processes: p.length,
          })
          .eq('id', bsId)
          .then()
      }
      // Reset all active state — PiP was closed externally
      Object.values(caseTimers.current).forEach(clearInterval)
      caseTimers.current = {}
      Object.values(processTimers.current).forEach(clearInterval)
      processTimers.current = {}
      setCases([])
      setProcesses([])
      setFocusedCaseId(null)
      setTrayOpen(false)
      setIsMinimized(false)
      setOverlayOpen(false)
      setRfcPending(null)
      setPickerPending(null)
      setLastTrigger('cases')
      setBarSessionId(null)
      setPipToast(null)
    }
  }, [isOpen])

  async function createBarSession(userId) {
    const { data } = await supabase
      .from('bar_sessions')
      .insert({ user_id: userId })
      .select('id')
      .single()
    if (data) setBarSessionId(data.id)
  }

  // ── Auth: fetch current session + listen for changes ────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        supabase.from('profiles').select('*').eq('id', u.id).single()
          .then(({ data: p }) => { setProfile(p); setAuthLoading(false) })
      } else {
        setAuthLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        supabase.from('profiles').select('*').eq('id', u.id).single()
          .then(({ data: p }) => setProfile(p))
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Context focus (derived) ────────────────────────────────────────────────
  const { laneSplit } = useContextFocus(cases, processes, lastTrigger)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const { resolved, reclass, calls, processes: processCount, refetch } = useStats()
  const stats = { resolved, reclass, calls, processes: processCount }

  // ── Fetch process categories once after auth ──────────────────────────────
  useEffect(() => {
    if (!user) return
    supabase
      .from('process_categories')
      .select('id, name, team, sort_order')
      .eq('active', true)
      .order('team')
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) console.error('[Meridian] process_categories fetch failed', error)
        if (data) setCategories(data)
      })
  }, [user])

  // ── Auto-open tray on 3rd case or 3rd process ─────────────────────────────
  useEffect(() => {
    if (cases.length > 2 || processes.length > 2) {
      setTrayOpen(true)
    }
  }, [cases.length, processes.length])

  // ── Ensure PiP window is open; restore if minimized ──────────────────────
  async function ensurePipOpen() {
    if (isMinimized) {
      setIsMinimized(false)
    }
    if (!isOpen) {
      const pw = await openPip()
      if (!pw) return false
      const container = pw.document.createElement('div')
      pw.document.body.appendChild(container)
      pipRootRef.current = ReactDOM.createRoot(container)
      pipRootRef.current.render(buildPipBar())
      if (user) createBarSession(user.id)
    }
    return true
  }

  // ── Bookmarklet handlers ──────────────────────────────────────────────────

  async function handleCaseStart({ caseNumber, accountId, caseType, caseSubtype }) {
    if (!user) return
    const ok = await ensurePipOpen()
    if (!ok) return

    const { data, error } = await supabase
      .from('case_sessions')
      .insert({
        user_id: user.id,
        case_number: caseNumber,
        account_id: accountId || null,
        case_type: caseType || null,
        case_subtype: caseSubtype || null,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[Meridian] Failed to create case session', error)
      return
    }

    const sessionId = data.id
    const newCase = { id: sessionId, caseNum: caseNumber, elapsed: 0, paused: false, awaiting: false }

    const nextCases = [...cases, newCase]
    const willOpenTray = nextCases.length > 2
    if (willOpenTray) setTrayOpen(true)
    setCases(nextCases)
    setFocusedCaseId(sessionId)
    setLastTrigger('cases')
    startCaseTimer(sessionId)
    resizePip(willOpenTray ? 'trayOpen' : getBarSize(nextCases, processes, trayOpen, false))
  }

  async function handleProcessStart() {
    const ok = await ensurePipOpen()
    if (!ok) return

    const id = crypto.randomUUID()
    const newProcess = { id, elapsed: 0, paused: false }

    setProcesses(prev => {
      const next = [...prev, newProcess]
      if (next.length > 2) setTrayOpen(true)
      return next
    })
    setLastTrigger('processes')
    setPickerPending({ processId: id, elapsed: 0 })
    setOverlayOpen(true)
    startProcessTimer(id)
    resizePip('overlay')
  }

  // ── Handler ref — updated every render so message listener never goes stale ─
  const handlersRef = useRef({})
  handlersRef.current = { handleCaseStart, handleProcessStart }

  // ── Bookmarklet message listener ──────────────────────────────────────────
  useEffect(() => {
    function handleMessage(e) {
      if (!e.data || !e.data.type) return
      if (!e.data.type.startsWith('MERIDIAN_')) return
      const { type, caseNumber, accountId, caseType, caseSubtype } = e.data
      if (type === 'MERIDIAN_CASE_START' && caseNumber) {
        console.log('[Meridian] CASE_START received:', caseNumber)
        handlersRef.current.handleCaseStart({ caseNumber, accountId, caseType, caseSubtype })
      }
      if (type === 'MERIDIAN_PROCESS_START') {
        console.log('[Meridian] PROCESS_START received')
        handlersRef.current.handleProcessStart()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // ── Re-render PipBar into PiP window on every state change ────────────────
  useEffect(() => {
    if (!pipRootRef.current) return
    pipRootRef.current.render(buildPipBar())
  })

  // ── Build PipBar element with current state + handlers ────────────────────
  function buildPipBar() {
    return (
      <PipBar
        cases={cases}
        processes={processes}
        focusedCaseId={focusedCaseId}
        trayOpen={trayOpen}
        isMinimized={isMinimized}
        stats={stats}
        pipToast={pipToast}
        onOpenDashboard={handleOpenDashboard}
        onMinimize={handleMinimize}
        onRestore={handleRestore}
        onToggleTray={handleToggleTray}
        onFocusCase={handleFocusCase}
        onPauseCase={handlePauseCase}
        onResumeCase={handleResumeCase}
        onCloseCase={handleBarPillClose}
        onLogProcess={handleLogProcess}
        onCloseProcess={handleCloseProcess}
        onResolve={handleResolve}
        onReclass={handleReclass}
        onCall={handleCall}
        onNewProcess={handleNewProcess}
      >
        {rfcPending ? (
          <RFCPrompt
            caseNumber={rfcPending.caseNum}
            onYes={handleRFCYes}
            onNo={handleRFCNo}
          />
        ) : pickerPending ? (
          <ProcessPicker
            categories={categories}
            elapsed={pickerPending.elapsed}
            onConfirm={handlePickerConfirm}
            onCancel={handlePickerCancel}
          />
        ) : trayOpen ? (
          <SwimlaneTray
            laneSplit={laneSplit}
            cases={cases}
            focusedCaseId={focusedCaseId}
            onFocusCase={handleFocusCase}
            onResolveCase={handleResolveCase}
            onReclassCase={handleReclassCase}
            onCallCase={handleCallCase}
            onAwaitingCase={handleAwaitingCase}
            onResumeCase={handleResumeCase}
            onNotACase={handleNotACase}
            onRFC={handleRFC}
            onCloseSession={handleCloseCase}
            processes={processes}
            categories={categories}
            onConfirmProcess={handleConfirmProcess}
            onCancelProcess={handleCloseProcess}
            onNewProcess={handleNewProcess}
          />
        ) : null}
      </PipBar>
    )
  }

  // ── Launch PiP window ─────────────────────────────────────────────────────
  async function handleLaunch() {
    const pw = await openPip()
    if (!pw) return

    const container = pw.document.createElement('div')
    pw.document.body.appendChild(container)
    pipRootRef.current = ReactDOM.createRoot(container)
    pipRootRef.current.render(buildPipBar())
    if (user) createBarSession(user.id)
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleOpenDashboard() {
    window.focus()
  }

  function handleMinimize() {
    setIsMinimized(true)
    resizePip('minimized')
  }

  function handleRestore() {
    setIsMinimized(false)
    resizePip(getBarSize(cases, processes, trayOpen, overlayOpen))
  }

  function handleToggleTray() {
    const next = !trayOpen
    setTrayOpen(next)
    resizePip(next ? 'trayOpen' : getBarSize(cases, processes, false, overlayOpen))
  }

  function handleFocusCase(id) {
    setFocusedCaseId(id)
  }

  function handlePauseCase(id) {
    stopCaseTimer(id)
    setCases(prev => prev.map(c => c.id === id ? { ...c, paused: true } : c))
  }

  async function handleResumeCase(id) {
    await supabase.from('case_sessions')
      .update({ status: 'active' })
      .eq('id', id)
    setCases(prev => prev.map(c => c.id === id ? { ...c, paused: false, awaiting: false } : c))
    startCaseTimer(id)
  }

  async function handleCloseCase(id) {
    const c = cases.find(x => x.id === id)
    if (!c || !user) return
    stopCaseTimer(id)
    await supabase.from('case_sessions')
      .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed' })
      .eq('id', id)
    const remaining = cases.filter(x => x.id !== id)
    setCases(remaining)
    if (focusedCaseId === id) setFocusedCaseId(remaining[0]?.id || null)
    refetch()
    maybeShrinkToIdle(remaining, processes)
  }

  // Bar pill × — pause timer, open RFC overlay (session closed by RFC handlers)
  function handleBarPillClose(id) {
    const c = cases.find(x => x.id === id)
    if (!c) return
    stopCaseTimer(id)
    setRfcPending({ sessionId: id, caseNum: c.caseNum, elapsed: c.elapsed })
    setOverlayOpen(true)
    resizePip('overlay')
  }

  function handleLogProcess(id) {
    const p = processes.find(x => x.id === id)
    if (!p) return
    setPickerPending({ processId: id, elapsed: p.elapsed })
    setOverlayOpen(true)
    resizePip('overlay')
  }

  function handleCloseProcess(id) {
    stopProcessTimer(id)
    const nextProcesses = processes.filter(p => p.id !== id)
    setProcesses(nextProcesses)
    resizePip(getBarSize(cases, nextProcesses, trayOpen, false))
  }

  async function handleResolve() {
    if (!focusedCaseId || !user) return
    const c = cases.find(x => x.id === focusedCaseId)
    if (!c) return
    const ok = await safeWrite(supabase.from('case_events').insert({
      session_id: focusedCaseId,
      user_id: user.id,
      type: 'resolved',
      excluded: false,
      rfc: false,
    }))
    if (!ok) return
    setRfcPending({ sessionId: focusedCaseId, caseNum: c.caseNum, elapsed: c.elapsed })
    setOverlayOpen(true)
    resizePip('overlay')
  }

  async function handleReclass() {
    if (!focusedCaseId || !user) return
    const c = cases.find(x => x.id === focusedCaseId)
    if (!c) return
    const ok = await safeWrite(supabase.from('case_events').insert({
      session_id: focusedCaseId,
      user_id: user.id,
      type: 'reclassified',
      excluded: false,
      rfc: false,
    }))
    if (!ok) return
    setRfcPending({ sessionId: focusedCaseId, caseNum: c.caseNum, elapsed: c.elapsed })
    setOverlayOpen(true)
    resizePip('overlay')
  }

  async function handleRFCYes() {
    if (!rfcPending || !user) return
    const { sessionId, elapsed } = rfcPending
    stopCaseTimer(sessionId)
    const ok1 = await safeWrite(supabase.from('case_events').insert({
      session_id: sessionId,
      user_id: user.id,
      type: 'rfc',
      excluded: false,
      rfc: true,
    }))
    if (!ok1) return
    await safeWrite(supabase.from('case_sessions')
      .update({ ended_at: new Date().toISOString(), duration_s: elapsed, status: 'closed' })
      .eq('id', sessionId))
    const remaining = cases.filter(x => x.id !== sessionId)
    setCases(remaining)
    if (focusedCaseId === sessionId) setFocusedCaseId(remaining[0]?.id || null)
    setRfcPending(null)
    setOverlayOpen(false)
    refetch()
    maybeShrinkToIdle(remaining, processes)
  }

  async function handleRFCNo() {
    if (!rfcPending || !user) return
    const { sessionId, elapsed } = rfcPending
    stopCaseTimer(sessionId)
    await safeWrite(supabase.from('case_sessions')
      .update({ ended_at: new Date().toISOString(), duration_s: elapsed, status: 'closed' })
      .eq('id', sessionId))
    const remaining = cases.filter(x => x.id !== sessionId)
    setCases(remaining)
    if (focusedCaseId === sessionId) setFocusedCaseId(remaining[0]?.id || null)
    setRfcPending(null)
    setOverlayOpen(false)
    refetch()
    maybeShrinkToIdle(remaining, processes)
  }

  async function handleCall() {
    if (!focusedCaseId || !user) return
    const ok = await safeWrite(supabase.from('case_events').insert({
      session_id: focusedCaseId,
      user_id: user.id,
      type: 'call',
      excluded: false,
      rfc: false,
    }))
    if (ok) refetch()
  }

  function handleNewProcess() {
    const id = crypto.randomUUID()
    setProcesses(prev => [...prev, { id, elapsed: 0, paused: false }])
    setPickerPending({ processId: id, elapsed: 0 })
    setOverlayOpen(true)
    setLastTrigger('processes')
    startProcessTimer(id)
    resizePip('overlay')
  }

  async function handlePickerConfirm(categoryName, durationSeconds) {
    if (!pickerPending || !user) return
    const { processId } = pickerPending
    stopProcessTimer(processId)
    const ok = await safeWrite(supabase.from('process_sessions').insert({
      user_id: user.id,
      category: categoryName,
      duration_s: durationSeconds,
      entry_mode: 'timer',
    }))
    if (!ok) return
    const remaining = processes.filter(p => p.id !== processId)
    setProcesses(remaining)
    setPickerPending(null)
    setOverlayOpen(false)
    refetch()
    if (cases.length === 0 && remaining.length === 0) {
      setTrayOpen(false)
      resizePip('idle')
    } else {
      resizePip(getBarSize(cases, remaining, trayOpen, false))
    }
  }

  function handlePickerCancel() {
    setPickerPending(null)
    setOverlayOpen(false)
    resizePip(getBarSize(cases, processes, trayOpen, false))
  }

  // ── Helper: resize/close tray when all sessions gone ─────────────────────
  function maybeShrinkToIdle(remainingCases, remainingProcesses) {
    if (remainingCases.length === 0 && remainingProcesses.length === 0) {
      setTrayOpen(false)
      resizePip('idle')
    } else {
      resizePip(getBarSize(remainingCases, remainingProcesses, trayOpen, false))
    }
  }

  // ── Tray-specific handlers ─────────────────────────────────────────────────

  async function handleResolveCase(id) {
    if (!user) return
    await supabase.from('case_events').insert({
      session_id: id,
      user_id: user.id,
      type: 'resolved',
      excluded: false,
      rfc: false,
    })
    refetch()
    // CaseLaneRow shows inline RFC prompt; onRFC or onCloseSession handles close
  }

  async function handleReclassCase(id) {
    if (!user) return
    await supabase.from('case_events').insert({
      session_id: id,
      user_id: user.id,
      type: 'reclassified',
      excluded: false,
      rfc: false,
    })
    refetch()
    // CaseLaneRow shows inline RFC prompt; onRFC or onCloseSession handles close
  }

  async function handleCallCase(id) {
    if (!user) return
    await supabase.from('case_events').insert({
      session_id: id,
      user_id: user.id,
      type: 'call',
      excluded: false,
      rfc: false,
    })
    refetch()
  }

  async function handleAwaitingCase(id) {
    if (!user) return
    await supabase.from('case_sessions')
      .update({ status: 'awaiting', awaiting_since: new Date().toISOString() })
      .eq('id', id)
    stopCaseTimer(id)
    setCases(prev => prev.map(c =>
      c.id === id ? { ...c, awaiting: true, paused: true } : c
    ))
  }

  async function handleNotACase(id) {
    if (!user) return
    const c = cases.find(x => x.id === id)
    if (!c) return
    stopCaseTimer(id)
    await supabase.from('case_events').insert({
      session_id: id,
      user_id: user.id,
      type: 'not_a_case',
      excluded: true,
      rfc: false,
    })
    await supabase.from('case_sessions')
      .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed' })
      .eq('id', id)
    const remaining = cases.filter(x => x.id !== id)
    setCases(remaining)
    if (focusedCaseId === id) setFocusedCaseId(remaining[0]?.id || null)
    refetch()
    maybeShrinkToIdle(remaining, processes)
  }

  async function handleRFC(id) {
    if (!user) return
    const c = cases.find(x => x.id === id)
    if (!c) return
    stopCaseTimer(id)
    await supabase.from('case_events').insert({
      session_id: id,
      user_id: user.id,
      type: 'rfc',
      excluded: false,
      rfc: true,
    })
    await supabase.from('case_sessions')
      .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed' })
      .eq('id', id)
    const remaining = cases.filter(x => x.id !== id)
    setCases(remaining)
    if (focusedCaseId === id) setFocusedCaseId(remaining[0]?.id || null)
    refetch()
    maybeShrinkToIdle(remaining, processes)
  }

  async function handleConfirmProcess(id, categoryName, durationSeconds) {
    if (!user) return
    stopProcessTimer(id)
    const ok = await safeWrite(supabase.from('process_sessions').insert({
      user_id: user.id,
      category: categoryName,
      duration_s: durationSeconds,
      entry_mode: 'timer',
    }))
    if (!ok) return
    const remaining = processes.filter(p => p.id !== id)
    setProcesses(remaining)
    refetch()
    maybeShrinkToIdle(cases, remaining)
  }

  // ── Onboarding complete ───────────────────────────────────────────────────
  function handleOnboardingComplete(updatedProfile) {
    setProfile(updatedProfile)
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────
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

  if (!profile?.onboarded) {
    return <Onboarding user={user} onComplete={handleOnboardingComplete} />
  }

  return <Dashboard user={user} profile={profile} onLaunchPip={handleLaunch} />
}
