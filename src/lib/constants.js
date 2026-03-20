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

export const SIZES = {
  idle: { width: 680, height: 68 },
  caseActive: { width: 680, height: 68 },
  processActive: { width: 680, height: 68 },
  bothActive: { width: 680, height: 68 },
  trayOpen: { width: 680, height: 368 },
  categoryScreen: { width: 680, height: 392 },
  subcategoryScreen: { width: 680, height: 392 },
  manualEntryForm: { width: 680, height: 368 },
  overlay: { width: 680, height: 292 },
  minimized: { width: 220, height: 32 },
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
