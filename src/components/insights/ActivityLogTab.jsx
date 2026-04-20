import AgentFilterStrip from './AgentFilterStrip.jsx';
import ActivityLog from '../ActivityLog.jsx';

export default function ActivityLogTab({ agents, selectedAgentId, onAgentChange }) {
  if (!agents || agents.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-sec)', fontSize: 14 }}>
        No agents on your teams yet. Add team members via Admin.
      </div>
    );
  }

  const userIdsForLog = selectedAgentId
    ? [selectedAgentId]
    : agents.map(a => a.id);

  return (
    <div>
      <AgentFilterStrip
        agents={agents}
        selectedAgentId={selectedAgentId}
        onChange={onAgentChange}
      />
      <ActivityLog userIds={userIdsForLog} allowMutations={false} />
    </div>
  );
}
