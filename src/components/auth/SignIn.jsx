import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function SignIn({ onSwitchToSignUp }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSignIn() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid email or password. Please try again.')
    }
    // On success — supabase session updates automatically, App.jsx re-renders via onAuthStateChange
    setLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && email && password) handleSignIn()
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-deep)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16, padding: 40,
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <img src="/meridian-mark-192.png" style={{ width: 64, height: 64, borderRadius: 10, marginBottom: 24 }} alt="Meridian" />
          <h1 style={{ margin: 0, color: 'var(--text-pri)', fontSize: 22, fontWeight: 800, textAlign: 'center' }}>
            Sign in to Meridian
          </h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-dim)', fontSize: 13, textAlign: 'center' }}>
            Hapag-Lloyd IDT &amp; Customer Service
          </p>
        </div>

        {/* Email */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 700,
            color: 'var(--text-dim)', textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: 6,
          }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="you@hapag-lloyd.com"
            style={{
              width: '100%', height: 48, padding: '0 16px',
              background: 'var(--hover-surface)',
              border: '1px solid var(--border)',
              borderRadius: 10, color: 'var(--text-pri)',
              fontSize: 15, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 700,
            color: 'var(--text-dim)', textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: 6,
          }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%', height: 48, padding: '0 16px',
              background: 'var(--hover-surface)',
              border: '1px solid var(--border)',
              borderRadius: 10, color: 'var(--text-pri)',
              fontSize: 15, outline: 'none', boxSizing: 'border-box',
            }}
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
          onClick={handleSignIn}
          disabled={loading || !email || !password}
          style={{
            width: '100%', height: 48, borderRadius: 10, border: 'none',
            background: loading || !email || !password ? 'rgba(0,48,135,0.5)' : 'var(--color-mbtn)',
            color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
            transition: 'all var(--motion-fast)',
          }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          Don't have an account?{' '}
          <span
            onClick={onSwitchToSignUp}
            style={{ color: 'var(--color-mmark)', cursor: 'pointer', fontWeight: 700 }}
          >
            Sign up
          </span>
        </p>
      </div>
    </div>
  )
}
