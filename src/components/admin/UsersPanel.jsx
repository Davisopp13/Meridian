import { useState, useMemo, useRef } from 'react';
import { useAdminUsers } from '../../hooks/useAdminUsers';

const ROLE_OPTIONS = ['agent', 'supervisor', 'admin'];

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid var(--border)',
        borderTopColor: 'var(--color-mmark)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function UsersPanel({ user, profile }) {
  const { users, loading, error, refetch, updateRole, updateTeam } = useAdminUsers();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef(null);

  if (profile?.role !== 'admin') {
    return (
      <div style={{ color: 'var(--text-sec)', padding: '32px 20px', textAlign: 'center' }}>
        Not authorized. Admin access only.
      </div>
    );
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 200);
  }

  // Derive all unique teams from users for the dropdown
  const allTeams = useMemo(() => {
    const map = new Map();
    users.forEach(u => {
      if (u.teams && u.teams.id) {
        map.set(u.teams.id, u.teams.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center' }}>
        <p style={{ color: '#E8540A', marginBottom: 12, fontSize: 14 }}>
          Failed to load users: {error.message || 'Unknown error'}
        </p>
        <button
          onClick={refetch}
          style={{
            padding: '8px 20px',
            background: 'var(--color-mbtn)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const containerStyle = { padding: '4px 0' };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
    flexWrap: 'wrap',
  };

  const countStyle = {
    color: 'var(--text-sec)',
    fontSize: 13,
    flexShrink: 0,
  };

  const searchStyle = {
    padding: '7px 12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-pri)',
    fontSize: 13,
    outline: 'none',
    width: 220,
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  };

  const thStyle = {
    textAlign: 'left',
    color: 'var(--text-dim)',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0 10px 10px',
    borderBottom: '1px solid var(--border)',
  };

  const tdStyle = {
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

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={countStyle}>
          {users.length} user{users.length !== 1 ? 's' : ''}
          {search && filtered.length !== users.length ? ` — showing ${filtered.length}` : ''}
        </span>
        <input
          type="text"
          placeholder="Search by name or email…"
          value={searchInput}
          onChange={handleSearchChange}
          style={searchStyle}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
          No users match "{search}"
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Team</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const isSelf = u.id === user?.id;
              const currentTeamId = u.team_id || '';

              return (
                <tr key={u.id}>
                  <td style={tdStyle}>
                    <span style={{ color: 'var(--text-pri)', fontWeight: 500 }}>
                      {u.full_name || <span style={{ color: 'var(--text-dim)' }}>—</span>}
                    </span>
                    {u.onboarding_complete === false && (
                      <span style={badgeStyle}>pending onboarding</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-sec)' }}>{u.email}</td>
                  <td style={tdStyle}>
                    <select
                      value={u.role}
                      disabled={isSelf}
                      title={isSelf ? 'You cannot change your own role.' : undefined}
                      style={{
                        ...selectStyle,
                        opacity: isSelf ? 0.5 : 1,
                        cursor: isSelf ? 'not-allowed' : 'pointer',
                      }}
                      onChange={e => updateRole(u.id, e.target.value)}
                    >
                      {ROLE_OPTIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <select
                      value={currentTeamId}
                      style={selectStyle}
                      onChange={e => updateTeam(u.id, e.target.value || null)}
                    >
                      <option value="">Unassigned</option>
                      {allTeams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
