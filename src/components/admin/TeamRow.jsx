export default function TeamRow({ team, onUpdateTeam, onDeleteTeam }) {
  return (
    <div style={{ color: 'var(--text-sec)', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      {team.name} — Coming in Task 15
    </div>
  );
}
