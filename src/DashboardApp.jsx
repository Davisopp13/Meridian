import { useState, useEffect } from 'react'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { supabase } from './lib/supabase.js'
import { fetchProfile } from './lib/api.js'
import Onboarding from './components/Onboarding.jsx'
import Dashboard from './components/Dashboard.jsx'
import AuthScreen from './components/auth/AuthScreen.jsx'

export default function DashboardApp() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('connected') // eslint-disable-line no-unused-vars

  // ── Auth: fetch current session + listen for changes ──────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchProfile(u.id).then(({ data: p }) => { setProfile(p); setAuthLoading(false) })
      } else {
        setAuthLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchProfile(u.id).then(({ data: p }) => setProfile(p))
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Connection status health-check ────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function pingConnection() {
      const { error } = await supabase.from('platform_users').select('id').limit(1)
      setConnectionStatus(error ? 'offline' : 'connected')
    }
    pingConnection()
    const intervalId = setInterval(pingConnection, 30000)
    return () => clearInterval(intervalId)
  }, [user])

  async function refreshProfile() {
    if (!user) return
    const { data } = await fetchProfile(user.id)
    if (data) setProfile(data)
  }

  function handleOnboardingComplete(updatedProfile) {
    setProfile(updatedProfile)
  }

  function handleLaunch() {
    const url = window.location.origin + '/?mode=ct-widget'
    window.open(url, 'meridian-ct', 'popup,width=600,height=64,top=0,left=' + (screen.availWidth - 616))
  }

  function handleLaunchMpl() {
    const url = window.location.origin + '/?mode=mpl-widget'
    window.open(url, 'meridian-mpl', 'popup,width=500,height=64,top=80,left=' + (screen.availWidth - 516))
  }

  // ── Auth gate ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ background: '#0f0f1e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes meridian-spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(232,84,10,0.2)', borderTopColor: '#E8540A', borderRadius: '50%', animation: 'meridian-spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  if (!profile?.onboarding_complete) {
    return <Onboarding user={user} onComplete={handleOnboardingComplete} />
  }

  const initialTheme = profile?.settings?.theme ?? 'dark'

  return (
    <ThemeProvider initialTheme={initialTheme}>
      <Dashboard
        user={user}
        profile={profile}
        onLaunchPip={handleLaunch}
        onLaunchMpl={handleLaunchMpl}
        onRefreshProfile={refreshProfile}
      />
    </ThemeProvider>
  )
}
