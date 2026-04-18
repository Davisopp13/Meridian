import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { aggregateStats, getDateRange } from '../lib/stats.js';

export function useDashboardStats({ userId, period }) {
  const [stats, setStats] = useState({
    resolved: 0,
    reclass: 0,
    calls: 0,
    notACase: 0,
    processes: 0,
    casesAndCalls: 0,
    totalActivity: 0,
    dailyRows: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!userId || !period) return;

    let cancelled = false;

    async function fetchStats() {
      setStats(prev => ({ ...prev, loading: true, error: null }));

      const range = getDateRange(period);
      if (!range) return;

      const [eventsResult, procsResult] = await Promise.all([
        supabase
          .from('case_events')
          .select('type, excluded, timestamp')
          .eq('user_id', userId)
          .gte('timestamp', range.from.toISOString())
          .lte('timestamp', range.to.toISOString()),
        supabase
          .from('mpl_entries')
          .select('created_at, minutes, category_id')
          .eq('user_id', userId)
          .gte('created_at', range.from.toISOString())
          .lte('created_at', range.to.toISOString()),
      ]);

      if (cancelled) return;

      if (eventsResult.error || procsResult.error) {
        setStats(prev => ({
          ...prev,
          loading: false,
          error: eventsResult.error || procsResult.error,
        }));
        return;
      }

      const events = eventsResult.data || [];
      const procs  = procsResult.data || [];

      const { resolved, reclass, calls, notACase, processes, casesAndCalls, totalActivity, dailyRows } =
        aggregateStats(events, procs);

      setStats({
        resolved,
        reclass,
        calls,
        notACase,
        processes,
        casesAndCalls,
        totalActivity,
        dailyRows,
        loading: false,
        error: null,
      });
    }

    fetchStats();
    return () => { cancelled = true; };
  }, [userId, period]);

  return stats;
}
