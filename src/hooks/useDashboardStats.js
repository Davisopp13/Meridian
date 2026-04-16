import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getNewYorkDayRange } from '../lib/timezone.js';

function getDateRange(period) {
  const now = new Date();
  const { start: todayStart, dateKey } = getNewYorkDayRange(now);
  const [year, month, day] = dateKey.split('-').map(Number);

  // Return NY midnight for any (y, m, d) — handles month/year overflow naturally
  // via JS Date UTC arithmetic (e.g. month=0 wraps to previous December).
  function nyMidnightOf(y, m, d) {
    // A UTC noon probe always lands on the same NY calendar day as (y, m, d)
    // because NY is at most UTC-4, so noon UTC is never past midnight in NY.
    const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return getNewYorkDayRange(probe).start;
  }

  // Day-of-week for NY today: todayStart is NY midnight expressed in UTC,
  // so getUTCDay() correctly returns the NY weekday (NY is never UTC+anything).
  const dow = todayStart.getUTCDay(); // 0 = Sunday
  const daysToMonday = dow === 0 ? 6 : dow - 1;

  if (period === 'this_week') {
    return { from: nyMidnightOf(year, month, day - daysToMonday), to: now };
  }
  if (period === 'last_week') {
    return {
      from: nyMidnightOf(year, month, day - daysToMonday - 7),
      to:   nyMidnightOf(year, month, day - daysToMonday),
    };
  }
  if (period === 'this_month') {
    return { from: nyMidnightOf(year, month, 1), to: now };
  }
  if (period === 'last_month') {
    const lm = month === 1 ? 12 : month - 1;
    const ly = month === 1 ? year - 1 : year;
    return {
      from: nyMidnightOf(ly, lm, 1),
      to:   nyMidnightOf(year, month, 1),
    };
  }
  if (period === 'ytd') {
    return { from: nyMidnightOf(year, 1, 1), to: now };
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
