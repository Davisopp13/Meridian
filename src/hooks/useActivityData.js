import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function getCutoff(rangeDays) {
  const now = new Date();
  const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  ny.setHours(0, 0, 0, 0);
  ny.setDate(ny.getDate() - rangeDays);
  return ny;
}

function normalizeCt(row) {
  return {
    id: row.id,
    type: row.action_type,
    src: 'case',
    case_number: row.case_number || null,
    category: row.category || '',
    dur: row.time_spent || 0,
    rfc: row.is_rfc || false,
    ts: new Date(row.created_at),
  };
}

function normalizeMpl(row) {
  return {
    id: row.id,
    type: 'Process',
    src: 'process',
    case_number: null,
    category: row.category || '',
    dur: row.duration || 0,
    rfc: false,
    ts: new Date(row.created_at),
  };
}

export function useActivityData({ userId, rangeDays }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      const cutoff = getCutoff(rangeDays);

      const [ctResult, mplResult] = await Promise.all([
        supabase
          .from('ct_sessions')
          .select('id, case_number, action_type, category, time_spent, is_rfc, created_at')
          .eq('user_id', userId)
          .gte('created_at', cutoff.toISOString()),
        supabase
          .from('mpl_sessions')
          .select('id, category, duration, created_at')
          .eq('user_id', userId)
          .gte('created_at', cutoff.toISOString()),
      ]);

      if (cancelled) return;

      if (ctResult.error || mplResult.error) {
        setError(ctResult.error || mplResult.error);
        setLoading(false);
        return;
      }

      const ctEntries  = (ctResult.data  || []).map(normalizeCt);
      const mplEntries = (mplResult.data || []).map(normalizeMpl);

      const merged = [...ctEntries, ...mplEntries].sort((a, b) => b.ts - a.ts);

      setEntries(merged);
      setLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [userId, rangeDays]);

  return { entries, loading, error };
}
