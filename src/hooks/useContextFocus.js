import { useMemo } from 'react';

/**
 * Derives UI focus from active session state.
 * @param {Array}  cases       - active case sessions array
 * @param {Array}  processes   - active process sessions array
 * @param {string} lastTrigger - 'cases' | 'processes' — last bookmarklet trigger type
 * @returns {{ focus: string, laneSplit: { cases: string, processes: string } }}
 */
export function useContextFocus(cases, processes, lastTrigger) {
  const focus = useMemo(() => {
    if (cases.length > 0 && processes.length === 0) return 'cases';
    if (processes.length > 0 && cases.length === 0) return 'processes';
    if (cases.length > 0 && processes.length > 0) return lastTrigger || 'cases';
    return 'neutral';
  }, [cases.length, processes.length, lastTrigger]);

  const laneSplit = useMemo(() => {
    if (focus === 'cases')     return { cases: '60%', processes: '40%' };
    if (focus === 'processes') return { cases: '40%', processes: '60%' };
    return { cases: '50%', processes: '50%' };
  }, [focus]);

  return { focus, laneSplit };
}
