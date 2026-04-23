import { useState, useEffect, useCallback, useRef } from 'react';
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

const TYPE_DB = {
  Resolved: 'resolved',
  Reclassified: 'reclassified',
  Call: 'call',
  'Not a Case': 'not_a_case',
  RFC: 'rfc',
};

function normalizeCaseEvent(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    type: TYPE_LABEL[row.type] || row.type,
    rawType: row.type,
    src: 'case',
    session_id: row.session_id || null,
    case_number: row.ct_cases?.case_number || null,
    case_id: row.ct_cases?.id || null,
    sf_case_id: row.sf_case_id || row.ct_cases?.sf_case_id || null,
    category: '',
    dur: row.ct_cases?.duration_s || 0,
    rfc: row.rfc || false,
    note: row.note ?? null,
    ts: new Date(row.timestamp || row.created_at),
  };
}

function normalizeMplEntry(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    type: 'Process',
    rawType: 'process',
    src: 'process',
    session_id: null,
    case_number: null,
    case_id: null,
    category: row.mpl_categories?.name || '',
    category_id: row.category_id || null,
    subcategory_id: row.subcategory_id || null,
    dur: (row.minutes || 0) * 60,
    minutes: row.minutes || 0,
    rfc: false,
    note: row.note ?? null,
    ts: new Date(row.created_at),
  };
}

export function useActivityData({ userId, userIds, rangeDays }) {
  // Normalize: prefer userIds array; fall back to wrapping userId string
  const resolvedIds = (userIds && userIds.length > 0)
    ? userIds
    : (userId ? [userId] : []);

  const userIdsKey = resolvedIds.join(',');

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const cutoff = getCutoff(rangeDays);

    // Two independent queries — case_events and mpl_entries in parallel
    const [caseResult, mplResult] = await Promise.all([
      supabase
        .from('case_events')
        .select('id, user_id, type, rfc, timestamp, session_id, sf_case_id, note')
        .in('user_id', resolvedIds)
        .gte('timestamp', cutoff.toISOString()),
      supabase
        .from('mpl_entries')
        .select('id, user_id, minutes, created_at, category_id, subcategory_id, mpl_categories(name), note')
        .in('user_id', resolvedIds)
        .gte('created_at', cutoff.toISOString()),
    ]);

    if (cancelledRef.current) return;

    if (caseResult.error || mplResult.error) {
      setError(caseResult.error || mplResult.error);
      setLoading(false);
      return;
    }

    // Batch-fetch ct_cases by id and merge in JS.
    // case_events.session_id is a FK to ct_cases.id (historically misnamed
    // but structurally a case_id). The widget client-generates a UUID, writes
    // it as ct_cases.id on the parent insert, then as case_events.session_id
    // on the child insert — so both sides match.
    const parentIds = (caseResult.data || []).map(r => r.session_id).filter(Boolean);
    const casesById = {};
    if (parentIds.length > 0) {
      const { data: casesData } = await supabase
        .from('ct_cases')
        .select('id, case_number, duration_s, sf_case_id')
        .in('id', parentIds);
      if (casesData) {
        for (const c of casesData) {
          if (c.id) casesById[c.id] = c;
        }
      }
    }

    const enrichedCaseRows = (caseResult.data || []).map(row => ({
      ...row,
      ct_cases: row.session_id ? (casesById[row.session_id] || null) : null,
    }));

    const caseEntries = enrichedCaseRows.map(normalizeCaseEvent);
    const mplEntries  = (mplResult.data  || []).map(normalizeMplEntry);

    const merged = [...caseEntries, ...mplEntries].sort((a, b) => b.ts - a.ts);

    setEntries(merged);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdsKey, rangeDays]);

  const editEntry = useCallback(async (entry, updates) => {
    const entryUserId = entry.user_id;
    if (!entryUserId) return false;

    if (entry.src === 'case') {
      const eventPayload = {};
      if (updates.type !== undefined) eventPayload.type = TYPE_DB[updates.type] || updates.type;
      if (updates.rfc !== undefined) eventPayload.rfc = updates.rfc;
      if (updates.note !== undefined) eventPayload.note = updates.note;

      if (Object.keys(eventPayload).length > 0) {
        const { error } = await supabase
          .from('case_events')
          .update(eventPayload)
          .eq('id', entry.id)
          .eq('user_id', entryUserId);
        if (error) { console.error('[Meridian] edit case_events failed', error); return false; }
      }

      if (entry.case_id && (updates.case_number !== undefined || updates.dur !== undefined)) {
        const casePayload = {};
        if (updates.case_number !== undefined) casePayload.case_number = updates.case_number;
        if (updates.dur !== undefined) casePayload.duration_s = updates.dur;

        const { error } = await supabase
          .from('ct_cases')
          .update(casePayload)
          .eq('id', entry.case_id);
        if (error) { console.error('[Meridian] edit ct_cases failed', error); return false; }
      }
    } else if (entry.src === 'process') {
      const payload = {};
      if (updates.category_id !== undefined) payload.category_id = updates.category_id;
      if (updates.subcategory_id !== undefined) payload.subcategory_id = updates.subcategory_id;
      if (updates.minutes !== undefined) payload.minutes = updates.minutes;
      if (updates.note !== undefined) payload.note = updates.note;

      const { error } = await supabase
        .from('mpl_entries')
        .update(payload)
        .eq('id', entry.id)
        .eq('user_id', entryUserId);
      if (error) { console.error('[Meridian] edit mpl_entries failed', error); return false; }
    }

    await fetchData();
    return true;
  }, [fetchData]);

  const deleteEntry = useCallback(async (entry) => {
    const entryUserId = entry.user_id;
    if (!entryUserId) return false;

    const table = entry.src === 'case' ? 'case_events' : 'mpl_entries';
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', entry.id)
      .eq('user_id', entryUserId);

    if (error) { console.error(`[Meridian] delete ${table} failed`, error); return false; }
    await fetchData();
    return true;
  }, [fetchData]);

  useEffect(() => {
    if (resolvedIds.length === 0) return;

    cancelledRef.current = false;
    fetchData();

    const channelName = `activity-${resolvedIds.join('-').slice(0, 50)}-${rangeDays}`;
    const filterStr = `user_id=in.(${userIdsKey})`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'case_events', filter: filterStr },
        () => { fetchData(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mpl_entries', filter: filterStr },
        () => { fetchData(); }
      )
      .subscribe();

    return () => {
      cancelledRef.current = true;
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdsKey, rangeDays, fetchData]);

  return { entries, loading, error, refetch: fetchData, editEntry, deleteEntry };
}
