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
  manualEntryForm: 500,
  overlay: 354,
}

export function getSizeForState(stateKey, statButtons) {
  if (stateKey === 'minimized') {
    return { width: getMiniWidth(statButtons), height: HEIGHTS.minimized }
  }
  return { width: getBarWidth(stateKey, statButtons), height: HEIGHTS[stateKey] || 64 }
}

export function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const DEFAULT_SETTINGS = {
  stat_buttons: ['resolved', 'reclass', 'calls', 'processes', 'total'],
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
