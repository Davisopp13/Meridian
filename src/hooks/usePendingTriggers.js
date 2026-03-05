import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Subscribes to pending_triggers via Supabase Realtime.
 * When a row is inserted (by the bookmarklet relay), it calls
 * the appropriate handler and deletes the consumed row.
 *
 * @param {string|null} userId - Current authenticated user's ID
 * @param {{ handleCaseStart: Function, handleProcessStart: Function }} handlers
 */
export function usePendingTriggers(userId, handlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!userId) return

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
        async (payload) => {
          const trigger = payload.new
          if (!trigger) return

          console.log('[Meridian] Realtime trigger received:', trigger.type, trigger)

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
            }
          } catch (err) {
            console.error('[Meridian] Error handling trigger:', err)
          }

          // Delete the consumed trigger row
          try {
            await supabase
              .from('pending_triggers')
              .delete()
              .eq('id', trigger.id)
          } catch (err) {
            console.error('[Meridian] Error deleting consumed trigger:', err)
          }
        }
      )
      .subscribe((status) => {
        console.log('[Meridian] Realtime subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])
}
