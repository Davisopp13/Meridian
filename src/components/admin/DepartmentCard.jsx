import { useState, useRef } from 'react';
import TeamRow from './TeamRow';
import AddTeamForm from './AddTeamForm';

const cardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  marginBottom: 20,
  overflow: 'hidden',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--card-bg-subtle)',
};

const nameTextStyle = {
  fontWeight: 600,
  fontSize: 14,
  color: 'var(--text-pri)',
  cursor: 'text',
  borderBottom: '1px dashed var(--border)',
};

const nameInputStyle = {
  padding: '3px 7px',
  background: 'var(--bg-card)',
  border: '1px solid var(--color-mmark)',
  borderRadius: 4,
  color: 'var(--text-pri)',
  fontSize: 14,
  fontWeight: 600,
  outline: 'none',
  width: 200,
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
};

const errorStyle = {
  padding: '6px 16px',
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

export default function DepartmentCard({ dept, onUpdateDept, onDeleteDept, onCreateTeam, onUpdateTeam, onDeleteTeam }) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(dept.name || '');
  const [deleteError, setDeleteError] = useState(null);
  const deleteErrorTimer = useRef(null);

  function showDeleteError(msg) {
    setDeleteError(msg);
    if (deleteErrorTimer.current) clearTimeout(deleteErrorTimer.current);
    deleteErrorTimer.current = setTimeout(() => setDeleteError(null), 5000);
  }

  function handleNameClick() {
    setNameInput(dept.name || '');
    setEditingName(true);
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') commitName();
    if (e.key === 'Escape') {
      setEditingName(false);
      setNameInput(dept.name || '');
    }
  }

  async function commitName() {
    const trimmed = nameInput.trim();
    setEditingName(false);
    if (!trimmed || trimmed === (dept.name || '').trim()) return;
    await onUpdateDept({ id: dept.id, name: trimmed });
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete department '${dept.name}'? This will only succeed if no teams reference it.`
    );
    if (!confirmed) return;
    const err = await onDeleteDept({ id: dept.id });
    if (err) {
      const msg = err.message?.includes('foreign key') || err.message?.includes('violates')
        ? `Cannot delete '${dept.name}' — remove all teams from it first.`
        : err.message || 'Delete failed.';
      showDeleteError(msg);
    }
  }

  const teams = dept.teams || [];

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div>
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
              title="Click to rename department"
              style={nameTextStyle}
            >
              {dept.name}
            </span>
          )}
          <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-dim)' }}>
            {teams.length} team{teams.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={handleDelete} style={deleteBtnStyle} title="Delete department">
          <TrashIcon />
        </button>
      </div>

      {deleteError && (
        <div style={errorStyle}>{deleteError}</div>
      )}

      <div>
        {teams.length === 0 ? (
          <div style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: 13 }}>
            No teams yet. Add one below.
          </div>
        ) : (
          teams.map(team => (
            <TeamRow
              key={team.id}
              team={team}
              onUpdateTeam={onUpdateTeam}
              onDeleteTeam={onDeleteTeam}
            />
          ))
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px' }}>
        <AddTeamForm
          departmentId={dept.id}
          onCreated={onCreateTeam}
        />
      </div>
    </div>
  );
}
