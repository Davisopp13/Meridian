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
  idle:              { width: 680, height: 60 },
  caseActive:        { width: 680, height: 60 },
  processActive:     { width: 680, height: 60 },
  bothActive:        { width: 680, height: 60 },
  trayOpen:          { width: 680, height: 360 },
  categoryScreen:    { width: 680, height: 380 },
  subcategoryScreen: { width: 680, height: 380 },
  manualEntryForm:   { width: 680, height: 360 },
  overlay:           { width: 680, height: 280 },
  minimized:         { width: 160, height: 32 },
}

export function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
