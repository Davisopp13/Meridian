import { useState, useRef } from 'react';
import SubcategoryRow from './SubcategoryRow';
import AddSubcategoryForm from './AddSubcategoryForm';

const cardStyle = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  marginBottom: 16,
  overflow: 'hidden',
  background: 'var(--bg-card)',
  transition: 'opacity 150ms',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--card-bg-subtle)',
  flexWrap: 'wrap',
};

const nameTextStyle = {
  fontWeight: 600,
  fontSize: 13,
  color: 'var(--text-pri)',
  cursor: 'text',
  borderBottom: '1px dashed var(--border)',
  flexShrink: 0,
};

const nameInputStyle = {
  padding: '2px 6px',
  background: 'var(--bg-card)',
  border: '1px solid var(--color-mmark)',
  borderRadius: 4,
  color: 'var(--text-pri)',
  fontSize: 13,
  fontWeight: 600,
  outline: 'none',
  width: 160,
};

const orderInputStyle = {
  width: 44,
  padding: '2px 5px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-sec)',
  fontSize: 12,
  outline: 'none',
  textAlign: 'center',
};

const toggleBtnStyle = (active) => ({
  padding: '2px 9px',
  borderRadius: 12,
  border: 'none',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  background: active ? 'rgba(22,163,74,0.18)' : 'rgba(200,40,40,0.12)',
  color: active ? '#4ade80' : '#f87171',
  lineHeight: 1.6,
});

const deleteBtnStyle = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 12,
  padding: '2px 8px',
  marginLeft: 'auto',
};

const inactiveLabelStyle = {
  fontSize: 10,
  fontWeight: 600,
  color: '#f87171',
  background: 'rgba(200,40,40,0.12)',
  padding: '1px 6px',
  borderRadius: 8,
  letterSpacing: '0.04em',
};

const errorStyle = {
  padding: '5px 14px',
  background: 'rgba(200,40,40,0.1)',
  color: '#ff6b6b',
  fontSize: 12,
  borderBottom: '1px solid var(--border)',
};

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export default function CategoryGroup({ category, onUpdateCat, onDeleteCat, onCreateSub, onUpdateSub, onDeleteSub }) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(category.name || '');
  const [orderInput, setOrderInput] = useState(String(category.display_order ?? ''));
  const [deleteError, setDeleteError] = useState(null);
  const [saving, setSaving] = useState(false);
  const deleteErrorTimer = useRef(null);

  function showDeleteError(msg) {
    setDeleteError(msg);
    if (deleteErrorTimer.current) clearTimeout(deleteErrorTimer.current);
    deleteErrorTimer.current = setTimeout(() => setDeleteError(null), 5000);
  }

  function handleNameClick() {
    setNameInput(category.name || '');
    setEditingName(true);
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') commitName();
    if (e.key === 'Escape') {
      setEditingName(false);
      setNameInput(category.name || '');
    }
  }

  async function commitName() {
    const trimmed = nameInput.trim();
    setEditingName(false);
    if (!trimmed || trimmed === (category.name || '').trim()) return;
    setSaving(true);
    await onUpdateCat({ id: category.id, name: trimmed });
    setSaving(false);
  }

  async function handleOrderBlur() {
    const val = parseInt(orderInput, 10);
    if (isNaN(val) || val === category.display_order) return;
    setSaving(true);
    await onUpdateCat({ id: category.id, displayOrder: val });
    setSaving(false);
  }

  async function handleToggleActive() {
    setSaving(true);
    await onUpdateCat({ id: category.id, isActive: !category.is_active });
    setSaving(false);
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete category '${category.name}'? All subcategories under it will also be deleted.`
    );
    if (!confirmed) return;
    const err = await onDeleteCat({ id: category.id });
    if (err) {
      const msg = err.message?.includes('row-level security')
        ? 'You do not have permission to delete this category.'
        : err.message || 'Delete failed.';
      showDeleteError(msg);
    }
  }

  const subs = category.mpl_subcategories || [];

  return (
    <div style={{ ...cardStyle, opacity: category.is_active ? 1 : 0.55 }}>
      <div style={headerStyle}>
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
          <span onClick={handleNameClick} title="Click to rename" style={nameTextStyle}>
            {category.name}
          </span>
        )}

        {!category.is_active && <span style={inactiveLabelStyle}>Inactive</span>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>#</span>
          <input
            type="number"
            value={orderInput}
            onChange={e => setOrderInput(e.target.value)}
            onBlur={handleOrderBlur}
            style={orderInputStyle}
            title="Display order"
          />
        </div>

        <button onClick={handleToggleActive} style={toggleBtnStyle(category.is_active)} disabled={saving}>
          {category.is_active ? 'Active' : 'Inactive'}
        </button>

        <button onClick={handleDelete} style={deleteBtnStyle} title="Delete category">
          <TrashIcon />
        </button>
      </div>

      {deleteError && <div style={errorStyle}>{deleteError}</div>}

      <div>
        {subs.length === 0 ? (
          <div style={{ padding: '8px 14px', color: 'var(--text-dim)', fontSize: 12 }}>
            No subcategories yet.
          </div>
        ) : (
          subs.map(sub => (
            <SubcategoryRow
              key={sub.id}
              subcategory={sub}
              onUpdateSub={onUpdateSub}
              onDeleteSub={onDeleteSub}
            />
          ))
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px' }}>
        <AddSubcategoryForm categoryId={category.id} onCreated={onCreateSub} />
      </div>
    </div>
  );
}
