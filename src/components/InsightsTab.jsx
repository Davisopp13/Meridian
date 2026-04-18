import { useState } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useTeamInsights } from '../hooks/useTeamInsights.js';
import InsightsEmptyState from './insights/InsightsEmptyState.jsx';
import TeamCaseVolumePanel from './insights/TeamCaseVolumePanel.jsx';
import AgentHandleTimePanel from './insights/AgentHandleTimePanel.jsx';
import MplByCategoryPanel from './insights/MplByCategoryPanel.jsx';
import TrendComparisonPanel from './insights/TrendComparisonPanel.jsx';

const PERIODS = [
  { key: 'this_week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'ytd', label: 'Year To Date' },
];

const PREV_PERIOD = {
  this_week: 'last_week',
  last_week: null,
  this_month: 'last_month',
  last_month: null,
  ytd: null,
};

export default function InsightsTab({ user, profile }) {
  const { theme } = useTheme();
  const [period, setPeriod] = useState('this_week');
  const prevPeriod = PREV_PERIOD[period] ?? null;

  const isAuthorized = profile?.role === 'supervisor' || profile?.role === 'director';

  const insights = useTeamInsights({
    supervisorId: isAuthorized ? user?.id : null,
    period,
  });

  const prevInsights = useTeamInsights({
    supervisorId: isAuthorized && prevPeriod ? user?.id : null,
    period: prevPeriod,
  });

  function tabStyle(active) {
    return {
      height: 40,
      padding: '0 20px',
      borderRadius: 20,
      border: 'none',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: active ? 700 : 500,
      background: active ? 'var(--color-mmark)' : (theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'),
      color: active ? '#fff' : (theme === 'light' ? '#475569' : 'rgba(255,255,255,0.55)'),
      transition: 'background 150ms, color 150ms',
    };
  }

  const bodyStyle = {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '32px 24px',
    boxSizing: 'border-box',
    width: '100%',
  };

  const tabsRow = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
      {PERIODS.map(p => (
        <button key={p.key} style={tabStyle(period === p.key)} onClick={() => setPeriod(p.key)}>
          {p.label}
        </button>
      ))}
    </div>
  );

  if (!isAuthorized) {
    return (
      <div style={bodyStyle}>
        <InsightsEmptyState reason="not-supervisor" />
      </div>
    );
  }

  if (insights.loading) {
    return (
      <div style={bodyStyle}>
        {tabsRow}
        <style>{`@keyframes ins-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.12)',
            borderTopColor: 'var(--color-mmark)',
            animation: 'ins-spin 0.8s linear infinite',
          }} />
        </div>
      </div>
    );
  }

  if (insights.error) {
    return (
      <div style={bodyStyle}>
        {tabsRow}
        <div style={{ padding: 20, background: 'var(--dash-card)', border: '1px solid var(--dash-border)', borderRadius: 12, color: '#f87171', fontSize: 13 }}>
          Error loading insights: {insights.error.message || String(insights.error)}
        </div>
      </div>
    );
  }

  if (insights.teams.length === 0) {
    return (
      <div style={bodyStyle}>
        {tabsRow}
        <InsightsEmptyState reason="no-teams" />
      </div>
    );
  }

  if (insights.agents.length === 0 || !insights.teamTotals) {
    return (
      <div style={bodyStyle}>
        {tabsRow}
        <InsightsEmptyState />
      </div>
    );
  }

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
    <div style={bodyStyle}>
      {tabsRow}
      <div style={gridStyle}>
        <div style={panelStyle}>
          <TeamCaseVolumePanel
            perAgentStats={insights.perAgentStats}
            teamTotals={insights.teamTotals}
          />
        </div>
        <div style={panelStyle}>
          <AgentHandleTimePanel perAgentStats={insights.perAgentStats} />
        </div>
        <div style={panelStyle}>
          <MplByCategoryPanel byCategory={insights.byCategory} />
        </div>
        <div style={panelStyle}>
          <TrendComparisonPanel
            period={period}
            perAgentStats={insights.perAgentStats}
            previousPerAgentStats={prevPeriod ? prevInsights.perAgentStats : null}
          />
        </div>
      </div>
    </div>
  );
}
