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

    // Auto-refresh whenever case_events or mpl_entries change in Supabase
    const channel = supabase
      .channel('useStats-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'case_events' }, fetchStats)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mpl_entries' }, fetchStats)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchStats]);

  return { ...stats, refetch: fetchStats };
}
