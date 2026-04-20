export const C = {
  bg: 'var(--bg-card)',
  mBtn: 'var(--color-mbtn)',
  mMark: 'var(--color-mmark)',
  resolved: 'var(--color-resolved)',
  reclass: 'var(--color-reclass)',
  calls: 'var(--color-calls)',
  process: 'var(--color-process)',
  processNavy: 'var(--color-process-navy)',
  awaiting: 'var(--color-awaiting)',
  activeDot: 'var(--color-active-dot)',
  divider: 'var(--divider)',
  border: 'var(--border)',
  textPri: 'var(--text-pri)',
  textSec: 'var(--text-sec)',
  textDim: 'var(--text-dim)',
  caseFocus: 'var(--case-focus)',
  caseBorder: 'var(--case-border)',
  rowFocus: 'var(--row-focus)',
  amberRow: 'var(--amber-row)',
}

// ── Dynamic PiP Sizing ─────────────────────────────────────────────

export const STAT_BUTTON_WIDTHS = {
  resolved: 110, reclass: 100,
  calls: 90, processes: 114, total: 90,
}

export const STATE_BASE_WIDTHS = {
  idle: 160,
  caseActive: 260,
  processActive: 190,
  bothActive: 350,
  rfcBanner: 260,
  trayOpen: 380,
  categoryScreen: 240,
  subcategoryScreen: 240,
  manualEntryForm: 160,
  overlay: 240,
}

const BUTTON_GAP = 6

export function getBarWidth(stateKey, statButtons) {
  const base = STATE_BASE_WIDTHS[stateKey] || 240
  const btnW = statButtons.reduce((sum, k) => sum + (STAT_BUTTON_WIDTHS[k] || 0), 0)
  const gaps = Math.max(0, statButtons.length - 1) * BUTTON_GAP
  return base + btnW + gaps
}

export const MINI_BASE = 70
export const MINI_PER_SCORE = 24

export function getMiniWidth(statButtons) {
  return MINI_BASE + statButtons.length * MINI_PER_SCORE
}

export const HEIGHTS = {
  minimized: 32,
  idle: 64,
  caseActive: 64,
  processActive: 64,
  bothActive: 64,
  rfcBanner: 114,
  trayOpen: 276,
  categoryScreen: 420,
  subcategoryScreen: 420,
  manualEntryForm: 480,
  overlay: 354,
}

export function getSizeForState(stateKey, statButtons) {
  if (stateKey === 'minimized') {
    return { width: getMiniWidth(statButtons), height: HEIGHTS.minimized }
  }
  return { width: getBarWidth(stateKey, statButtons), height: HEIGHTS[stateKey] || 64 }
}

// ── CT Widget Sizing (cases only) ─────────────────────────────────

export const CT_HEIGHTS = {
  minimized: 32,
  idle: 64,
  caseActive: 64,
  bothActive: 64,
  rfcBanner: 114,
  trayOpen: 276,
}

export const CT_STATE_BASE_WIDTHS = {
  idle: 160,
  caseActive: 260,
  bothActive: 350,
  rfcBanner: 260,
  trayOpen: 380,
}

export const CT_STAT_BUTTON_WIDTHS = {
  resolved: 110, reclass: 100,
  calls: 90, total: 90,
}

export function getCtBarWidth(stateKey, statButtons) {
  const base = CT_STATE_BASE_WIDTHS[stateKey] || 240
  const btnW = statButtons.reduce((sum, k) => sum + (CT_STAT_BUTTON_WIDTHS[k] || 0), 0)
  const gaps = Math.max(0, statButtons.length - 1) * BUTTON_GAP
  return base + btnW + gaps
}

export function getCtSizeForState(stateKey, statButtons) {
  if (stateKey === 'minimized') {
    return { width: getMiniWidth(statButtons), height: CT_HEIGHTS.minimized }
  }
  return { width: getCtBarWidth(stateKey, statButtons), height: CT_HEIGHTS[stateKey] || 64 }
}

// ── MPL Widget Sizing (processes only) ───────────────────────────

export const MPL_HEIGHTS = {
  minimized: 32,
  idle: 64,
  timerActive: 64,
  chipStrip: 108,           // 64 (bar) + 44 (chip strip) — timed log
  quickLog: 108,            // same as chipStrip — category step identical
  quickLogDuration: 108,    // same height — duration chips fit in the same 44px strip
  categoryPicker: 480,
  manualEntry: 480,         // keep for backward compat
}

export const MPL_STATE_BASE_WIDTHS = {
  idle: 160,
  timerActive: 200,
  chipStrip: 200,           // same as timerActive
  quickLog: 200,
  quickLogDuration: 200,
  categoryPicker: 200,
  manualEntry: 200,
}

export const MPL_STAT_BUTTON_WIDTHS = {
  processes: 114,
  total: 90,
}

export function getMplBarWidth(stateKey, statButtons) {
  const base = MPL_STATE_BASE_WIDTHS[stateKey] || 200
  const btnW = statButtons.reduce((sum, k) => sum + (MPL_STAT_BUTTON_WIDTHS[k] || 0), 0)
  const gaps = Math.max(0, statButtons.length - 1) * BUTTON_GAP
  return base + btnW + gaps
}

export function getMplSizeForState(stateKey, statButtons) {
  if (stateKey === 'minimized') {
    return { width: getMiniWidth(statButtons), height: MPL_HEIGHTS.minimized }
  }
  return { width: getMplBarWidth(stateKey, statButtons), height: MPL_HEIGHTS[stateKey] || 100 }
}

export function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const DEFAULT_SETTINGS = {
  stat_buttons: ['resolved', 'reclass', 'calls', 'total'],
  total_includes: ['resolved', 'reclass', 'calls'],
  pip_position: 'bottom-right',
  team: null,
  theme: 'dark',
  notifications: {
    toast_on_log: true,
    sound: false,
  },
}

export function getUserSettings(profile) {
  const stored = profile?.settings || {}
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...(stored.notifications || {}),
    },
  }
}
