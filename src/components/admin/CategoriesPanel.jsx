import { useAdminCategories } from '../../hooks/useAdminCategories';
import CategoryGroup from './CategoryGroup';
import AddCategoryForm from './AddCategoryForm';

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

const sectionHeadStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text-sec)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: 14,
  paddingBottom: 8,
  borderBottom: '1px solid var(--border)',
};

export default function CategoriesPanel({ user, profile }) {
  const {
    categories,
    loading,
    error,
    refetch,
    createCat,
    updateCat,
    deleteCat,
    createSub,
    updateSub,
    deleteSub,
  } = useAdminCategories();

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
          Failed to load categories: {error.message || 'Unknown error'}
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

  const sharedCatProps = { onUpdateCat: updateCat, onDeleteCat: deleteCat, onCreateSub: createSub, onUpdateSub: updateSub, onDeleteSub: deleteSub };

  return (
    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', padding: '4px 0' }}>
      {/* Merchant Haulage */}
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={sectionHeadStyle}>Merchant Haulage (MH)</div>
        {categories.mh.length === 0 && (
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>
            No MH categories yet. Add one below.
          </p>
        )}
        {categories.mh.map(cat => (
          <CategoryGroup key={cat.id} category={cat} {...sharedCatProps} />
        ))}
        <AddCategoryForm team="MH" onCreated={createCat} />
      </div>

      {/* Carrier Haulage */}
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={sectionHeadStyle}>Carrier Haulage (CH)</div>
        {categories.ch.length === 0 && (
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>
            No CH categories yet. Add one below.
          </p>
        )}
        {categories.ch.map(cat => (
          <CategoryGroup key={cat.id} category={cat} {...sharedCatProps} />
        ))}
        <AddCategoryForm team="CH" onCreated={createCat} />
      </div>
    </div>
  );
}
