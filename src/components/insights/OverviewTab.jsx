import TeamCaseVolumePanel from './TeamCaseVolumePanel.jsx';
import AgentHandleTimePanel from './AgentHandleTimePanel.jsx';
import MplByCategoryPanel from './MplByCategoryPanel.jsx';
import TrendComparisonPanel from './TrendComparisonPanel.jsx';

export default function OverviewTab({ insights, prevInsights, period, onAgentClick, selectedTeamId, onTeamChange }) {
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
    <div style={gridStyle}>
      <div style={panelStyle}>
        <TeamCaseVolumePanel
          perAgentStats={insights.perAgentStats}
          teamTotals={insights.teamTotals}
        />
      </div>
      <div style={panelStyle}>
        <AgentHandleTimePanel perAgentStats={insights.perAgentStats} onAgentClick={onAgentClick} />
      </div>
      <div style={panelStyle}>
        <MplByCategoryPanel byCategory={insights.byCategory} categoryNames={insights.categoryNames} />
      </div>
      <div style={panelStyle}>
        <TrendComparisonPanel
          period={period}
          perAgentStats={insights.perAgentStats}
          previousPerAgentStats={prevInsights ? prevInsights.perAgentStats : null}
        />
      </div>
    </div>
  );
}
