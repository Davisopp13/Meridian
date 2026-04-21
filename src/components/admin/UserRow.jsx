import { useState, useRef } from 'react';

const ROLE_OPTIONS = ['agent', 'supervisor', 'admin'];

const tdBase = {
  padding: '10px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-pri)',
  verticalAlign: 'middle',
};

const selectStyle = {
  padding: '4px 8px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-pri)',
  fontSize: 12,
  cursor: 'pointer',
};

const badgeStyle = {
  display: 'inline-block',
  padding: '2px 8px',
  background: 'rgba(232,84,10,0.15)',
  color: '#E8540A',
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 600,
  marginLeft: 6,
};

const nameInputStyle = {
  padding: '3px 7px',
  background: 'var(--bg-card)',
  border: '1px solid var(--color-mmark)',
  borderRadius: 4,
  color: 'var(--text-pri)',
  fontSize: 13,
  outline: 'none',
  width: 160,
};

export default function UserRow({ user, teams, isSelf, onUpdateRole, onUpdateTeam, onUpdateName }) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user.full_name || '');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  function showToast(msg) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function friendlyErr(err) {
    if (!err) return 'Unknown error.';
    if (err.message?.includes('row-level security')) return 'RLS rejected.';
    return err.message || 'Unknown error.';
  }

  async function handleRoleChange(e) {
    const newRole = e.target.value;
    const oldRole = user.role;
    if (newRole === 'admin' || oldRole === 'admin') {
      const name = user.full_name || user.email;
      const msg = newRole === 'admin'
        ? `Promote ${name} to admin? They will be able to edit all users, teams, and categories.`
        : `Remove admin from ${name}? They will lose access to the Admin panel.`;
      if (!window.confirm(msg)) return;
    }
    const err = await onUpdateRole(user.id, newRole);
    if (err) showToast(`Failed to update role — ${friendlyErr(err)}`);
  }

  async function handleTeamChange(e) {
    const teamId = e.target.value || null;
    const err = await onUpdateTeam(user.id, teamId);
    if (err) showToast(`Failed to update team — ${friendlyErr(err)}`);
  }

  function handleNameClick() {
    setNameInput(user.full_name || '');
    setEditingName(true);
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') commitName();
    if (e.key === 'Escape') {
      setEditingName(false);
      setNameInput(user.full_name || '');
    }
  }

  async function commitName() {
    const trimmed = nameInput.trim();
    setEditingName(false);
    if (trimmed === (user.full_name || '').trim()) return;
    const err = await onUpdateName(user.id, trimmed);
    if (err) showToast(`Failed to update name — ${friendlyErr(err)}`);
  }

  const currentTeamId = user.team_id || '';

  return (
    <>
      {toast && (
        <tr>
          <td
            colSpan={4}
            style={{
              padding: '4px 10px',
              background: 'rgba(200,40,40,0.15)',
              color: '#ff6b6b',
              fontSize: 12,
              borderBottom: '1px solid var(--border)',
            }}
          >
            {toast}
          </td>
        </tr>
      )}
      <tr>
        <td style={tdBase}>
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
              title="Click to edit name"
              style={{ fontWeight: 500, cursor: 'text', borderBottom: '1px dashed var(--border)' }}
            >
              {user.full_name || <span style={{ color: 'var(--text-dim)' }}>—</span>}
            </span>
          )}
          {user.onboarding_complete === false && (
            <span style={badgeStyle}>pending onboarding</span>
          )}
        </td>
        <td style={{ ...tdBase, color: 'var(--text-sec)' }}>{user.email}</td>
        <td style={tdBase}>
          <select
            value={user.role}
            disabled={isSelf}
            title={isSelf ? 'You cannot change your own role.' : undefined}
            style={{
              ...selectStyle,
              opacity: isSelf ? 0.5 : 1,
              cursor: isSelf ? 'not-allowed' : 'pointer',
            }}
            onChange={handleRoleChange}
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </td>
        <td style={tdBase}>
          <select
            value={currentTeamId}
            style={selectStyle}
            onChange={handleTeamChange}
          >
            <option value="">Unassigned</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </td>
      </tr>
    </>
  );
}
