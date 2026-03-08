import { useState, useEffect, useRef } from 'react'
import * as ReactDOM from 'react-dom/client'
import { usePipWindow } from './hooks/usePipWindow.js'
import { useStats } from './hooks/useStats.js'
import { useContextFocus } from './hooks/useContextFocus.js'
import { usePendingTriggers } from './hooks/usePendingTriggers.js'
import { supabase } from './lib/supabase.js'
import PipBar from './PipBar.jsx'
import Onboarding from './components/Onboarding.jsx'
import Dashboard from './components/Dashboard.jsx'
import PendingTriggerBanner from './components/PendingTriggerBanner.jsx'
import AuthScreen from './components/auth/AuthScreen.jsx'
import SwimlaneTray from './components/SwimlaneTray.jsx'
import RFCPrompt from './components/overlays/RFCPrompt.jsx'
import ProcessPicker from './components/overlays/ProcessPicker.jsx'
import ManualEntryForm from './components/ManualEntryForm.jsx'
import { getNewYorkDateKey, getNewYorkDayRange } from './lib/timezone.js'

const PIP_STATE_STORAGE_PREFIX = 'meridian:pip-state'

function getBarSize(cases, processes, trayOpen, overlayOpen) {
  if (overlayOpen) return 'overlay'
  if (trayOpen) return 'trayOpen'
  if (cases.length > 0 && processes.length > 0) return 'bothActive'
  if (cases.length > 0) return 'caseActive'
  if (processes.length > 0) return 'processActive'
  return 'idle'
}

function getPipStateStorageKey(userId, dateKey) {
  return `${PIP_STATE_STORAGE_PREFIX}:${userId}:${dateKey}`
}

function getElapsedFromTimestamps(startedAt, stoppedAt = null) {
  if (!startedAt) return 0

  const startMs = new Date(startedAt).getTime()
  const stopMs = stoppedAt ? new Date(stoppedAt).getTime() : Date.now()
  if (Number.isNaN(startMs) || Number.isNaN(stopMs)) return 0

  return Math.max(0, Math.floor((stopMs - startMs) / 1000))
}

function restoreCaseFromRow(row) {
  const awaiting = row.status === 'awaiting'
  return {
    id: row.id,
    caseNum: row.case_number,
    elapsed: Math.max(
      Number(row.duration_s) || 0,
      getElapsedFromTimestamps(row.created_at, awaiting ? row.awaiting_since : null)
    ),
    paused: awaiting,
    awaiting,
  }
}

export default function App() {
  const { pipWindow, isOpen, openPip, resizeAndPin, pipRootRef } = usePipWindow()

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
  const [pendingTrigger, setPendingTrigger] = useState(null) // queued trigger when PiP not open
  const [manualEntryOpen, setManualEntryOpen] = useState(false)
  const restoredStateKeyRef = useRef(null)
  const hasHydratedPipStateRef = useRef(false)

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

  function syncTimers(nextCases, nextProcesses) {
    Object.values(caseTimers.current).forEach(clearInterval)
    caseTimers.current = {}
    Object.values(processTimers.current).forEach(clearInterval)
    processTimers.current = {}

    nextCases.forEach(c => {
      if (!c.paused && !c.awaiting) startCaseTimer(c.id)
    })

    nextProcesses.forEach(p => {
      if (!p.paused) startProcessTimer(p.id)
    })
  }

  function mountPipWindow(pw) {
    const existing = pw.document.getElementById('meridian-pip-root')
    if (existing) existing.remove()

    const container = pw.document.createElement('div')
    container.id = 'meridian-pip-root'
    pw.document.body.appendChild(container)
    pipRootRef.current = ReactDOM.createRoot(container)
    pipRootRef.current.render(buildPipBar())
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
      setBarSessionId(null)
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

  // ── Context focus (derived) ────────────────────────────────────────────────
  const { laneSplit } = useContextFocus(cases, processes, lastTrigger)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const { resolved, reclass, calls, processes: processCount, refetch } = useStats()
  const stats = { resolved, reclass, calls, processes: processCount }

  // ── Fetch process categories (team-filtered) after auth ───────────────────
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
        if (error) console.error('[Meridian] mpl_categories fetch failed', error)
        if (data) setCategories(data)
      })
  }, [user, profile])

  // ── Auto-open tray on 3rd case or 3rd process ─────────────────────────────
  useEffect(() => {
    if (cases.length > 2 || processes.length > 2) {
      setTrayOpen(true)
    }
  }, [cases.length, processes.length])

  useEffect(() => {
    if (!user?.id) return

    const dateKey = getNewYorkDateKey()
    const storageKey = getPipStateStorageKey(user.id, dateKey)
    if (!hasHydratedPipStateRef.current || restoredStateKeyRef.current !== storageKey) return

    if (cases.length === 0 && processes.length === 0) {
      localStorage.removeItem(storageKey)
      return
    }

    localStorage.setItem(storageKey, JSON.stringify({
      dateKey,
      cases,
      processes,
      focusedCaseId,
      trayOpen,
      lastTrigger,
      savedAt: new Date().toISOString(),
    }))
  }, [user?.id, cases, processes, focusedCaseId, trayOpen, lastTrigger])

  useEffect(() => {
    if (!user?.id) {
      restoredStateKeyRef.current = null
      hasHydratedPipStateRef.current = false
      return
    }

    const { dateKey, start, end } = getNewYorkDayRange()
    const storageKey = getPipStateStorageKey(user.id, dateKey)
    if (restoredStateKeyRef.current === storageKey) return

    restoredStateKeyRef.current = storageKey

    async function restoreActiveState() {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          const restoredCases = Array.isArray(parsed.cases) ? parsed.cases : []
          const restoredProcesses = Array.isArray(parsed.processes) ? parsed.processes : []
          const nextFocusedCaseId = restoredCases.some(c => c.id === parsed.focusedCaseId)
            ? parsed.focusedCaseId
            : restoredCases[0]?.id || null

          setCases(restoredCases)
          setProcesses(restoredProcesses)
          setFocusedCaseId(nextFocusedCaseId)
          setTrayOpen(Boolean(parsed.trayOpen) || restoredCases.length > 2 || restoredProcesses.length > 2)
          setLastTrigger(parsed.lastTrigger || 'cases')
          syncTimers(restoredCases, restoredProcesses)
          hasHydratedPipStateRef.current = true
          return
        } catch (error) {
          console.warn('[Meridian] Failed to restore PiP state snapshot', error)
          localStorage.removeItem(storageKey)
        }
      }

      const { data, error } = await supabase
        .from('ct_cases')
        .select('id, case_number, status, awaiting_since, created_at, duration_s')
        .eq('user_id', user.id)
        .in('status', ['active', 'awaiting'])
        .is('ended_at', null)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())

      if (error) {
        console.error('[Meridian] Failed to restore active cases', error)
        return
      }

      const restoredCases = (data || []).map(restoreCaseFromRow)
      setCases(restoredCases)
      setProcesses([])
      setFocusedCaseId(restoredCases[0]?.id || null)
      setTrayOpen(restoredCases.length > 2)
      setLastTrigger(restoredCases.length > 0 ? 'cases' : 'processes')
      syncTimers(restoredCases, [])
      hasHydratedPipStateRef.current = true
    }

    restoreActiveState()
  }, [user?.id])

  // ── Ensure PiP window is open; restore if minimized ──────────────────────
  async function ensurePipOpen() {
    if (isMinimized) {
      setIsMinimized(false)
    }
    if (!isOpen) {
      const pw = await openPip()
      if (!pw) return false
      mountPipWindow(pw)
      if (user) createBarSession(user.id)
    }
    return true
  }

  // ── Bookmarklet handlers ──────────────────────────────────────────────────

  async function handleCaseStart({ caseNumber, accountId, caseType, caseSubtype }) {
    if (!user) return
    if (!pipRootRef.current) {
      // PiP not open — queue the trigger so the banner can handle it
      setPendingTrigger({ type: 'case', data: { caseNumber, accountId, caseType, caseSubtype } })
      return
    }
    if (isMinimized) setIsMinimized(false)

    const { data, error } = await supabase
      .from('ct_cases')
      .insert({
        user_id: user.id,
        case_number: caseNumber,
        case_type: caseType || null,
        case_subtype: caseSubtype || null,
        source: 'pip',
        entry_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
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
    resizeAndPin(willOpenTray ? 'trayOpen' : getBarSize(nextCases, processes, trayOpen, false))
  }

  async function handleProcessStart() {
    if (!user || !profile?.onboarding_complete) return
    if (!pipRootRef.current) {
      // PiP not open — queue the trigger
      setPendingTrigger({ type: 'process', data: {} })
      return
    }
    if (isMinimized) setIsMinimized(false)

    const id = crypto.randomUUID()
    const newProcess = { id, elapsed: 0, paused: false }
    const nextProcesses = [...processes, newProcess]
    const willOpenTray = nextProcesses.length > 2
    setProcesses(nextProcesses)
    if (willOpenTray) setTrayOpen(true)
    setLastTrigger('processes')
    startProcessTimer(id)
    resizeAndPin(willOpenTray ? 'trayOpen' : getBarSize(cases, nextProcesses, trayOpen, false))
  }

  usePendingTriggers(user?.id, { handleCaseStart, handleProcessStart })

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
            onScreenChange={handlePickerScreenChange}
          />
        ) : manualEntryOpen ? (
          <ManualEntryForm
            categories={categories}
            onClose={handleManualEntryClose}
            onLog={handleManualLog}
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
    if (!user || !profile?.onboarding_complete) return
    const pw = await openPip()
    if (!pw) return

    mountPipWindow(pw)
    if (user) createBarSession(user.id)
  }

  async function handlePendingTriggerLaunch() {
    const trigger = pendingTrigger
    setPendingTrigger(null)
    if (!trigger) return

    const pw = await openPip()
    if (!pw) return

    mountPipWindow(pw)
    if (user) createBarSession(user.id)

    // Now process the queued trigger — PiP is open so it won't queue again
    if (trigger.type === 'case') {
      handleCaseStart(trigger.data)
    } else if (trigger.type === 'process') {
      handleProcessStart()
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleOpenDashboard() {
    window.focus()
  }

  function handleMinimize() {
    setIsMinimized(true)
    resizeAndPin('minimized')
  }

  function handleRestore() {
    setIsMinimized(false)
    resizeAndPin(getBarSize(cases, processes, trayOpen, overlayOpen))
  }

  function handleToggleTray() {
    const next = !trayOpen
    setTrayOpen(next)
    resizeAndPin(next ? 'trayOpen' : getBarSize(cases, processes, false, overlayOpen))
  }

  function handleFocusCase(id) {
    setFocusedCaseId(id)
  }

  async function handlePauseCase(id) {
    const ok = await safeWrite(supabase.from('ct_cases')
      .update({ status: 'awaiting', awaiting_since: new Date().toISOString() })
      .eq('id', id))
    if (!ok) return

    stopCaseTimer(id)
    setCases(prev => prev.map(c => c.id === id ? { ...c, paused: true, awaiting: true } : c))
  }

  async function handleResumeCase(id) {
    await supabase.from('ct_cases')
      .update({ status: 'active', awaiting_since: null })
      .eq('id', id)
    setCases(prev => prev.map(c => c.id === id ? { ...c, paused: false, awaiting: false } : c))
    startCaseTimer(id)
  }

  async function handleCloseCase(id) {
    const c = cases.find(x => x.id === id)
    if (!c || !user) return
    stopCaseTimer(id)
    await supabase.from('ct_cases')
      .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed', resolution: null })
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
    resizeAndPin('overlay')
  }

  function handleLogProcess(id) {
    const p = processes.find(x => x.id === id)
    if (!p) return
    setPickerPending({ processId: id, elapsed: p.elapsed })
    setOverlayOpen(true)
    resizeAndPin('categoryScreen')
  }

  function handleCloseProcess(id) {
    stopProcessTimer(id)
    const nextProcesses = processes.filter(p => p.id !== id)
    setProcesses(nextProcesses)
    resizeAndPin(getBarSize(cases, nextProcesses, trayOpen, false))
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
    resizeAndPin('overlay')
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
    resizeAndPin('overlay')
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
    await safeWrite(supabase.from('ct_cases')
      .update({ ended_at: new Date().toISOString(), duration_s: elapsed, status: 'closed', resolution: 'resolved', is_rfc: true })
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
    await safeWrite(supabase.from('ct_cases')
      .update({ ended_at: new Date().toISOString(), duration_s: elapsed, status: 'closed', resolution: 'resolved', is_rfc: false })
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
    if (!user) return
    const ok = await safeWrite(supabase.from('case_events').insert({
      session_id: focusedCaseId || null,
      user_id: user.id,
      type: 'call',
      excluded: false,
      rfc: false,
    }))
    if (ok) refetch()
  }

  function handleNewProcess() {
    if (processes.length > 0) {
      const latest = processes[processes.length - 1]
      setPickerPending({ processId: latest.id, elapsed: latest.elapsed })
      setOverlayOpen(true)
      resizeAndPin('categoryScreen')
      return
    }

    setManualEntryOpen(true)
    setOverlayOpen(true)
    resizeAndPin('manualEntryForm')
  }

  function handleManualEntryClose() {
    setManualEntryOpen(false)
    setOverlayOpen(false)
    resizeAndPin(getBarSize(cases, processes, trayOpen, false))
  }

  async function handleManualLog(categoryId, subcategoryId, minutes) {
    if (!user) return
    await safeWrite(supabase.from('mpl_entries').insert({
      user_id: user.id,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      minutes,
      source: 'manual',
    }))
    setManualEntryOpen(false)
    setOverlayOpen(false)
    refetch()
    resizeAndPin(getBarSize(cases, processes, trayOpen, false))
  }

  async function handlePickerConfirm(categoryId, subcategoryId, durationSeconds) {
    if (!pickerPending || !user) return
    const { processId } = pickerPending
    stopProcessTimer(processId)
    const ok = await safeWrite(supabase.from('mpl_entries').insert({
      user_id: user.id,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      minutes: Math.round(durationSeconds / 60) || 1,
      source: 'pip',
    }))
    if (!ok) return
    const remaining = processes.filter(p => p.id !== processId)
    setProcesses(remaining)
    setPickerPending(null)
    setOverlayOpen(false)
    refetch()
    if (cases.length === 0 && remaining.length === 0) {
      setTrayOpen(false)
      resizeAndPin('idle')
    } else {
      resizeAndPin(getBarSize(cases, remaining, trayOpen, false))
    }
  }

  function handlePickerScreenChange(screen) {
    resizeAndPin(screen === 'subcategory' ? 'subcategoryScreen' : 'categoryScreen')
  }

  function handlePickerCancel() {
    setPickerPending(null)
    setOverlayOpen(false)
    resizeAndPin(getBarSize(cases, processes, trayOpen, false))
  }

  // ── Helper: resize/close tray when all sessions gone ─────────────────────
  function maybeShrinkToIdle(remainingCases, remainingProcesses) {
    if (remainingCases.length === 0 && remainingProcesses.length === 0) {
      setTrayOpen(false)
      resizeAndPin('idle')
    } else {
      resizeAndPin(getBarSize(remainingCases, remainingProcesses, trayOpen, false))
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
    await supabase.from('ct_cases')
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
    await supabase.from('ct_cases')
      .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed', resolution: 'abandoned' })
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
    await supabase.from('ct_cases')
      .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed', resolution: 'resolved', is_rfc: true })
      .eq('id', id)
    const remaining = cases.filter(x => x.id !== id)
    setCases(remaining)
    if (focusedCaseId === id) setFocusedCaseId(remaining[0]?.id || null)
    refetch()
    maybeShrinkToIdle(remaining, processes)
  }

  async function handleConfirmProcess(id, categoryId, subcategoryId, durationSeconds) {
    if (!user) return
    stopProcessTimer(id)
    const ok = await safeWrite(supabase.from('mpl_entries').insert({
      user_id: user.id,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      minutes: Math.round(durationSeconds / 60) || 1,
      source: 'pip',
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

  if (!profile?.onboarding_complete) {
    return <Onboarding user={user} onComplete={handleOnboardingComplete} />
  }

  return (
    <>
      <Dashboard user={user} profile={profile} onLaunchPip={handleLaunch} />
      <PendingTriggerBanner
        trigger={pendingTrigger}
        onLaunch={handlePendingTriggerLaunch}
        onDismiss={() => setPendingTrigger(null)}
      />
    </>
  )
}
