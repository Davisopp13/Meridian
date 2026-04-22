import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

const INITIAL_STATE = {
  modalState: 'idle',
  cases: [],
  batchId: null,
  error: null,
  triggerRowId: null,
}

export default function useMassReclass() {
  const [state, setState] = useState(INITIAL_STATE)
  const stateRef = useRef(state)
  stateRef.current = state

  const openModal = useCallback((cases, triggerRowId) => {
    setState({
      modalState: 'confirming',
      cases,
      batchId: null,
      error: null,
      triggerRowId,
    })
  }, [])

  const confirm = useCallback(async () => {
    const { cases } = stateRef.current
    setState(s => ({ ...s, modalState: 'submitting', error: null }))

    const { data, error } = await supabase.rpc('bulk_reclassify_cases', {
      p_case_refs: cases,
    })

    if (error || !data || !data[0]) {
      setState(s => ({
        ...s,
        modalState: 'error',
        error: error?.message || 'Unexpected response from server',
      }))
      return
    }

    setState(s => ({
      ...s,
      modalState: 'success',
      batchId: data[0].batch_id,
    }))
  }, [])

  const undo = useCallback(async () => {
    const { batchId } = stateRef.current
    if (!batchId) return

    await supabase.rpc('undo_mass_reclass_batch', { p_batch_id: batchId })
    setState(INITIAL_STATE)
  }, [])

  const close = useCallback(async () => {
    const { triggerRowId } = stateRef.current
    if (triggerRowId) {
      await supabase.from('pending_triggers').delete().eq('id', triggerRowId)
    }
    setState(INITIAL_STATE)
  }, [])

  return {
    modalState: state.modalState,
    cases: state.cases,
    batchId: state.batchId,
    error: state.error,
    openModal,
    confirm,
    undo,
    close,
  }
}
