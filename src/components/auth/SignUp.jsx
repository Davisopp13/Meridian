import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function SignUp({ onSwitchToSignIn }) {
  const [view, setView] = useState('form') // 'form' | 'confirm'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSignUp() {
    setLoading(true)
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      setLoading(false)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Update profile with full_name immediately after signup
    if (data.user) {
      await supabase.from('platform_users')
        .update({ full_name: fullName.trim() })
        .eq('id', data.user.id)
    }

    // Show confirmation message — Supabase sends a confirmation email via Resend
    setView('confirm')
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', height: 48, padding: '0 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, color: 'rgba(255,255,255,0.93)',
    fontSize: 15, outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: 6,
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f1e',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: '#1a1a2e',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16, padding: 40,
        boxSizing: 'border-box',
      }}>
        {view === 'confirm' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
            <h2 style={{ color: 'rgba(255,255,255,0.93)', fontSize: 20, fontWeight: 800, marginBottom: 8, margin: '0 0 8px' }}>
              Check your email
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              We sent a confirmation link to{' '}
              <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{email}</strong>.
              Click the link to activate your account, then come back here to sign in.
            </p>
            <span
              onClick={onSwitchToSignIn}
              style={{
                display: 'inline-block', marginTop: 24, color: '#E8540A',
                cursor: 'pointer', fontWeight: 700, fontSize: 14,
              }}
            >
              ← Back to Sign In
            </span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
              <img src="/meridian-mark-192.png" style={{ width: 64, height: 64, borderRadius: 10, marginBottom: 24 }} alt="Meridian" />
              <h1 style={{ margin: 0, color: 'rgba(255,255,255,0.93)', fontSize: 22, fontWeight: 800, textAlign: 'center' }}>
                Create your account
              </h1>
              <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center' }}>
                Hapag-Lloyd IDT &amp; Customer Service
              </p>
            </div>

            {/* Full name */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Smith"
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@hapag-lloyd.com"
                style={inputStyle}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Confirm password */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                fontSize: 13, color: '#fca5a5',
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSignUp}
              disabled={loading || !fullName || !email || !password || !confirmPassword}
              style={{
                width: '100%', height: 48, borderRadius: 10, border: 'none',
                background: loading || !fullName || !email || !password || !confirmPassword
                  ? 'rgba(0,48,135,0.5)' : '#003087',
                color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: loading || !fullName || !email || !password || !confirmPassword
                  ? 'not-allowed' : 'pointer',
                transition: 'all 150ms',
              }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              Already have an account?{' '}
              <span
                onClick={onSwitchToSignIn}
                style={{ color: '#E8540A', cursor: 'pointer', fontWeight: 700 }}
              >
                Sign in
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
