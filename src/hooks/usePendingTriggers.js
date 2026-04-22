import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Subscribes to pending_triggers via Supabase Realtime.
 * When a row is inserted (by the bookmarklet relay), it calls
 * the appropriate handler and deletes the consumed row.
 *
 * @param {string|null} userId - Current authenticated user's ID
 * @param {{ handleCaseStart: Function, handleProcessStart: Function, onMassReclass?: Function }} handlers
 */
export function usePendingTriggers(userId, handlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!userId) return

    // Process a single trigger row — shared by poll and realtime
    async function consumeTrigger(trigger) {
      if (!trigger) return

      console.log('[Meridian] Processing trigger:', trigger.type, trigger)

      let shouldDelete = true

      try {
        if (trigger.type === 'MERIDIAN_CASE_START' && trigger.case_number) {
          handlersRef.current.handleCaseStart({
            caseNumber: trigger.case_number,
            accountId: trigger.account_id,
            caseType: trigger.case_type,
            caseSubtype: trigger.case_subtype,
          })
        } else if (trigger.type === 'MERIDIAN_PROCESS_START') {
          handlersRef.current.handleProcessStart()
        } else if (trigger.type === 'MERIDIAN_MASS_RECLASS') {
          let cases
          try {
            cases = JSON.parse(trigger.case_number)
          } catch (parseErr) {
            console.warn('[Meridian] MERIDIAN_MASS_RECLASS: failed to parse case_number JSON:', parseErr)
          }
          if (Array.isArray(cases) && cases.length > 0) {
            if (handlersRef.current.onMassReclass) {
              handlersRef.current.onMassReclass(cases, trigger.id)
              shouldDelete = false
            }
          } else {
            console.warn('[Meridian] MERIDIAN_MASS_RECLASS: empty or invalid cases, deleting trigger row')
          }
        }
      } catch (err) {
        console.error('[Meridian] Error handling trigger:', err)
      }

      // Delete the consumed trigger row (deferred for mass_reclass — handler calls close())
      if (shouldDelete) {
        try {
          await supabase
            .from('pending_triggers')
            .delete()
            .eq('id', trigger.id)
        } catch (err) {
          console.error('[Meridian] Error deleting consumed trigger:', err)
        }
      }
    }

    // Poll for any triggers already in the DB (inserted before subscription)
    async function pollExisting() {
      try {
        const { data, error } = await supabase
          .from('pending_triggers')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('[Meridian] Failed to poll pending_triggers:', error)
          return
        }

        for (const trigger of (data || [])) {
          await consumeTrigger(trigger)
        }
      } catch (err) {
        console.error('[Meridian] Error polling pending_triggers:', err)
      }
    }

    // Initial poll for missed triggers
    pollExisting()

    // Periodic poll as safety net (every 5s)
    const pollInterval = setInterval(pollExisting, 5000)

    // Realtime subscription for instant response
    const channel = supabase
      .channel('pending-triggers-' + userId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pending_triggers',
          filter: 'user_id=eq.' + userId,
        },
        (payload) => consumeTrigger(payload.new)
      )
      .subscribe((status) => {
        console.log('[Meridian] Realtime subscription status:', status)
      })

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [userId])
}
