import { useState, useEffect } from 'react';
import { fetchSupervisedTeams, fetchTeamAgents, fetchTeamCaseEvents, fetchTeamMplEntries } from '../lib/api.js';
import { aggregateStats, getDateRange } from '../lib/stats.js';

export function useTeamInsights({ supervisorId, period }) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    teams: [],
    agents: [],
    perAgentStats: {},
    teamTotals: null,
    byCategory: {},
    byDayByTeam: [],
  });

  useEffect(() => {
    if (!supervisorId || !period) return;

    let cancelled = false;

    async function fetchInsights() {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const { data: supervisorTeams, error: teamsError } = await fetchSupervisedTeams(supervisorId);
      if (cancelled) return;
      if (teamsError) {
        setState(prev => ({ ...prev, loading: false, error: teamsError }));
        return;
      }

      const teams = (supervisorTeams || []).map(st => st.teams);
      const teamIds = teams.map(t => t.id);

      if (teamIds.length === 0) {
        setState({ loading: false, error: null, teams: [], agents: [], perAgentStats: {}, teamTotals: null, byCategory: {}, byDayByTeam: [] });
        return;
      }

      const { data: agentsData, error: agentsError } = await fetchTeamAgents(teamIds);
      if (cancelled) return;
      if (agentsError) {
        setState(prev => ({ ...prev, loading: false, error: agentsError }));
        return;
      }

      const agents = agentsData || [];
      const userIds = agents.map(a => a.id);

      if (userIds.length === 0) {
        setState({ loading: false, error: null, teams, agents: [], perAgentStats: {}, teamTotals: null, byCategory: {}, byDayByTeam: [] });
        return;
      }

      const range = getDateRange(period);
      if (!range) return;

      const [eventsResult, procsResult] = await Promise.all([
        fetchTeamCaseEvents({ userIds, from: range.from.toISOString(), to: range.to.toISOString() }),
        fetchTeamMplEntries({ userIds, from: range.from.toISOString(), to: range.to.toISOString() }),
      ]);
      if (cancelled) return;

      if (eventsResult.error || procsResult.error) {
        setState(prev => ({ ...prev, loading: false, error: eventsResult.error || procsResult.error }));
        return;
      }

      const allEvents = eventsResult.data || [];
      const allProcs = procsResult.data || [];

      const { resolved, reclass, calls, notACase, processes, casesAndCalls, totalActivity, dailyRows } =
        aggregateStats(allEvents, allProcs);

      const teamTotals = { resolved, reclass, calls, notACase, processes, casesAndCalls, totalActivity };
      const byDayByTeam = dailyRows;

      const perAgentStats = {};
      for (const agent of agents) {
        const agentEvents = allEvents.filter(e => e.user_id === agent.id);
        const agentProcs = allProcs.filter(p => p.user_id === agent.id);
        const s = aggregateStats(agentEvents, agentProcs);
        perAgentStats[agent.id] = {
          resolved: s.resolved,
          reclass: s.reclass,
          calls: s.calls,
          notACase: s.notACase,
          processes: s.processes,
          casesAndCalls: s.casesAndCalls,
          totalActivity: s.totalActivity,
        };
      }

      // byCategory: { [categoryId]: totalMinutes }
      const byCategory = {};
      for (const p of allProcs) {
        if (!p.category_id) continue;
        byCategory[p.category_id] = (byCategory[p.category_id] || 0) + (p.minutes || 0);
      }

      setState({ loading: false, error: null, teams, agents, perAgentStats, teamTotals, byCategory, byDayByTeam });
    }

    fetchInsights();
    return () => { cancelled = true; };
  }, [supervisorId, period]);

  return state;
}
