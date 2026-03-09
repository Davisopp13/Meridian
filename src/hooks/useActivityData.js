import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function getCutoff(rangeDays) {
  const now = new Date();
  const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  ny.setHours(0, 0, 0, 0);
  ny.setDate(ny.getDate() - rangeDays);
  return ny;
}

const TYPE_LABEL = {
  resolved: 'Resolved',
  reclassified: 'Reclassified',
  call: 'Call',
  not_a_case: 'Not a Case',
  rfc: 'RFC',
};

function normalizeCaseEvent(row) {
  return {
    id: row.id,
    type: TYPE_LABEL[row.type] || row.type,
    src: 'case',
    case_number: row.ct_cases?.case_number || null,
    category: '',
    dur: row.ct_cases?.duration_s || 0,
    rfc: row.rfc || false,
    ts: new Date(row.timestamp || row.created_at),
  };
}

function normalizeMplEntry(row) {
  return {
    id: row.id,
    type: 'Process',
    src: 'process',
    case_number: null,
    category: row.mpl_categories?.name || '',
    dur: (row.minutes || 0) * 60,
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

      const [caseResult, mplResult] = await Promise.all([
        supabase
          .from('case_events')
          .select('id, type, rfc, timestamp, ct_cases(case_number, duration_s)')
          .eq('user_id', userId)
          .gte('timestamp', cutoff.toISOString()),
        supabase
          .from('mpl_entries')
          .select('id, minutes, created_at, mpl_categories(name)')
          .eq('user_id', userId)
          .gte('created_at', cutoff.toISOString()),
      ]);

      if (cancelled) return;

      if (caseResult.error || mplResult.error) {
        setError(caseResult.error || mplResult.error);
        setLoading(false);
        return;
      }

      const caseEntries = (caseResult.data || []).map(normalizeCaseEvent);
      const mplEntries  = (mplResult.data  || []).map(normalizeMplEntry);

      const merged = [...caseEntries, ...mplEntries].sort((a, b) => b.ts - a.ts);

      setEntries(merged);
      setLoading(false);
    }

    fetchData();

    const channel = supabase
      .channel(`activity-${userId}-${rangeDays}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'case_events', filter: `user_id=eq.${userId}` },
        () => { fetchData(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mpl_entries', filter: `user_id=eq.${userId}` },
        () => { fetchData(); }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, rangeDays]);

  return { entries, loading, error };
}
