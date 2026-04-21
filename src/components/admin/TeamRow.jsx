import { useState, useRef } from 'react';

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 16px',
  borderBottom: '1px solid var(--border)',
};

const nameTextStyle = {
  fontWeight: 500,
  fontSize: 13,
  color: 'var(--text-pri)',
  cursor: 'text',
  borderBottom: '1px dashed var(--border)',
  flexShrink: 0,
};

const nameInputStyle = {
  padding: '3px 7px',
  background: 'var(--bg-card)',
  border: '1px solid var(--color-mmark)',
  borderRadius: 4,
  color: 'var(--text-pri)',
  fontSize: 13,
  outline: 'none',
  width: 180,
};

const haulageStyle = {
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 7px',
  borderRadius: 10,
  flexShrink: 0,
};

const deleteBtnStyle = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 12,
  padding: '3px 10px',
  lineHeight: 1.4,
  marginLeft: 'auto',
  flexShrink: 0,
};

const toggleLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 12,
  color: 'var(--text-dim)',
  cursor: 'pointer',
  flexShrink: 0,
};

const errorStyle = {
  padding: '4px 16px',
  background: 'rgba(200,40,40,0.1)',
  color: '#ff6b6b',
  fontSize: 12,
  borderBottom: '1px solid var(--border)',
};

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export default function TeamRow({ team, onUpdateTeam, onDeleteTeam }) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(team.name || '');
  const [deleteError, setDeleteError] = useState(null);
  const deleteErrorTimer = useRef(null);

  function showDeleteError(msg) {
    setDeleteError(msg);
    if (deleteErrorTimer.current) clearTimeout(deleteErrorTimer.current);
    deleteErrorTimer.current = setTimeout(() => setDeleteError(null), 5000);
  }

  function handleNameClick() {
    setNameInput(team.name || '');
    setEditingName(true);
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') commitName();
    if (e.key === 'Escape') {
      setEditingName(false);
      setNameInput(team.name || '');
    }
  }

  async function commitName() {
    const trimmed = nameInput.trim();
    setEditingName(false);
    if (!trimmed || trimmed === (team.name || '').trim()) return;
    await onUpdateTeam({ id: team.id, name: trimmed });
  }

  async function handleActiveToggle(e) {
    await onUpdateTeam({ id: team.id, active: e.target.checked });
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete team '${team.name}'? Any users currently on this team will become unassigned.`
    );
    if (!confirmed) return;
    const err = await onDeleteTeam({ id: team.id });
    if (err) {
      const msg = err.message?.includes('row-level security')
        ? 'You do not have permission.'
        : err.message || 'Delete failed.';
      showDeleteError(msg);
    }
  }

  const haulageColor = team.haulage_type === 'CH'
    ? { background: 'rgba(217,119,6,0.15)', color: '#d97706' }
    : { background: 'rgba(96,165,250,0.15)', color: '#60a5fa' };

  return (
    <div>
      <div style={{ ...rowStyle, opacity: team.active === false ? 0.6 : 1 }}>
        {editingName ? (
          <input
            autoFocus
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={handleNameKeyDown}
            onBlur={commitName}
            style={nameInputStyle}
          />
        ) : (
          <span
            onClick={handleNameClick}
            title="Click to rename team"
            style={nameTextStyle}
          >
            {team.name}
          </span>
        )}

        <span style={{ ...haulageStyle, ...haulageColor }}>
          {team.haulage_type || '—'}
        </span>

        <label style={toggleLabelStyle} title={team.active === false ? 'Team is inactive' : 'Team is active'}>
          <input
            type="checkbox"
            checked={team.active !== false}
            onChange={handleActiveToggle}
            style={{ cursor: 'pointer' }}
          />
          {team.active === false ? 'Inactive' : 'Active'}
        </label>

        <button onClick={handleDelete} style={deleteBtnStyle} title="Delete team">
          <TrashIcon />
        </button>
      </div>

      {deleteError && (
        <div style={errorStyle}>{deleteError}</div>
      )}
    </div>
  );
}
