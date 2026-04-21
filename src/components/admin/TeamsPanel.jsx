import { useAdminTeams } from '../../hooks/useAdminTeams';
import DepartmentCard from './DepartmentCard';
import AddDepartmentForm from './AddDepartmentForm';

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

export default function TeamsPanel({ user, profile }) {
  const {
    departments,
    loading,
    error,
    refetch,
    createDept,
    updateDept,
    deleteDept,
    createTeam,
    updateTeam,
    deleteTeam,
  } = useAdminTeams();

  if (profile?.role !== 'admin') {
    return (
      <div style={{ color: 'var(--text-sec)', padding: '32px 20px', textAlign: 'center' }}>
        Not authorized. Admin access only.
      </div>
    );
  }

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center' }}>
        <p style={{ color: '#E8540A', marginBottom: 12, fontSize: 14 }}>
          Failed to load teams: {error.message || 'Unknown error'}
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

  return (
    <div style={{ padding: '4px 0' }}>
      {departments.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>
          No departments yet. Add one below to get started.
        </p>
      ) : (
        departments.map(dept => (
          <DepartmentCard
            key={dept.id}
            dept={dept}
            onUpdateDept={updateDept}
            onDeleteDept={deleteDept}
            onCreateTeam={createTeam}
            onUpdateTeam={updateTeam}
            onDeleteTeam={deleteTeam}
          />
        ))
      )}
      <AddDepartmentForm onCreate={createDept} />
    </div>
  );
}
