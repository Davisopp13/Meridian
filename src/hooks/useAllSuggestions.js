import { useState, useEffect, useCallback } from 'react';
import { fetchAllSuggestions } from '../lib/api';

export function useAllSuggestions({ statusFilter = null, typeFilter = null } = {}) {
  const [state, setState] = useState({ suggestions: [], loading: true, error: null });
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: null }));

    fetchAllSuggestions({ statusFilter, typeFilter }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setState({ suggestions: [], loading: false, error });
      } else {
        setState({ suggestions: data || [], loading: false, error: null });
      }
    });

    return () => { cancelled = true; };
  }, [statusFilter, typeFilter, tick]);

  return { ...state, refetch };
}
