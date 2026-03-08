import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getNewYorkDayRange } from '../lib/timezone.js';

export function useStats() {
  const [stats, setStats] = useState({ resolved: 0, reclass: 0, calls: 0, processes: 0 });

  const fetchStats = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStats({ resolved: 0, reclass: 0, calls: 0, processes: 0 });
      return;
    }

    const { start, end } = getNewYorkDayRange();
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const [resolvedResult, reclassResult, callsResult, processesResult] = await Promise.all([
      supabase
        .from('case_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'resolved')
        .eq('excluded', false)
        .gte('timestamp', startIso)
        .lt('timestamp', endIso),
      supabase
        .from('case_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'reclassified')
        .eq('excluded', false)
        .gte('timestamp', startIso)
        .lt('timestamp', endIso),
      supabase
        .from('case_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'call')
        .eq('excluded', false)
        .gte('timestamp', startIso)
        .lt('timestamp', endIso),
      supabase
        .from('mpl_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startIso)
        .lt('created_at', endIso),
    ]);

    setStats({
      resolved: resolvedResult.count || 0,
      reclass: reclassResult.count || 0,
      calls: callsResult.count || 0,
      processes: processesResult.count || 0,
    });
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { ...stats, refetch: fetchStats };
}
