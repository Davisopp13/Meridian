import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useStats() {
  const [stats, setStats] = useState({ resolved: 0, reclass: 0, calls: 0, processes: 0 });

  const fetchStats = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const todayStr = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }); // "MM/DD/YYYY"
    const [month, day, year] = todayStr.split('/');
    const todayISO = `${year}-${month}-${day}`;
    const tomorrowISO = new Date(new Date(todayISO).getTime() + 86400000)
      .toISOString().split('T')[0];

    const [eventsResult, processesResult] = await Promise.all([
      supabase
        .from('case_events')
        .select('type, excluded')
        .eq('user_id', user.id)
        .gte('timestamp', `${todayISO}T00:00:00-05:00`)
        .lt('timestamp',  `${tomorrowISO}T00:00:00-05:00`),
      supabase
        .from('process_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('logged_at', `${todayISO}T00:00:00-05:00`)
        .lt('logged_at',  `${tomorrowISO}T00:00:00-05:00`),
    ]);

    const events = eventsResult.data || [];
    setStats({
      resolved:  events.filter(e => e.type === 'resolved'     && !e.excluded).length,
      reclass:   events.filter(e => e.type === 'reclassified' && !e.excluded).length,
      calls:     events.filter(e => e.type === 'call'         && !e.excluded).length,
      processes: processesResult.count || 0,
    });
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { ...stats, refetch: fetchStats };
}
