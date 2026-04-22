import { useState, useEffect, useRef } from 'react'
import * as ReactDOM from 'react-dom/client'
import { usePipWindow } from '../hooks/usePipWindow.js'
import { useStats } from '../hooks/useStats.js'
import { useContextFocus } from '../hooks/useContextFocus.js'
import { usePendingTriggers } from '../hooks/usePendingTriggers.js'
import { supabase } from '../lib/supabase.js'
import { logCaseEvent, fetchProfile } from '../lib/api.js'
import CtPipBar from './CtPipBar.jsx'
import { PipErrorBoundary } from '../components/PipErrorBoundary.jsx'
import Onboarding from '../components/Onboarding.jsx'
import Dashboard from '../components/Dashboard.jsx'
import PendingTriggerBanner from '../components/PendingTriggerBanner.jsx'
import AuthScreen from '../components/auth/AuthScreen.jsx'
import SwimlaneTray from '../components/SwimlaneTray.jsx'
import RFCPrompt from '../components/overlays/RFCPrompt.jsx'
import { getNewYorkDateKey, getNewYorkDayRange } from '../lib/timezone.js'
import { getCtSizeForState, getUserSettings } from '../lib/constants.js'

const PIP_STATE_STORAGE_PREFIX = 'meridian:ct-state'

function getCtBarMode(cases, trayOpen, rfcBannerOpen) {
  if (rfcBannerOpen) return 'rfcBanner'
  if (trayOpen) return 'trayOpen'
  if (cases.length > 0) return 'caseActive'
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
    reopenCount: row.reopen_count ?? 0,
  }
}

export default function CtApp() {
  const { pipWindow, isOpen, openPip, resizeAndPin, pipRootRef } = usePipWindow()

  // ── App state ─────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [cases, setCases] = useState([])
  const [focusedCaseId, setFocusedCaseId] = useState(null)
  const [trayOpen, setTrayOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [rfcBannerOpen, setRfcBannerOpen] = useState(false)
  const [rfcPending, setRfcPending] = useState(null) // { sessionId, caseNum, elapsed }
  const [lastTrigger, setLastTrigger] = useState('cases')
  const [barSessionId, setBarSessionId] = useState(null)
  const [pipToast, setPipToast] = useState(null)
  const [pendingTrigger, setPendingTrigger] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('connected')
  const [hasPendingActivity, setHasPendingActivity] = useState(false)
  const restoredStateKeyRef = useRef(null)
  const hasHydratedPipStateRef = useRef(false)
  const resolvingCaseIds = useRef(new Set())

  // ── Widget mode: detect ?mode=ct-widget for popup rendering ──────────────
  const isWidgetMode = new URLSearchParams(window.location.search).get('mode') === 'ct-widget'

  // ── Derived settings ──────────────────────────────────────────────────────
  const userSettings = getUserSettings(profile)
  const userSettingsRef = useRef(userSettings)
  userSettingsRef.current = userSettings

  // ── pin: resize PiP or popup window depending on mode ────────────────────
  const pin = (mode) => {
    const size = getCtSizeForState(mode, userSettingsRef.current.stat_buttons)
    if (isWidgetMode) {
      try { window.resizeTo(size.width, size.height) } catch (e) {}
    } else {
      resizeAndPin(size, userSettingsRef.current.pip_position)
    }
  }

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
      console.error('[Meridian CT] Supabase write failed', error)
      const msg = error.message || error.details || 'Unknown error'
      showPipToast('Save failed: ' + msg)
      return false
    }
    return true
  }

  // ── Profile refresh (called after settings save) ──────────────────────────
  async function refreshProfile() {
    if (!user) return
    const { data } = await supabase
      .from('platform_users')
      .select('*')
      .eq('id', user.id)
      .single()
    if (data) setProfile(data)
  }

  // ── Case timer ref map (keyed by session id) ──────────────────────────────
  const caseTimers = useRef({})

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

  function syncTimers(nextCases) {
    Object.values(caseTimers.current).forEach(clearInterval)
    caseTimers.current = {}
    nextCases.forEach(c => {
      if (!c.paused && !c.awaiting) startCaseTimer(c.id)
    })
  }

  function mountPipWindow(pw) {
    const existing = pw.document.getElementById('meridian-pip-root')
    if (existing) existing.remove()
    const container = pw.document.createElement('div')
    container.id = 'meridian-pip-root'
    container.style.cssText = 'width:100%;height:100%'
    pw.document.body.appendChild(container)
    pipRootRef.current = ReactDOM.createRoot(container)
    pipRootRef.current.render(<PipErrorBoundary>{buildPipBar()}</PipErrorBoundary>)
  }

  // ── bar_sessions tracking ─────────────────────────────────────────────────
  const closeBarRef = useRef(null)
  closeBarRef.current = { barSessionId, cases }

  const prevIsOpenRef = useRef(false)
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current
    prevIsOpenRef.current = isOpen
    if (wasOpen && !isOpen) {
      if (closeBarRef.current.barSessionId) {
        const { barSessionId: bsId, cases: c } = closeBarRef.current
        supabase.from('bar_sessions')
          .update({
            ended_at: new Date().toISOString(),
            total_cases: c.length,
            total_processes: 0,
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

  // ── Widget mode: auto-initialize on mount ─────────────────────────────────
  const widgetInitRef = useRef(false)
  useEffect(() => {
    if (!isWidgetMode) return
    if (authLoading || !user || !profile?.onboarding_complete) return
    if (widgetInitRef.current) return
    widgetInitRef.current = true

    createBarSession(user.id)
    document.body.classList.add('widget-mode')

    const size = getCtSizeForState('idle', userSettingsRef.current.stat_buttons)
    try { window.resizeTo(size.width, size.height) } catch (e) {}
  }, [isWidgetMode, authLoading, user, profile])

  // ── Connection status health-check ────────────────────────────────────────
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

  // ── Context focus (derived) — CT only uses cases ──────────────────────────
  const { laneSplit } = useContextFocus(cases, [], lastTrigger)

  // ── Minimized strip derived values ─────────────────────────────────────────
  const focusedCase = cases.find(c => c.id === focusedCaseId) || cases[0] || null
  const activeStripSession = focusedCase ? { type: 'case', session: focusedCase } : null

  // ── Stats ─────────────────────────────────────────────────────────────────
  const { resolved, reclass, calls, processes: processCount, refetch } = useStats()
  const stats = { resolved, reclass, calls, processes: processCount }

  const todayScorecard = { resolved, calls, processEntries: processCount }

  // ── Auto-open tray on 3rd case ────────────────────────────────────────────
  useEffect(() => {
    if (cases.length > 2) setTrayOpen(true)
  }, [cases.length])

  // ── Persist active cases to localStorage ──────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    const dateKey = getNewYorkDateKey()
    const storageKey = getPipStateStorageKey(user.id, dateKey)
    if (!hasHydratedPipStateRef.current || restoredStateKeyRef.current !== storageKey) return

    if (cases.length === 0) {
      localStorage.removeItem(storageKey)
      return
    }

    localStorage.setItem(storageKey, JSON.stringify({
      dateKey,
      cases,
      focusedCaseId,
      trayOpen,
      lastTrigger,
      savedAt: new Date().toISOString(),
    }))
  }, [user?.id, cases, focusedCaseId, trayOpen, lastTrigger])

  // ── Restore active cases from localStorage or Supabase ───────────────────
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
          const nextFocusedCaseId = restoredCases.some(c => c.id === parsed.focusedCaseId)
            ? parsed.focusedCaseId
            : restoredCases[0]?.id || null

          setCases(restoredCases)
          setFocusedCaseId(nextFocusedCaseId)
          setTrayOpen(Boolean(parsed.trayOpen) || restoredCases.length > 2)
          setLastTrigger(parsed.lastTrigger || 'cases')
          syncTimers(restoredCases)
          hasHydratedPipStateRef.current = true
          return
        } catch (error) {
          console.warn('[Meridian CT] Failed to restore state snapshot', error)
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
        console.error('[Meridian CT] Failed to restore active cases', error)
        return
      }

      const activeIds = (data || []).map(r => r.id)
      const caseNumbers = [...new Set((data || []).map(r => r.case_number))]
      let priorSet = new Set()
      if (caseNumbers.length) {
        const { data: priorData } = await supabase
          .from('ct_cases')
          .select('id, case_number')
          .in('case_number', caseNumbers)
          .eq('resolution', 'resolved')
        priorSet = new Set(
          (priorData || []).filter(r => !activeIds.includes(r.id)).map(r => r.case_number)
        )
      }
      const restoredCases = (data || []).map(row => ({
        ...restoreCaseFromRow(row),
        previouslyResolved: priorSet.has(row.case_number),
      }))
      setCases(restoredCases)
      setFocusedCaseId(restoredCases[0]?.id || null)
      setTrayOpen(restoredCases.length > 2)
      setLastTrigger('cases')
      syncTimers(restoredCases)
      hasHydratedPipStateRef.current = true
    }

    restoreActiveState()
  }, [user?.id])

  // ── Ensure PiP window is open ─────────────────────────────────────────────
  async function ensurePipOpen(targetMode = 'idle') {
    if (!isOpen) {
      const result = await openPip({ ...getCtSizeForState(targetMode, userSettingsRef.current.stat_buttons), position: userSettingsRef.current.pip_position })
      if (!result.ok) return false
      mountPipWindow(result.window)
      if (user) createBarSession(user.id)
    }
    return true
  }

  // ── Bookmarklet handlers ──────────────────────────────────────────────────

  async function handleCaseStart({ caseNumber, accountId, caseType, caseSubtype }) {
    if (!user) return

    const willOpenTray = cases.length + 1 > 2
    const targetMode = willOpenTray ? 'trayOpen' : 'caseActive'

    if (!pipRootRef.current) {
      const opened = await ensurePipOpen(targetMode)
      if (!opened || !pipRootRef.current) {
        setPendingTrigger({ type: 'case', data: { caseNumber, accountId, caseType, caseSubtype } })
        return
      }
    }
    if (isMinimized) {
      setHasPendingActivity(true)
    } else {
      if (willOpenTray) setTrayOpen(true)
      pin(targetMode)
    }

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
      console.error('[Meridian CT] Failed to create case session', error)
      return
    }

    const sessionId = data.id
    const { data: priorData } = await supabase
      .from('ct_cases')
      .select('id')
      .eq('case_number', caseNumber)
      .eq('resolution', 'resolved')
      .neq('id', sessionId)
    const reopenCount = priorData?.length ?? 0
    const previouslyResolved = reopenCount > 0

    // Stamp the just-created row with its reopen_count.
    // Fire-and-forget — if this fails, the case still works;
    // the audit will catch any drift and we can re-stamp later.
    if (reopenCount > 0) {
      void supabase
        .from('ct_cases')
        .update({ reopen_count: reopenCount })
        .eq('id', sessionId)
        .then(({ error }) => {
          if (error) console.warn('[Meridian CT] Failed to stamp reopen_count', error)
        })
    }

    const newCase = { id: sessionId, caseNum: caseNumber, elapsed: 0, paused: false, awaiting: false, previouslyResolved, reopenCount }

    setCases(prev => [...prev, newCase])
    setFocusedCaseId(sessionId)
    setLastTrigger('cases')
    startCaseTimer(sessionId)
  }

  usePendingTriggers(user?.id, { handleCaseStart, handleProcessStart: () => {} })

  // ── Re-render CtPipBar into PiP window on every state change ─────────────
  useEffect(() => {
    if (isWidgetMode) return
    if (!pipRootRef.current) return
    pipRootRef.current.render(<PipErrorBoundary>{buildPipBar()}</PipErrorBoundary>)
  })

  // ── Build CtPipBar element with current state + handlers ──────────────────
  function buildPipBar() {
    return (
      <CtPipBar
        userSettings={userSettings}
        cases={cases}
        processes={[]}
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
        onResolve={handleResolve}
        onReclass={handleReclass}
        onCall={handleCall}
        connectionStatus={connectionStatus}
        todayScorecard={todayScorecard}
        activeStripSession={activeStripSession}
        onStripSwap={() => {}}
        hasPendingActivity={hasPendingActivity}
        onSnapToCorner={() => pin(isMinimized ? 'minimized' : getCtBarMode(cases, trayOpen, rfcBannerOpen))}
        onStartCase={(caseNumber) => handleCaseStart({ caseNumber })}
        onAwaitingCase={handleAwaitingCase}
        onNotACase={handleNotACase}
      >
        {rfcPending ? (
          <RFCPrompt
            caseNumber={rfcPending.caseNum}
            onYes={handleRFCYes}
            onNo={handleRFCNo}
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
            onRFCRequired={handleRFCRequired}
            processes={[]}
            categories={[]}
            onConfirmProcess={() => {}}
            onCancelProcess={() => {}}
            onNewProcess={() => {}}
          />
        ) : null}
      </CtPipBar>
    )
  }

  // ── Launch PiP window ─────────────────────────────────────────────────────
  async function handleLaunch() {
    if (!user || !profile?.onboarding_complete) return
    const initialSize = getCtSizeForState('idle', userSettingsRef.current.stat_buttons)
    const result = await openPip({ ...initialSize, position: userSettingsRef.current.pip_position })
    if (!result.ok) return
    mountPipWindow(result.window)
    if (user) createBarSession(user.id)
  }

  async function handlePendingTriggerLaunch() {
    const trigger = pendingTrigger
    setPendingTrigger(null)
    if (!trigger) return

    let targetMode
    if (trigger.type === 'case') {
      const willOpenTray = cases.length + 1 > 2
      targetMode = willOpenTray ? 'trayOpen' : 'caseActive'
    } else {
      targetMode = 'idle'
    }
    const { width, height } = getCtSizeForState(targetMode, userSettingsRef.current.stat_buttons)

    const result = await openPip({ width, height, position: userSettingsRef.current.pip_position })
    if (!result.ok) return

    mountPipWindow(result.window)
    if (user) createBarSession(user.id)

    if (trigger.type === 'case') {
      handleCaseStart(trigger.data)
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleOpenDashboard() {
    if (isWidgetMode) {
      window.open(window.location.origin, 'meridian-dashboard')
    } else {
      window.focus()
    }
  }

  function handleMinimize() {
    setIsMinimized(true)
    if (isWidgetMode) {
      try { window.resizeTo(550, 36) } catch (e) {}
    } else {
      pin('minimized')
    }
  }

  function handleRestore() {
    setIsMinimized(false)
    setHasPendingActivity(false)
    const mode = getCtBarMode(cases, trayOpen, rfcBannerOpen)
    if (isWidgetMode) {
      const size = getCtSizeForState(mode, userSettingsRef.current.stat_buttons)
      try { window.resizeTo(size.width, size.height) } catch (e) {}
    } else {
      pin(mode)
    }
  }

  function handleToggleTray() {
    const next = !trayOpen
    setTrayOpen(next)
    pin(next ? 'trayOpen' : getCtBarMode(cases, false, rfcBannerOpen))
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
    const remaining = cases.filter(x => x.id !== id)
    if (remaining.length === 0) {
      setTrayOpen(false)
      pin('idle')
    } else {
      pin(getCtBarMode(remaining, trayOpen, false))
    }
    await supabase.from('ct_cases')
      .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed', resolution: null })
      .eq('id', id)
    setCases(remaining)
    if (focusedCaseId === id) setFocusedCaseId(remaining[0]?.id || null)
    refetch()
  }

  async function handleBarPillClose(id) {
    if (resolvingCaseIds.current.has(id)) return
    const c = cases.find(x => x.id === id)
    if (!c) return
    resolvingCaseIds.current.add(id)
    try {
      stopCaseTimer(id)
      const remaining = cases.filter(x => x.id !== id)
      if (remaining.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getCtBarMode(remaining, trayOpen, false))
      }
      await safeWrite(supabase.from('ct_cases')
        .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed', resolution: null })
        .eq('id', id))
      setCases(remaining)
      if (focusedCaseId === id) setFocusedCaseId(remaining[0]?.id || null)
      refetch()
    } finally {
      resolvingCaseIds.current.delete(id)
    }
  }

  async function handleResolve() {
    if (!focusedCaseId || !user) return
    if (resolvingCaseIds.current.has(focusedCaseId)) return
    const c = cases.find(x => x.id === focusedCaseId)
    if (!c) return
    resolvingCaseIds.current.add(focusedCaseId)
    try {
      if (c.previouslyResolved) {
        setRfcPending({ sessionId: focusedCaseId, caseNum: c.caseNum, elapsed: c.elapsed })
        setRfcBannerOpen(true)
        pin('rfcBanner')
      } else {
        const remaining = cases.filter(x => x.id !== focusedCaseId)
        if (remaining.length === 0) {
          setTrayOpen(false)
          pin('idle')
        } else {
          pin(getCtBarMode(remaining, trayOpen, false))
        }
      }
      const ok = await safeWrite(logCaseEvent({ userId: user.id, type: 'resolved', sessionId: focusedCaseId, excluded: false, rfc: false }))
      if (!ok) {
        setRfcPending(null)
        setRfcBannerOpen(false)
        return
      }
      if (!c.previouslyResolved) {
        stopCaseTimer(focusedCaseId)
        await safeWrite(supabase.from('ct_cases')
          .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed', resolution: 'resolved', is_rfc: false })
          .eq('id', focusedCaseId))
        const remaining = cases.filter(x => x.id !== focusedCaseId)
        setCases(remaining)
        setFocusedCaseId(remaining[0]?.id || null)
        refetch()
      }
    } finally {
      resolvingCaseIds.current.delete(focusedCaseId)
    }
  }

  async function handleReclass() {
    if (!focusedCaseId || !user) return
    if (resolvingCaseIds.current.has(focusedCaseId)) return
    const c = cases.find(x => x.id === focusedCaseId)
    if (!c) return
    resolvingCaseIds.current.add(focusedCaseId)
    try {
      const remaining = cases.filter(x => x.id !== focusedCaseId)
      if (remaining.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getCtBarMode(remaining, trayOpen, false))
      }
      const ok = await safeWrite(logCaseEvent({ userId: user.id, type: 'reclassified', sessionId: focusedCaseId, excluded: false, rfc: false }))
      if (!ok) return
      stopCaseTimer(focusedCaseId)
      await safeWrite(supabase.from('ct_cases')
        .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed', resolution: 'reclassified', is_rfc: false })
        .eq('id', focusedCaseId))
      setCases(remaining)
      setFocusedCaseId(remaining[0]?.id || null)
      refetch()
    } finally {
      resolvingCaseIds.current.delete(focusedCaseId)
    }
  }

  async function handleRFCYes() {
    if (!rfcPending || !user) return
    const { sessionId, elapsed } = rfcPending
    if (resolvingCaseIds.current.has(sessionId)) return
    resolvingCaseIds.current.add(sessionId)
    try {
      stopCaseTimer(sessionId)
      const remaining = cases.filter(x => x.id !== sessionId)
      if (remaining.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getCtBarMode(remaining, trayOpen, false))
      }
      const ok1 = await safeWrite(logCaseEvent({ userId: user.id, type: 'rfc', sessionId, excluded: false, rfc: true }))
      if (!ok1) return
      await safeWrite(supabase.from('ct_cases')
        .update({ ended_at: new Date().toISOString(), duration_s: elapsed, status: 'closed', resolution: 'resolved', is_rfc: true })
        .eq('id', sessionId))
      setCases(remaining)
      if (focusedCaseId === sessionId) setFocusedCaseId(remaining[0]?.id || null)
      setRfcPending(null)
      setRfcBannerOpen(false)
      refetch()
    } finally {
      resolvingCaseIds.current.delete(sessionId)
    }
  }

  async function handleRFCNo() {
    if (!rfcPending || !user) return
    const { sessionId, elapsed } = rfcPending
    if (resolvingCaseIds.current.has(sessionId)) return
    resolvingCaseIds.current.add(sessionId)
    try {
      stopCaseTimer(sessionId)
      const remaining = cases.filter(x => x.id !== sessionId)
      if (remaining.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getCtBarMode(remaining, trayOpen, false))
      }
      await safeWrite(supabase.from('ct_cases')
        .update({ ended_at: new Date().toISOString(), duration_s: elapsed, status: 'closed', resolution: 'resolved', is_rfc: false })
        .eq('id', sessionId))
      setCases(remaining)
      if (focusedCaseId === sessionId) setFocusedCaseId(remaining[0]?.id || null)
      setRfcPending(null)
      setRfcBannerOpen(false)
      refetch()
    } finally {
      resolvingCaseIds.current.delete(sessionId)
    }
  }

  async function handleCall() {
    if (!user) return
    const ok = await safeWrite(logCaseEvent({ userId: user.id, type: 'call', sessionId: focusedCaseId || null, excluded: false, rfc: false }))
    if (ok) refetch()
  }

  // ── Tray-specific handlers ─────────────────────────────────────────────────

  function handleRFCRequired(id) {
    const c = cases.find(x => x.id === id)
    if (!c) return
    setRfcPending({ sessionId: id, caseNum: c.caseNum, elapsed: c.elapsed })
    setRfcBannerOpen(true)
    pin('rfcBanner')
  }

  async function handleResolveCase(id) {
    if (!user) return
    if (resolvingCaseIds.current.has(id)) return
    const c = cases.find(x => x.id === id)
    if (!c) return
    resolvingCaseIds.current.add(id)
    try {
      if (!c.previouslyResolved) {
        const remaining = cases.filter(x => x.id !== id)
        if (remaining.length === 0) {
          setTrayOpen(false)
          pin('idle')
        } else {
          pin(getCtBarMode(remaining, trayOpen, false))
        }
      }
      await logCaseEvent({ userId: user.id, type: 'resolved', sessionId: id, excluded: false, rfc: false })
      if (!c.previouslyResolved) {
        stopCaseTimer(id)
        await supabase.from('ct_cases')
          .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed', resolution: 'resolved', is_rfc: false })
          .eq('id', id)
        const remaining = cases.filter(x => x.id !== id)
        setCases(remaining)
        if (focusedCaseId === id) setFocusedCaseId(remaining[0]?.id || null)
      }
      refetch()
    } finally {
      resolvingCaseIds.current.delete(id)
    }
  }

  async function handleReclassCase(id) {
    if (!user) return
    if (resolvingCaseIds.current.has(id)) return
    const c = cases.find(x => x.id === id)
    if (!c) return
    resolvingCaseIds.current.add(id)
    try {
      stopCaseTimer(id)
      const remaining = cases.filter(x => x.id !== id)
      if (remaining.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getCtBarMode(remaining, trayOpen, false))
      }
      await logCaseEvent({ userId: user.id, type: 'reclassified', sessionId: id, excluded: false, rfc: false })
      await supabase.from('ct_cases')
        .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed', resolution: 'reclassified', is_rfc: false })
        .eq('id', id)
      setCases(remaining)
      if (focusedCaseId === id) setFocusedCaseId(remaining[0]?.id || null)
      refetch()
    } finally {
      resolvingCaseIds.current.delete(id)
    }
  }

  async function handleCallCase(id) {
    if (!user) return
    await logCaseEvent({ userId: user.id, type: 'call', sessionId: id, excluded: false, rfc: false })
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
    if (resolvingCaseIds.current.has(id)) return
    const c = cases.find(x => x.id === id)
    if (!c) return
    resolvingCaseIds.current.add(id)
    try {
      stopCaseTimer(id)
      const remaining = cases.filter(x => x.id !== id)
      if (remaining.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getCtBarMode(remaining, trayOpen, false))
      }
      await logCaseEvent({ userId: user.id, type: 'not_a_case', sessionId: id, excluded: true, rfc: false })
      await supabase.from('ct_cases')
        .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed', resolution: 'abandoned' })
        .eq('id', id)
      setCases(remaining)
      if (focusedCaseId === id) setFocusedCaseId(remaining[0]?.id || null)
      refetch()
    } finally {
      resolvingCaseIds.current.delete(id)
    }
  }

  async function handleRFC(id) {
    if (!user) return
    if (resolvingCaseIds.current.has(id)) return
    const c = cases.find(x => x.id === id)
    if (!c) return
    resolvingCaseIds.current.add(id)
    try {
      stopCaseTimer(id)
      const remaining = cases.filter(x => x.id !== id)
      if (remaining.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getCtBarMode(remaining, trayOpen, false))
      }
      await logCaseEvent({ userId: user.id, type: 'rfc', sessionId: id, excluded: false, rfc: true })
      await supabase.from('ct_cases')
        .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed', resolution: 'resolved', is_rfc: true })
        .eq('id', id)
      setCases(remaining)
      if (focusedCaseId === id) setFocusedCaseId(remaining[0]?.id || null)
      refetch()
    } finally {
      resolvingCaseIds.current.delete(id)
    }
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

  // ── Widget mode: render CtPipBar directly ─────────────────────────────────
  if (isWidgetMode) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        background: '#0f1117',
        overflow: 'hidden',
      }}>
        <PipErrorBoundary>
          {buildPipBar()}
        </PipErrorBoundary>
      </div>
    )
  }

  // ── Dashboard fallback (non-widget mode) ──────────────────────────────────
  return (
    <>
      <Dashboard user={user} profile={profile} onLaunchPip={handleLaunch} onRefreshProfile={refreshProfile} />
      <PendingTriggerBanner
        trigger={pendingTrigger}
        onLaunch={handlePendingTriggerLaunch}
        onDismiss={() => setPendingTrigger(null)}
      />
    </>
  )
}
