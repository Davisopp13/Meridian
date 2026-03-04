export const C = {
  bg:            '#1a1a2e',
  mBtn:          '#003087',
  mMark:         '#E8540A',
  resolved:      '#16a34a',
  reclass:       '#dc2626',
  calls:         '#0284c7',
  process:       '#60a5fa',
  processNavy:   'rgba(0,48,135,0.45)',
  awaiting:      '#d97706',
  activeDot:     '#4ade80',
  divider:       'rgba(255,255,255,0.08)',
  border:        'rgba(255,255,255,0.12)',
  textPri:       'rgba(255,255,255,0.93)',
  textSec:       'rgba(255,255,255,0.45)',
  textDim:       'rgba(255,255,255,0.25)',
  caseFocus:     'rgba(0,48,135,0.55)',
  caseBorder:    '#003087',
  rowFocus:      'rgba(0,48,135,0.28)',
  amberRow:      'rgba(217,119,6,0.18)',
}

export const SIZES = {
  idle:          { width: 320,  height: 64  },
  caseActive:    { width: 580,  height: 64  },
  processActive: { width: 500,  height: 64  },
  bothActive:    { width: 640,  height: 64  },
  trayOpen:      { width: 640,  height: 360 },
  overlay:       { width: 640,  height: 220 },
  minimized:     { width: 200,  height: 36  },
}

export function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
