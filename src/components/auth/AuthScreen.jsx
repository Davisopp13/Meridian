import { useState } from 'react'
import SignIn from './SignIn.jsx'
import SignUp from './SignUp.jsx'

export default function AuthScreen() {
  const [view, setView] = useState('signin')

  if (view === 'signin') return <SignIn onSwitchToSignUp={() => setView('signup')} />
  return <SignUp onSwitchToSignIn={() => setView('signin')} />
}
