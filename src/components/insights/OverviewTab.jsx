import TeamCaseVolumePanel from './TeamCaseVolumePanel.jsx';
import AgentHandleTimePanel from './AgentHandleTimePanel.jsx';
import MplByCategoryPanel from './MplByCategoryPanel.jsx';
import TrendComparisonPanel from './TrendComparisonPanel.jsx';
import TeamFilterDropdown from './TeamFilterDropdown.jsx';

function computeTeamTotals(perAgentStats) {
  const totals = { resolved: 0, reclass: 0, calls: 0, notACase: 0, processes: 0, casesAndCalls: 0, totalActivity: 0 };
  for (const { stats } of Object.values(perAgentStats)) {
    totals.resolved += stats.resolved ?? 0;
    totals.reclass += stats.reclass ?? 0;
    totals.calls += stats.calls ?? 0;
    totals.notACase += stats.notACase ?? 0;
    totals.processes += stats.processes ?? 0;
    totals.casesAndCalls += stats.casesAndCalls ?? 0;
    totals.totalActivity += stats.totalActivity ?? 0;
  }
  return totals;
}

export default function OverviewTab({ insights, prevInsights, period, onAgentClick, selectedTeamId, onTeamChange }) {
  const filteredAgents = selectedTeamId
    ? insights.agents.filter(a => a.team_id === selectedTeamId)
    : insights.agents;

  const filteredAgentIds = new Set(filteredAgents.map(a => a.id));

  const filteredPerAgentStats = selectedTeamId
    ? Object.fromEntries(Object.entries(insights.perAgentStats).filter(([id]) => filteredAgentIds.has(id)))
    : insights.perAgentStats;

  const filteredTeamTotals = selectedTeamId
    ? computeTeamTotals(filteredPerAgentStats)
    : insights.teamTotals;

  const filteredPrevPerAgentStats = selectedTeamId && prevInsights
    ? Object.fromEntries(Object.entries(prevInsights.perAgentStats || {}).filter(([id]) => filteredAgentIds.has(id)))
    : (prevInsights ? prevInsights.perAgentStats : null);

  const gridStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 20,
  };

  const panelStyle = {
    flex: '1 1 calc(50% - 10px)',
    minWidth: 280,
    boxSizing: 'border-box',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <TeamFilterDropdown
          teams={insights.teams}
          selectedTeamId={selectedTeamId}
          onChange={onTeamChange}
        />
      </div>
      <div style={gridStyle}>
        <div style={panelStyle}>
          <TeamCaseVolumePanel
            perAgentStats={filteredPerAgentStats}
            teamTotals={filteredTeamTotals}
          />
        </div>
        <div style={panelStyle}>
          <AgentHandleTimePanel
            perAgentStats={filteredPerAgentStats}
            onAgentClick={onAgentClick}
          />
        </div>
        <div style={panelStyle}>
          <MplByCategoryPanel byCategory={insights.byCategory} categoryNames={insights.categoryNames} />
        </div>
        <div style={panelStyle}>
          <TrendComparisonPanel
            period={period}
            perAgentStats={filteredPerAgentStats}
            previousPerAgentStats={filteredPrevPerAgentStats}
          />
        </div>
      </div>
    </div>
  );
}
