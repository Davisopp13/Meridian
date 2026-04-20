export default function TeamFilterDropdown({ teams, selectedTeamId, onChange }) {
  const selectStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 13,
    padding: '7px 12px',
    cursor: 'pointer',
    outline: 'none',
  };

  function handleChange(e) {
    const val = e.target.value;
    onChange(val === '' ? null : val);
  }

  return (
    <select
      style={selectStyle}
      value={selectedTeamId ?? ''}
      onChange={handleChange}
    >
      <option value="">All teams</option>
      {(teams || []).map(team => (
        <option key={team.id} value={team.id}>{team.name}</option>
      ))}
    </select>
  );
}
