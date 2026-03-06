import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../lib/constants'
import Step1Profile from './onboarding/Step1Profile'
import Step2Team from './onboarding/Step2Team'
import Step3Bookmarklet from './onboarding/Step3Bookmarklet'

export default function Onboarding({ user, onComplete }) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({})

  function handleNext(data) {
    setFormData(prev => ({ ...prev, ...data }))
    setStep(s => s + 1)
  }

  function handleBack() {
    setStep(s => s - 1)
  }

  async function handleComplete() {
    try {
      const { data: updatedProfile } = await supabase
        .from('platform_users')
        .update({
          full_name:           formData.full_name,
          team:                formData.team,
          onboarding_complete: true,
          updated_at:          new Date().toISOString(),
        })
        .eq('id', user.id)
        .select('*')
        .single()

      onComplete(updatedProfile)
    } catch (err) {
      console.error('Onboarding complete error:', err)
    }
  }

  return (
    <>
      {/* Progress dots — fixed overlay centered at top of card area */}
      <div style={{
        position: 'fixed',
        top: 24,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        zIndex: 10,
      }}>
        {[1, 2, 3].map(n => (
          <div
            key={n}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: step === n ? C.mBtn : 'transparent',
              border: step === n ? `1px solid ${C.mBtn}` : `1px solid ${C.border}`,
              transition: 'all 200ms',
            }}
          />
        ))}
      </div>

      {step === 1 && (
        <Step1Profile user={user} onNext={handleNext} />
      )}
      {step === 2 && (
        <Step2Team onNext={handleNext} onBack={handleBack} />
      )}
      {step === 3 && (
        <Step3Bookmarklet onComplete={handleComplete} onBack={handleBack} />
      )}
    </>
  )
}
