import { getNewYorkDayRange } from './timezone.js';

export function getDateRange(period) {
  const now = new Date();
  const { start: todayMidnight, dateKey } = getNewYorkDayRange(now);
  const [year, month, day] = dateKey.split('-').map(Number);

  function shiftDays(n) {
    const shifted = new Date(todayMidnight.getTime() + n * 86400000);
    return getNewYorkDayRange(shifted).start;
  }

  const dow = todayMidnight.getUTCDay(); // 0=Sun
  const daysToMonday = dow === 0 ? 6 : dow - 1;

  if (period === 'this_week') {
    return { from: shiftDays(-daysToMonday), to: now };
  }
  if (period === 'last_week') {
    return { from: shiftDays(-daysToMonday - 7), to: shiftDays(-daysToMonday) };
  }
  if (period === 'this_month') {
    return { from: shiftDays(-(day - 1)), to: now };
  }
  if (period === 'last_month') {
    const firstOfThisMonth = shiftDays(-(day - 1));
    const lastMonthProbe = new Date(firstOfThisMonth.getTime() - 86400000);
    const lastMonthRange = getNewYorkDayRange(lastMonthProbe);
    const lastMonthDay = Number(lastMonthRange.dateKey.split('-')[2]);
    const firstOfLastMonth = new Date(lastMonthRange.start.getTime() - (lastMonthDay - 1) * 86400000);
    return { from: getNewYorkDayRange(firstOfLastMonth).start, to: firstOfThisMonth };
  }
  if (period === 'ytd') {
    const janProbe = new Date(Date.UTC(year, 0, 1, 16, 0, 0));
    return { from: getNewYorkDayRange(janProbe).start, to: now };
  }
}

export function getNYDateStr(isoTimestamp) {
  return new Date(isoTimestamp).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
  }); // "MM/DD"
}

/**
 * Pure aggregation over case_events + mpl_entries rows.
 * When rows include user_id, also produces a byUser map keyed by user_id.
 */
export function aggregateStats(events, procs) {
  const resolved  = events.filter(e => e.type === 'resolved'     && !e.excluded).length;
  const reclass   = events.filter(e => e.type === 'reclassified' && !e.excluded).length;
  const calls     = events.filter(e => e.type === 'call'         && !e.excluded).length;
  const notACase  = events.filter(e => e.type === 'not_a_case').length;
  const processes = procs.length;
  const casesAndCalls = resolved + reclass + calls;
  const totalActivity = casesAndCalls + processes;

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
    .sort((a, b) => a.date.localeCompare(b.date));

  // Build per-user breakdown when user_id is present on rows
  const hasUserIds = events.some(e => e.user_id) || procs.some(p => p.user_id);
  let byUser = null;

  if (hasUserIds) {
    byUser = {};

    const ensureUser = (uid) => {
      if (!byUser[uid]) {
        byUser[uid] = { resolved: 0, reclass: 0, calls: 0, notACase: 0, processes: 0, casesAndCalls: 0, totalActivity: 0 };
      }
    };

    for (const e of events) {
      if (!e.user_id) continue;
      ensureUser(e.user_id);
      if (e.type === 'resolved'     && !e.excluded) byUser[e.user_id].resolved++;
      if (e.type === 'reclassified' && !e.excluded) byUser[e.user_id].reclass++;
      if (e.type === 'call'         && !e.excluded) byUser[e.user_id].calls++;
      if (e.type === 'not_a_case')                  byUser[e.user_id].notACase++;
    }

    for (const p of procs) {
      if (!p.user_id) continue;
      ensureUser(p.user_id);
      byUser[p.user_id].processes++;
    }

    for (const uid of Object.keys(byUser)) {
      const u = byUser[uid];
      u.casesAndCalls = u.resolved + u.reclass + u.calls;
      u.totalActivity = u.casesAndCalls + u.processes;
    }
  }

  return { resolved, reclass, calls, notACase, processes, casesAndCalls, totalActivity, dailyRows, byUser };
}
