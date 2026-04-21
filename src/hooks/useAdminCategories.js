import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllCategoriesForAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} from '../lib/api';

function groupByTeam(rows) {
  const mh = [];
  const ch = [];
  for (const row of rows) {
    if (row.team === 'MH') mh.push(row);
    else ch.push(row);
  }
  return { mh, ch };
}

export function useAdminCategories() {
  const [categories, setCategories] = useState({ mh: [], ch: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAllCategoriesForAdmin().then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) {
        setError(err);
      } else {
        setCategories(groupByTeam(data || []));
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [tick]);

  const createCat = useCallback(async ({ name, team, displayOrder }) => {
    const { error: err } = await createCategory({ name, team, displayOrder });
    if (!err) refetch();
    return err || null;
  }, [refetch]);

  const updateCat = useCallback(async ({ id, name, isActive, displayOrder }) => {
    const { error: err } = await updateCategory({ id, name, isActive, displayOrder });
    if (!err) refetch();
    return err || null;
  }, [refetch]);

  const deleteCat = useCallback(async ({ id }) => {
    const { error: err } = await deleteCategory({ id });
    if (!err) refetch();
    return err || null;
  }, [refetch]);

  const createSub = useCallback(async ({ name, categoryId, displayOrder }) => {
    const { error: err } = await createSubcategory({ name, categoryId, displayOrder });
    if (!err) refetch();
    return err || null;
  }, [refetch]);

  const updateSub = useCallback(async ({ id, name, isActive, displayOrder }) => {
    const { error: err } = await updateSubcategory({ id, name, isActive, displayOrder });
    if (!err) refetch();
    return err || null;
  }, [refetch]);

  const deleteSub = useCallback(async ({ id }) => {
    const { error: err } = await deleteSubcategory({ id });
    if (!err) refetch();
    return err || null;
  }, [refetch]);

  return {
    categories,
    loading,
    error,
    refetch,
    createCat,
    updateCat,
    deleteCat,
    createSub,
    updateSub,
    deleteSub,
  };
}
