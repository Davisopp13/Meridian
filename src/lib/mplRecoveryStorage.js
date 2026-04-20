export const STORAGE_KEY = 'meridian.mpl.active.v1';
export const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function saveSnapshot(userId, processes) {
  try {
    const payload = {
      userId,
      savedAt: Date.now(),
      processes: processes.map(p => ({
        id: p.id,
        elapsed: p.elapsed,
        paused: p.paused,
        categoryId: p.categoryId,
        subcategoryId: p.subcategoryId,
        startedAt: p.startedAt,
      })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[mplRecoveryStorage] saveSnapshot failed:', err);
  }
}

export function loadSnapshot(userId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.userId !== userId) return null;
    if (Date.now() - data.savedAt > STALE_THRESHOLD_MS) return null;
    return data;
  } catch (err) {
    console.warn('[mplRecoveryStorage] loadSnapshot failed:', err);
    return null;
  }
}

export function clearSnapshot() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[mplRecoveryStorage] clearSnapshot failed:', err);
  }
}
