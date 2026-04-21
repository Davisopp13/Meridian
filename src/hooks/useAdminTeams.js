import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllDepartmentsWithTeams,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createTeam,
  updateTeam,
  deleteTeam,
} from '../lib/api';

export function useAdminTeams() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAllDepartmentsWithTeams().then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) {
        setError(err);
      } else {
        setDepartments(data || []);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [tick]);

  const createDept = useCallback(async ({ name }) => {
    const { error: err } = await createDepartment({ name });
    if (!err) refetch();
    return err || null;
  }, [refetch]);

  const updateDept = useCallback(async ({ id, name }) => {
    const { error: err } = await updateDepartment({ id, name });
    if (!err) refetch();
    return err || null;
  }, [refetch]);

  const deleteDept = useCallback(async ({ id }) => {
    const { error: err } = await deleteDepartment({ id });
    if (!err) refetch();
    return err || null;
  }, [refetch]);

  const createTeamFn = useCallback(async ({ name, departmentId, haulageType }) => {
    const { error: err } = await createTeam({ name, departmentId, haulageType });
    if (!err) refetch();
    return err || null;
  }, [refetch]);

  const updateTeamFn = useCallback(async ({ id, name, active }) => {
    const { error: err } = await updateTeam({ id, name, active });
    if (!err) refetch();
    return err || null;
  }, [refetch]);

  const deleteTeamFn = useCallback(async ({ id }) => {
    const { error: err } = await deleteTeam({ id });
    if (!err) refetch();
    return err || null;
  }, [refetch]);

  return {
    departments,
    loading,
    error,
    refetch,
    createDept,
    updateDept,
    deleteDept,
    createTeam: createTeamFn,
    updateTeam: updateTeamFn,
    deleteTeam: deleteTeamFn,
  };
}
