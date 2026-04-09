import { useState, useEffect, useRef } from 'react'
import * as ReactDOM from 'react-dom/client'
import { usePipWindow } from './hooks/usePipWindow.js'
import { useStats } from './hooks/useStats.js'
import { useContextFocus } from './hooks/useContextFocus.js'
import { usePendingTriggers } from './hooks/usePendingTriggers.js'
import { supabase } from './lib/supabase.js'
import PipBar from './PipBar.jsx'
import { PipErrorBoundary } from './components/PipErrorBoundary.jsx'
import Onboarding from './components/Onboarding.jsx'
import Dashboard from './components/Dashboard.jsx'
import PendingTriggerBanner from './components/PendingTriggerBanner.jsx'
import AuthScreen from './components/auth/AuthScreen.jsx'
import SwimlaneTray from './components/SwimlaneTray.jsx'
import RFCPrompt from './components/overlays/RFCPrompt.jsx'
import ProcessPicker from './components/overlays/ProcessPicker.jsx'
import ManualEntryForm from './components/ManualEntryForm.jsx'
import { getNewYorkDateKey, getNewYorkDayRange } from './lib/timezone.js'
import { getSizeForState, getUserSettings } from './lib/constants.js'

const PIP_STATE_STORAGE_PREFIX = 'meridian:pip-state'

function getBarMode(cases, processes, trayOpen, overlayOpen, rfcBannerOpen) {
  if (rfcBannerOpen) return 'rfcBanner'
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
  const [rfcBannerOpen, setRfcBannerOpen] = useState(false)
  const [rfcPending, setRfcPending] = useState(null) // { sessionId, caseNum, elapsed }
  const [pickerPending, setPickerPending] = useState(null) // { processId, elapsed }
  const [lastTrigger, setLastTrigger] = useState('cases')
  const [categories, setCategories] = useState([])
  const [barSessionId, setBarSessionId] = useState(null)
  const [pipToast, setPipToast] = useState(null)
  const [pendingTrigger, setPendingTrigger] = useState(null) // queued trigger when PiP not open
  const [manualEntryOpen, setManualEntryOpen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connected') // 'connected' | 'degraded' | 'offline'
  const [minimizedStripView, setMinimizedStripView] = useState('auto') // 'auto' | 'case' | 'process'
  const [pendingProcessLog, setPendingProcessLog] = useState(null) // processId | null
  const [hasPendingActivity, setHasPendingActivity] = useState(false)
  const restoredStateKeyRef = useRef(null)
  const hasHydratedPipStateRef = useRef(false)
  const resolvingCaseIds = useRef(new Set())

  // ── Widget mode: detect ?mode=widget for popup rendering ─────────────────
  const isWidgetMode = new URLSearchParams(window.location.search).get('mode') === 'widget'

  // ── Derived settings ──────────────────────────────────────────────────────
  const userSettings = getUserSettings(profile)
  const userSettingsRef = useRef(userSettings)
  userSettingsRef.current = userSettings

  // ── pin: resize PiP or popup window depending on mode ────────────────────
  const pin = (mode) => {
    const size = getSizeForState(mode, userSettingsRef.current.stat_buttons)
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
      console.error('[Meridian] Supabase write failed', error)
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
    container.style.cssText = 'width:100%;height:100%'
    pw.document.body.appendChild(container)
    pipRootRef.current = ReactDOM.createRoot(container)
    pipRootRef.current.render(<PipErrorBoundary>{buildPipBar()}</PipErrorBoundary>)
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

  // ── Autolaunch: open PiP when ?autolaunch=true is in URL ─────────────────
  const autolaunchFiredRef = useRef(false)
  useEffect(() => {
    if (authLoading || !user || !profile?.onboarding_complete) return
    if (autolaunchFiredRef.current) return

    const params = new URLSearchParams(window.location.search)
    if (params.get('autolaunch') !== 'true') return

    autolaunchFiredRef.current = true

    // Strip the param so refresh doesn't re-trigger
    params.delete('autolaunch')
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname
    window.history.replaceState({}, '', newUrl)

    // Small delay to ensure DOM is ready for PiP
    setTimeout(() => {
      if (!pipRootRef.current) {
        handleLaunch()
      }
    }, 300)
  }, [authLoading, user, profile])

  // ── Widget mode: auto-initialize on mount ─────────────────────────────────
  const widgetInitRef = useRef(false)
  useEffect(() => {
    if (!isWidgetMode) return
    if (authLoading || !user || !profile?.onboarding_complete) return
    if (widgetInitRef.current) return
    widgetInitRef.current = true

    createBarSession(user.id)
    document.body.classList.add('widget-mode')

    const size = getSizeForState('idle', userSettingsRef.current.stat_buttons)
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

  // ── Context focus (derived) ────────────────────────────────────────────────
  const { laneSplit } = useContextFocus(cases, processes, lastTrigger)

  // ── Minimized strip derived values ─────────────────────────────────────────
  const focusedCase = cases.find(c => c.id === focusedCaseId) || cases[0] || null
  const activeProcess = processes[0] || null

  // Determines which session the minimized strip shows
  const activeStripSession = (() => {
    if (minimizedStripView === 'case') return focusedCase ? { type: 'case', session: focusedCase } : null
    if (minimizedStripView === 'process') return activeProcess ? { type: 'process', session: activeProcess } : null
    // 'auto': use lastTrigger to pick the most recently started session
    if (focusedCase && !activeProcess) return { type: 'case', session: focusedCase }
    if (activeProcess && !focusedCase) return { type: 'process', session: activeProcess }
    if (focusedCase && activeProcess) {
      return lastTrigger === 'processes'
        ? { type: 'process', session: activeProcess }
        : { type: 'case', session: focusedCase }
    }
    return null
  })()

  function handleStripSwap() {
    if (!focusedCase || !activeProcess) return
    setMinimizedStripView(prev => {
      if (prev === 'case') return 'process'
      if (prev === 'process') return 'case'
      // 'auto': flip from the current auto-derived view
      return lastTrigger === 'processes' ? 'case' : 'process'
    })
  }

  // Reset strip view when either session type is fully gone
  useEffect(() => {
    if (cases.length === 0 || processes.length === 0) {
      setMinimizedStripView('auto')
    }
  }, [cases.length, processes.length])

  // Open process picker when restored after tapping log from minimized strip
  useEffect(() => {
    if (pendingProcessLog && !isMinimized) {
      handleLogProcess(pendingProcessLog)
      setPendingProcessLog(null)
    }
  }, [pendingProcessLog, isMinimized])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const { resolved, reclass, calls, processes: processCount, refetch } = useStats()
  const stats = { resolved, reclass, calls, processes: processCount }

  // ── Today's scorecard (for minimized strip) ───────────────────────────────
  const todayScorecard = {
    resolved,
    calls,
    processEntries: processCount,
  }

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
  async function ensurePipOpen(targetMode = 'idle') {
    if (!isOpen) {
      const pw = await openPip({ ...getSizeForState(targetMode, userSettingsRef.current.stat_buttons), position: userSettingsRef.current.pip_position })
      if (!pw) return false
      mountPipWindow(pw)
      if (user) createBarSession(user.id)
    }
    return true
  }

  // ── Bookmarklet handlers ──────────────────────────────────────────────────

  async function handleCaseStart({ caseNumber, accountId, caseType, caseSubtype }) {
    if (!user) return

    // Compute target mode for initial open
    const willOpenTray = cases.length + 1 > 2
    const targetMode = willOpenTray ? 'trayOpen' : (processes.length > 0 ? 'bothActive' : 'caseActive')

    if (!pipRootRef.current) {
      const opened = await ensurePipOpen(targetMode)
      if (!opened || !pipRootRef.current) {
        // PiP open blocked — queue the trigger so the banner can handle it
        setPendingTrigger({ type: 'case', data: { caseNumber, accountId, caseType, caseSubtype } })
        return
      }
    }
    if (isMinimized) {
      setHasPendingActivity(true)
    } else {
      // pin() here is for when PiP was already open — Realtime callbacks
      // won't have user activation so resizeTo may silently fail, but the
      // next user interaction will correct the size.
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
      console.error('[Meridian] Failed to create case session', error)
      return
    }

    const sessionId = data.id
    const { data: priorData } = await supabase
      .from('ct_cases')
      .select('id')
      .eq('case_number', caseNumber)
      .eq('resolution', 'resolved')
      .neq('id', sessionId)
      .limit(1)
    const previouslyResolved = (priorData?.length ?? 0) > 0
    const newCase = { id: sessionId, caseNum: caseNumber, elapsed: 0, paused: false, awaiting: false, previouslyResolved }

    const nextCases = [...cases, newCase]
    setCases(nextCases)
    setFocusedCaseId(sessionId)
    setLastTrigger('cases')
    startCaseTimer(sessionId)
  }

  async function handleProcessStart() {
    if (!user || !profile?.onboarding_complete) return

    const willOpenTray = processes.length + 1 > 2
    const targetMode = willOpenTray ? 'trayOpen' : (cases.length > 0 ? 'bothActive' : 'processActive')

    if (!pipRootRef.current) {
      const opened = await ensurePipOpen(targetMode)
      if (!opened || !pipRootRef.current) {
        // PiP open blocked — queue the trigger
        setPendingTrigger({ type: 'process', data: {} })
        return
      }
    }
    if (isMinimized) {
      setHasPendingActivity(true)
    } else {
      if (willOpenTray) setTrayOpen(true)
      pin(targetMode)
    }

    const id = crypto.randomUUID()
    const newProcess = { id, elapsed: 0, paused: false }
    const nextProcesses = [...processes, newProcess]
    setProcesses(nextProcesses)
    setLastTrigger('processes')
    startProcessTimer(id)
  }

  usePendingTriggers(user?.id, { handleCaseStart, handleProcessStart })

  // ── Re-render PipBar into PiP window on every state change ────────────────
  useEffect(() => {
    if (isWidgetMode) return // Widget mode renders via JSX return, not pipRoot
    if (!pipRootRef.current) return
    pipRootRef.current.render(<PipErrorBoundary>{buildPipBar()}</PipErrorBoundary>)
  })

  // ── Build PipBar element with current state + handlers ────────────────────
  function buildPipBar() {
    return (
      <PipBar
        userSettings={userSettings}
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
        connectionStatus={connectionStatus}
        todayScorecard={todayScorecard}
        activeStripSession={activeStripSession}
        onStripSwap={handleStripSwap}
        hasPendingActivity={hasPendingActivity}
        onProcessPause={handleProcessPause}
        onProcessResume={handleProcessResume}
        onProcessLog={handleProcessLogFromStrip}
        onProcessDiscard={handleCloseProcess}
        onSnapToCorner={() => pin(isMinimized ? 'minimized' : getBarMode(cases, processes, trayOpen, overlayOpen, rfcBannerOpen))}
        onStartCase={(caseNumber) => handleCaseStart({ caseNumber })}
        onStartProcess={() => handleProcessStart()}
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
            onRFCRequired={handleRFCRequired}
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
    const initialSize = getSizeForState('idle', userSettingsRef.current.stat_buttons)
    const pw = await openPip({ ...initialSize, position: userSettingsRef.current.pip_position })
    if (!pw) return

    mountPipWindow(pw)
    if (user) createBarSession(user.id)
  }

  async function handlePendingTriggerLaunch() {
    const trigger = pendingTrigger
    setPendingTrigger(null)
    if (!trigger) return

    // Compute the correct initial window size from the trigger type so
    // requestWindow opens at the right dimensions. User activation is lost
    // after the await, so we can't rely on resizeAndPin — pass the size here.
    let targetMode
    if (trigger.type === 'case') {
      const willOpenTray = cases.length + 1 > 2
      targetMode = willOpenTray ? 'trayOpen' : (processes.length > 0 ? 'bothActive' : 'caseActive')
    } else {
      const willOpenTray = processes.length + 1 > 2
      targetMode = willOpenTray ? 'trayOpen' : (cases.length > 0 ? 'bothActive' : 'processActive')
    }
    const { width, height } = getSizeForState(targetMode, userSettingsRef.current.stat_buttons)

    const pw = await openPip({ width, height, position: userSettingsRef.current.pip_position })
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
    const mode = getBarMode(cases, processes, trayOpen, overlayOpen, rfcBannerOpen)
    if (isWidgetMode) {
      const size = getSizeForState(mode, userSettingsRef.current.stat_buttons)
      try { window.resizeTo(size.width, size.height) } catch (e) {}
    } else {
      pin(mode)
    }
  }

  function handleToggleTray() {
    const next = !trayOpen
    setTrayOpen(next)
    pin(next ? 'trayOpen' : getBarMode(cases, processes, false, overlayOpen, rfcBannerOpen))
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
    // Pre-compute target size before await (user activation intact)
    const remaining = cases.filter(x => x.id !== id)
    if (remaining.length === 0 && processes.length === 0) {
      setTrayOpen(false)
      pin('idle')
    } else {
      pin(getBarMode(remaining, processes, trayOpen, false))
    }
    await supabase.from('ct_cases')
      .update({ ended_at: new Date().toISOString(), duration_s: c.elapsed, status: 'closed', resolution: null })
      .eq('id', id)
    setCases(remaining)
    if (focusedCaseId === id) setFocusedCaseId(remaining[0]?.id || null)
    refetch()
  }

  // Bar pill × — dismiss case session without resolution
  async function handleBarPillClose(id) {
    if (resolvingCaseIds.current.has(id)) return
    const c = cases.find(x => x.id === id)
    if (!c) return
    resolvingCaseIds.current.add(id)
    try {
      stopCaseTimer(id)
      const remaining = cases.filter(x => x.id !== id)
      if (remaining.length === 0 && processes.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getBarMode(remaining, processes, trayOpen, false, false))
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

  function handleLogProcess(id) {
    const p = processes.find(x => x.id === id)
    if (!p) return
    setPickerPending({ processId: id, elapsed: p.elapsed })
    setOverlayOpen(true)
    pin('categoryScreen')
  }

  function handleProcessLogFromStrip(processId) {
    setPendingProcessLog(processId)
    handleRestore()
  }

  function handleCloseProcess(id) {
    stopProcessTimer(id)
    const nextProcesses = processes.filter(p => p.id !== id)
    setProcesses(nextProcesses)
    pin(getBarMode(cases, nextProcesses, trayOpen, false))
  }

  async function handleResolve() {
    if (!focusedCaseId || !user) return
    if (resolvingCaseIds.current.has(focusedCaseId)) return
    const c = cases.find(x => x.id === focusedCaseId)
    if (!c) return
    resolvingCaseIds.current.add(focusedCaseId)
    try {
      // Pre-compute target size before first await (user activation intact)
      if (c.previouslyResolved) {
        setRfcPending({ sessionId: focusedCaseId, caseNum: c.caseNum, elapsed: c.elapsed })
        setRfcBannerOpen(true)
        pin('rfcBanner')
      } else {
        const remaining = cases.filter(x => x.id !== focusedCaseId)
        if (remaining.length === 0 && processes.length === 0) {
          setTrayOpen(false)
          pin('idle')
        } else {
          pin(getBarMode(remaining, processes, trayOpen, false, false))
        }
      }
      const ok = await safeWrite(supabase.from('case_events').insert({
        session_id: focusedCaseId,
        user_id: user.id,
        type: 'resolved',
        excluded: false,
        rfc: false,
      }))
      if (!ok) {
        // Roll back optimistic state if write failed
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
      // Pre-compute target size before first await (user activation intact)
      const remaining = cases.filter(x => x.id !== focusedCaseId)
      if (remaining.length === 0 && processes.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getBarMode(remaining, processes, trayOpen, false))
      }
      const ok = await safeWrite(supabase.from('case_events').insert({
        session_id: focusedCaseId,
        user_id: user.id,
        type: 'reclassified',
        excluded: false,
        rfc: false,
      }))
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
      // Pre-compute target size before first await (user activation intact)
      const remaining = cases.filter(x => x.id !== sessionId)
      if (remaining.length === 0 && processes.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getBarMode(remaining, processes, trayOpen, false, false))
      }
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
      // Pre-compute target size before first await (user activation intact)
      const remaining = cases.filter(x => x.id !== sessionId)
      if (remaining.length === 0 && processes.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getBarMode(remaining, processes, trayOpen, false, false))
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
      pin('categoryScreen')
      return
    }

    setManualEntryOpen(true)
    setOverlayOpen(true)
    pin('manualEntryForm')
  }

  function handleManualEntryClose() {
    setManualEntryOpen(false)
    setOverlayOpen(false)
    pin(getBarMode(cases, processes, trayOpen, false))
  }

  async function handleManualLog(categoryId, subcategoryId, minutes) {
    if (!user) return
    // Pre-compute target size before await (user activation intact)
    pin(getBarMode(cases, processes, trayOpen, false))
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
  }

  async function handlePickerConfirm(categoryId, subcategoryId, durationSeconds) {
    if (!pickerPending || !user) return
    const { processId } = pickerPending
    stopProcessTimer(processId)
    // Pre-compute target size before first await (user activation intact)
    const remaining = processes.filter(p => p.id !== processId)
    if (cases.length === 0 && remaining.length === 0) {
      pin('idle')
    } else {
      pin(getBarMode(cases, remaining, trayOpen, false))
    }
    const ok = await safeWrite(supabase.from('mpl_entries').insert({
      user_id: user.id,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      minutes: Math.round(durationSeconds / 60) || 1,
      source: 'pip',
    }))
    if (!ok) return
    setProcesses(remaining)
    setPickerPending(null)
    setOverlayOpen(false)
    refetch()
    if (cases.length === 0 && remaining.length === 0) {
      setTrayOpen(false)
    }
  }

  function handlePickerScreenChange(screen) {
    pin(screen === 'subcategory' ? 'subcategoryScreen' : 'categoryScreen')
  }

  function handlePickerCancel() {
    setPickerPending(null)
    setOverlayOpen(false)
    pin(getBarMode(cases, processes, trayOpen, false))
  }

  function handleProcessPause(id) {
    stopProcessTimer(id)
    setProcesses(prev => prev.map(p => p.id === id ? { ...p, paused: true } : p))
  }

  function handleProcessResume(id) {
    setProcesses(prev => prev.map(p => p.id === id ? { ...p, paused: false } : p))
    startProcessTimer(id)
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
      // Pre-compute target size before first await (user activation intact)
      // Only resize if case will actually close (not previouslyResolved — those open RFC overlay)
      if (!c.previouslyResolved) {
        const remaining = cases.filter(x => x.id !== id)
        if (remaining.length === 0 && processes.length === 0) {
          setTrayOpen(false)
          pin('idle')
        } else {
          pin(getBarMode(remaining, processes, trayOpen, false))
        }
      }
      await supabase.from('case_events').insert({
        session_id: id,
        user_id: user.id,
        type: 'resolved',
        excluded: false,
        rfc: false,
      })
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
      // Pre-compute target size before first await (user activation intact)
      const remaining = cases.filter(x => x.id !== id)
      if (remaining.length === 0 && processes.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getBarMode(remaining, processes, trayOpen, false))
      }
      await supabase.from('case_events').insert({
        session_id: id,
        user_id: user.id,
        type: 'reclassified',
        excluded: false,
        rfc: false,
      })
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
    if (resolvingCaseIds.current.has(id)) return
    const c = cases.find(x => x.id === id)
    if (!c) return
    resolvingCaseIds.current.add(id)
    try {
      stopCaseTimer(id)
      // Pre-compute target size before first await (user activation intact)
      const remaining = cases.filter(x => x.id !== id)
      if (remaining.length === 0 && processes.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getBarMode(remaining, processes, trayOpen, false))
      }
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
      // Pre-compute target size before first await (user activation intact)
      const remaining = cases.filter(x => x.id !== id)
      if (remaining.length === 0 && processes.length === 0) {
        setTrayOpen(false)
        pin('idle')
      } else {
        pin(getBarMode(remaining, processes, trayOpen, false))
      }
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
      setCases(remaining)
      if (focusedCaseId === id) setFocusedCaseId(remaining[0]?.id || null)
      refetch()
    } finally {
      resolvingCaseIds.current.delete(id)
    }
  }

  async function handleConfirmProcess(id, categoryId, subcategoryId, durationSeconds) {
    if (!user) return
    stopProcessTimer(id)
    // Pre-compute target size before first await (user activation intact)
    const remaining = processes.filter(p => p.id !== id)
    if (cases.length === 0 && remaining.length === 0) {
      setTrayOpen(false)
      pin('idle')
    } else {
      pin(getBarMode(cases, remaining, trayOpen, false))
    }
    const ok = await safeWrite(supabase.from('mpl_entries').insert({
      user_id: user.id,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      minutes: Math.round(durationSeconds / 60) || 1,
      source: 'pip',
    }))
    if (!ok) return
    setProcesses(remaining)
    refetch()
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

  // ── Widget mode: render PipBar directly (no dashboard) ───────────────────
  if (isWidgetMode) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        background: '#0f1117',
        overflow: 'hidden',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}>
        <PipErrorBoundary>
          {buildPipBar()}
        </PipErrorBoundary>
      </div>
    )
  }

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
