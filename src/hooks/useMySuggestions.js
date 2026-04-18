import { useState, useEffect, useCallback } from 'react';
import { fetchMySuggestions } from '../lib/api';

export function useMySuggestions(userId) {
  const [state, setState] = useState({ suggestions: [], loading: true, error: null });
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!userId) {
      setState({ suggestions: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: null }));

    fetchMySuggestions(userId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setState({ suggestions: [], loading: false, error });
      } else {
        setState({ suggestions: data || [], loading: false, error: null });
      }
    });

    return () => { cancelled = true; };
  }, [userId, tick]);

  return { ...state, refetch };
}
