import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

const C = {
  bg:      '#0f0f1e',
  card:    '#1a1a2e',
  border:  'rgba(255,255,255,0.12)',
  textPri: 'rgba(255,255,255,0.93)',
  textSec: 'rgba(255,255,255,0.45)',
  accent:  '#E8540A',
  blue:    '#003087',
}

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: '40px 36px', width: 360, boxSizing: 'border-box',
      }}>
        {/* Logo mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: C.accent }} />
          </div>
          <span style={{ color: C.textPri, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>
            Meridian
          </span>
        </div>

        {sent ? (
          <>
            <p style={{ color: C.textPri, fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
              Check your email
            </p>
            <p style={{ color: C.textSec, fontSize: 14, margin: 0, lineHeight: 1.5 }}>
              We sent a sign-in link to <strong style={{ color: C.textPri }}>{email}</strong>.
              Click it to continue.
            </p>
          </>
        ) : (
          <>
            <p style={{ color: C.textPri, fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>
              Sign in to Meridian
            </p>
            <p style={{ color: C.textSec, fontSize: 13, margin: '0 0 24px' }}>
              Enter your Hapag-Lloyd email address.
            </p>
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="you@hlag.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '10px 14px', color: C.textPri,
                  fontSize: 14, outline: 'none', marginBottom: 12,
                }}
              />
              {error && (
                <p style={{ color: '#f87171', fontSize: 13, margin: '0 0 10px' }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !email}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                  background: loading || !email ? 'rgba(232,84,10,0.4)' : C.accent,
                  color: '#fff', fontWeight: 600, fontSize: 14, cursor: loading || !email ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Sending…' : 'Send sign-in link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
