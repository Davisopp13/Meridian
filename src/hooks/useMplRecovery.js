import { useRef, useEffect } from 'react';
import { upsertMplActiveTimer, clearMplActiveTimer } from '../lib/api.js';

const SYNC_INTERVAL_MS = 10000;

export default function useMplRecovery(userId, processes) {
  const processesRef = useRef(processes);
  const syncedIdsRef = useRef(new Set());
  const intervalRef = useRef(null);

  processesRef.current = processes;

  async function syncAll() {
    const procs = processesRef.current;
    if (!userId || !procs) return;

    const currentIds = new Set(procs.map(p => p.id));

    // Delete removed processes from Supabase
    for (const id of syncedIdsRef.current) {
      if (!currentIds.has(id)) {
        syncedIdsRef.current.delete(id);
        clearMplActiveTimer(id).catch(err =>
          console.warn('[useMplRecovery] clearMplActiveTimer failed:', err)
        );
      }
    }

    // Upsert all current processes
    for (const p of procs) {
      syncedIdsRef.current.add(p.id);
      upsertMplActiveTimer({
        userId,
        processId: p.id,
        categoryId: p.categoryId ?? null,
        subcategoryId: p.subcategoryId ?? null,
        startedAt: p.startedAt ?? new Date().toISOString(),
        accumulatedSeconds: p.elapsed ?? 0,
        status: p.paused ? 'paused' : 'running',
      }).catch(err =>
        console.warn('[useMplRecovery] upsertMplActiveTimer failed:', err)
      );
    }
  }

  useEffect(() => {
    if (!userId) return;

    intervalRef.current = setInterval(syncAll, SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [userId]);

  // When processes array changes, detect removals and delete them immediately
  useEffect(() => {
    if (!userId) return;

    const currentIds = new Set((processes || []).map(p => p.id));
    for (const id of syncedIdsRef.current) {
      if (!currentIds.has(id)) {
        syncedIdsRef.current.delete(id);
        clearMplActiveTimer(id).catch(err =>
          console.warn('[useMplRecovery] clearMplActiveTimer failed:', err)
        );
      }
    }
  }, [userId, processes]);

  return { syncNow: syncAll };
}
