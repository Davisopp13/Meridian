import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../lib/constants'
import Step1Profile from './onboarding/Step1Profile'
import Step2Team from './onboarding/Step2Team'
import Step3Bookmarklet from './onboarding/Step3Bookmarklet'

export default function Onboarding({ user, onComplete }) {
  const [step, setStep]             = useState(1)
  const [formData, setFormData]     = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  function handleNext(data) {
    setFormData(prev => ({ ...prev, ...data }))
    setStep(s => s + 1)
  }

  function handleBack() {
    setStep(s => s - 1)
  }

  // Resolve a default team_id for the chosen haulage_type.
  // Picks the lowest-id active team matching haulage_type so both CH and MH
  // users land on a valid team even if none was explicitly selected.
  async function resolveDefaultTeamId(haulageType) {
    const { data, error } = await supabase
      .from('teams')
      .select('id')
      .eq('haulage_type', haulageType)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.warn('[Onboarding] resolveDefaultTeamId error:', error)
      return null
    }
    return data?.id ?? null
  }

  async function handleComplete() {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const haulageType = formData.team // 'CH' | 'MH'
      const teamId      = await resolveDefaultTeamId(haulageType)

      const payload = {
        full_name:           formData.full_name,
        team:                haulageType,
        team_id:             teamId,
        onboarding_complete: true,
        updated_at:          new Date().toISOString(),
      }

      // 1) Try UPDATE first — row usually exists via the auth.users trigger.
      let { data: updated, error: updateErr } = await supabase
        .from('platform_users')
        .update(payload)
        .eq('id', user.id)
        .select('*')
        .maybeSingle()

      if (updateErr) throw updateErr

      // 2) If no row matched, INSERT (trigger may not have fired / row missing).
      if (!updated) {
        const { data: inserted, error: insertErr } = await supabase
          .from('platform_users')
          .insert({ id: user.id, email: user.email, ...payload })
          .select('*')
          .single()
        if (insertErr) throw insertErr
        updated = inserted
      }

      if (!updated) {
        throw new Error('Profile write returned no row.')
      }

      onComplete(updated)
    } catch (err) {
      console.error('[Onboarding] handleComplete error:', err)
      setSubmitError(err?.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
    // On success we leave submitting=true so the button stays disabled while
    // the parent swaps the onboarding view out for the dashboard.
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
        <Step3Bookmarklet
          onComplete={handleComplete}
          onBack={handleBack}
          submitting={submitting}
          submitError={submitError}
        />
      )}
    </>
  )
}
