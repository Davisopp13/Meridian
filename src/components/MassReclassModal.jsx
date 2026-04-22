import { useEffect, useState } from 'react'

const OVERLAY = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(3px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
}

const CARD = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  width: 360,
  maxWidth: '95vw',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

const HEADER = {
  padding: '14px 18px 10px',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--text-pri)',
  borderBottom: '1px solid var(--border)',
}

const BODY = {
  padding: '12px 18px',
  flex: 1,
}

const FOOTER = {
  padding: '10px 18px 14px',
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  borderTop: '1px solid var(--border)',
}

const BTN_PRIMARY = {
  background: 'var(--color-reclass)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '7px 16px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const BTN_GHOST = {
  background: 'transparent',
  color: 'var(--text-sec)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '7px 14px',
  fontSize: 13,
  cursor: 'pointer',
}

const BTN_LINK = {
  background: 'transparent',
  color: 'var(--text-dim, var(--text-sec))',
  border: 'none',
  padding: '7px 10px',
  fontSize: 12,
  cursor: 'pointer',
  textDecoration: 'underline',
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 16,
        height: 16,
        border: '2px solid var(--border)',
        borderTop: '2px solid var(--color-reclass)',
        borderRadius: '50%',
        animation: 'mrm-spin 0.7s linear infinite',
        flexShrink: 0,
      }} />
      <style>{`@keyframes mrm-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ConfirmingBody({ cases }) {
  return (
    <div>
      <div style={{ color: 'var(--text-sec)', fontSize: 12, marginBottom: 8 }}>
        {cases.length} case{cases.length !== 1 ? 's' : ''} selected
      </div>
      <div style={{
        maxHeight: 240,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {cases.map(c => (
          <div
            key={c.sf_case_id || c.case_number}
            style={{
              fontSize: 13,
              color: 'var(--text-pri)',
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 6,
              fontFamily: 'monospace',
            }}
          >
            {c.case_number}
          </div>
        ))}
      </div>
    </div>
  )
}

function CountdownBody({ cases, onClose }) {
  const [secondsLeft, setSecondsLeft] = useState(10)

  useEffect(() => {
    if (secondsLeft <= 0) {
      onClose()
      return
    }
    const id = setInterval(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearInterval(id)
  }, [secondsLeft, onClose])

  return (
    <div style={{ color: 'var(--text-sec)', fontSize: 13 }}>
      Undo within{' '}
      <span style={{ color: 'var(--text-pri)', fontWeight: 700 }}>{secondsLeft}s</span>
    </div>
  )
}

export default function MassReclassModal({ state, cases, batchId, error, onConfirm, onUndo, onClose }) {
  if (state === 'idle') return null

  return (
    <div style={OVERLAY}>
      <div style={CARD}>
        {state === 'confirming' && (
          <>
            <div style={HEADER}>Reclassify selected cases?</div>
            <div style={BODY}><ConfirmingBody cases={cases} /></div>
            <div style={FOOTER}>
              <button style={BTN_GHOST} onClick={onClose}>Cancel</button>
              <button style={BTN_PRIMARY} onClick={onConfirm}>
                Reclassify {cases.length} case{cases.length !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}

        {state === 'submitting' && (
          <>
            <div style={HEADER}>Working…</div>
            <div style={{ ...BODY, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Spinner />
              <span style={{ color: 'var(--text-sec)', fontSize: 13 }}>
                Reclassifying {cases.length} case{cases.length !== 1 ? 's' : ''}
              </span>
            </div>
          </>
        )}

        {state === 'success' && (
          <>
            <div style={HEADER}>Reclassified {cases.length} case{cases.length !== 1 ? 's' : ''}</div>
            <div style={BODY}>
              <CountdownBody cases={cases} onClose={onClose} />
            </div>
            <div style={FOOTER}>
              <button style={BTN_LINK} onClick={onClose}>Dismiss</button>
              <button style={BTN_PRIMARY} onClick={onUndo}>Undo</button>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <div style={HEADER}>Something went wrong</div>
            <div style={{ ...BODY, color: 'var(--text-sec)', fontSize: 13 }}>
              {error || 'An unexpected error occurred.'}
            </div>
            <div style={FOOTER}>
              <button style={BTN_GHOST} onClick={onClose}>Close</button>
              <button style={BTN_PRIMARY} onClick={onConfirm}>Retry</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
