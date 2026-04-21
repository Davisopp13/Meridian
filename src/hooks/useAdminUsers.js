import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllPlatformUsers,
  updatePlatformUserRole,
  updatePlatformUserTeam,
  updatePlatformUserName,
} from '../lib/api';

export function useAdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAllPlatformUsers().then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) {
        setError(err);
        setLoading(false);
      } else {
        setUsers(data || []);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [tick]);

  const updateRole = useCallback(async (userId, role) => {
    const prev = users.find(u => u.id === userId);
    // Optimistic update
    setUsers(us => us.map(u => u.id === userId ? { ...u, role } : u));
    const { error: err } = await updatePlatformUserRole({ userId, role });
    if (err) {
      // Revert on failure
      if (prev) setUsers(us => us.map(u => u.id === userId ? prev : u));
      return err;
    }
    return null;
  }, [users]);

  const updateTeam = useCallback(async (userId, teamId) => {
    const prev = users.find(u => u.id === userId);
    setUsers(us => us.map(u => u.id === userId ? { ...u, team_id: teamId } : u));
    const { error: err } = await updatePlatformUserTeam({ userId, teamId });
    if (err) {
      if (prev) setUsers(us => us.map(u => u.id === userId ? prev : u));
      return err;
    }
    return null;
  }, [users]);

  const updateName = useCallback(async (userId, fullName) => {
    const prev = users.find(u => u.id === userId);
    setUsers(us => us.map(u => u.id === userId ? { ...u, full_name: fullName } : u));
    const { error: err } = await updatePlatformUserName({ userId, fullName });
    if (err) {
      if (prev) setUsers(us => us.map(u => u.id === userId ? prev : u));
      return err;
    }
    return null;
  }, [users]);

  return { users, loading, error, refetch, updateRole, updateTeam, updateName };
}
