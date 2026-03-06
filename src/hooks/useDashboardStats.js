import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function getDateRange(period) {
  const now = new Date();
  const toNYDate = d => new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const ny = toNYDate(now);

  const startOfDay = d => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const endOfDay   = d => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

  // Monday of current week
  const dayOfWeek = ny.getDay(); // 0=Sun
  const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(ny); thisMonday.setDate(ny.getDate() - diffToMon);

  if (period === 'this_week') {
    return { from: startOfDay(thisMonday), to: now };
  }
  if (period === 'last_week') {
    const lastMon = new Date(thisMonday); lastMon.setDate(thisMonday.getDate() - 7);
    const lastSun = new Date(lastMon); lastSun.setDate(lastMon.getDate() + 6);
    return { from: startOfDay(lastMon), to: endOfDay(lastSun) };
  }
  if (period === 'this_month') {
    const start = new Date(ny.getFullYear(), ny.getMonth(), 1);
    return { from: startOfDay(start), to: now };
  }
  if (period === 'last_month') {
    const start = new Date(ny.getFullYear(), ny.getMonth() - 1, 1);
    const end   = new Date(ny.getFullYear(), ny.getMonth(), 0);
    return { from: startOfDay(start), to: endOfDay(end) };
  }
  if (period === 'ytd') {
    const start = new Date(ny.getFullYear(), 0, 1);
    return { from: startOfDay(start), to: now };
  }
}

function getNYDateStr(isoTimestamp) {
  return new Date(isoTimestamp).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
  }); // "MM/DD"
}

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

      // Totals
      const resolved   = events.filter(e => e.type === 'resolved'      && !e.excluded).length;
      const reclass    = events.filter(e => e.type === 'reclassified'  && !e.excluded).length;
      const calls      = events.filter(e => e.type === 'call'          && !e.excluded).length;
      const notACase   = events.filter(e => e.type === 'not_a_case').length;
      const processes  = procs.length;
      const casesAndCalls  = resolved + reclass + calls;
      const totalActivity  = casesAndCalls + processes;

      // Group by date (MM/DD in NY timezone)
      const dayMap = {};

      for (const e of events) {
        const date = getNYDateStr(e.timestamp);
        if (!dayMap[date]) dayMap[date] = { date, resolved: 0, reclass: 0, calls: 0, notACase: 0, processes: 0 };
        if (e.type === 'resolved'     && !e.excluded) dayMap[date].resolved++;
        if (e.type === 'reclassified' && !e.excluded) dayMap[date].reclass++;
        if (e.type === 'call'         && !e.excluded) dayMap[date].calls++;
        if (e.type === 'not_a_case')                  dayMap[date].notACase++;
      }

      for (const p of procs) {
        const date = getNYDateStr(p.created_at);
        if (!dayMap[date]) dayMap[date] = { date, resolved: 0, reclass: 0, calls: 0, notACase: 0, processes: 0 };
        dayMap[date].processes++;
      }

      const dailyRows = Object.values(dayMap)
        .map(row => ({
          ...row,
          total:         row.resolved + row.reclass + row.calls,
          totalActivity: row.resolved + row.reclass + row.calls + row.processes,
        }))
        .sort((a, b) => {
          // Sort ascending by date string (MM/DD — same year, so this works)
          return a.date.localeCompare(b.date);
        });

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
