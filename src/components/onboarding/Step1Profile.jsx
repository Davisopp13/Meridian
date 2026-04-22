import { useState } from 'react'

const C = {
  bg:      'var(--bg-deep)',
  cardBg:  'var(--bg-card)',
  border:  'var(--border)',
  textPri: 'var(--text-pri)',
  textSec: 'var(--text-dim)',
  mBtn:    'var(--color-mbtn)',
}

export default function Step1Profile({ user, onNext }) {
  const [name, setName] = useState(user?.email?.split('@')[0] ?? '')

  const pageStyle = {
    minHeight: '100vh',
    background: C.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  }

  const cardStyle = {
    width: '100%',
    maxWidth: 480,
    background: C.cardBg,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: 40,
  }

  const logoStyle = {
    display: 'block',
    width: 64,
    height: 64,
    borderRadius: 12,
    margin: '0 auto 24px',
  }

  const headingStyle = {
    color: C.textPri,
    fontSize: 24,
    fontWeight: 800,
    textAlign: 'center',
    margin: '0 0 8px',
  }

  const subheadingStyle = {
    color: C.textSec,
    fontSize: 14,
    textAlign: 'center',
    margin: '0 0 32px',
  }

  const labelStyle = {
    display: 'block',
    color: C.textSec,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
  }

  const inputStyle = {
    display: 'block',
    width: '100%',
    height: 48,
    background: 'var(--hover-surface)',
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    color: C.textPri,
    fontSize: 15,
    padding: '0 16px',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 24,
  }

  const btnStyle = {
    display: 'block',
    width: '100%',
    height: 48,
    background: C.mBtn,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    borderRadius: 10,
    border: 'none',
    cursor: name.trim() ? 'pointer' : 'not-allowed',
    opacity: name.trim() ? 1 : 0.4,
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <img src="/meridian-mark-192.png" alt="Meridian" style={logoStyle} />
        <h1 style={headingStyle}>Welcome to Meridian</h1>
        <p style={subheadingStyle}>Let's get you set up</p>
        <label style={labelStyle}>Your name</label>
        <input
          style={inputStyle}
          value={name}
          onChange={e => setName(e.target.value)}
          onFocus={e => { e.target.style.borderColor = C.mBtn }}
          onBlur={e => { e.target.style.borderColor = C.border }}
          placeholder="Your name"
          autoFocus
        />
        <button
          style={btnStyle}
          disabled={!name.trim()}
          onClick={() => onNext({ full_name: name.trim() })}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
