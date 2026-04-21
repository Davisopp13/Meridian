import { useState, useRef } from 'react';

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 14px',
  borderBottom: '1px solid var(--border)',
};

const nameTextStyle = {
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
  outline: 'none',
  width: 160,
};

const orderInputStyle = {
  width: 40,
  padding: '2px 4px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-sec)',
  fontSize: 12,
  outline: 'none',
  textAlign: 'center',
};

const toggleBtnStyle = (active) => ({
  padding: '2px 8px',
  borderRadius: 10,
  border: 'none',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  background: active ? 'rgba(22,163,74,0.18)' : 'rgba(200,40,40,0.12)',
  color: active ? '#4ade80' : '#f87171',
  lineHeight: 1.6,
  flexShrink: 0,
});

const deleteBtnStyle = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 12,
  padding: '2px 7px',
  marginLeft: 'auto',
  flexShrink: 0,
};

const inactiveLabelStyle = {
  fontSize: 10,
  fontWeight: 600,
  color: '#f87171',
  background: 'rgba(200,40,40,0.12)',
  padding: '1px 5px',
  borderRadius: 8,
  letterSpacing: '0.04em',
  flexShrink: 0,
};

const errorStyle = {
  padding: '4px 14px',
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

export default function SubcategoryRow({ subcategory, onUpdateSub, onDeleteSub }) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(subcategory.name || '');
  const [orderInput, setOrderInput] = useState(String(subcategory.display_order ?? ''));
  const [deleteError, setDeleteError] = useState(null);
  const [saving, setSaving] = useState(false);
  const deleteErrorTimer = useRef(null);

  function showDeleteError(msg) {
    setDeleteError(msg);
    if (deleteErrorTimer.current) clearTimeout(deleteErrorTimer.current);
    deleteErrorTimer.current = setTimeout(() => setDeleteError(null), 5000);
  }

  function handleNameClick() {
    setNameInput(subcategory.name || '');
    setEditingName(true);
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') commitName();
    if (e.key === 'Escape') {
      setEditingName(false);
      setNameInput(subcategory.name || '');
    }
  }

  async function commitName() {
    const trimmed = nameInput.trim();
    setEditingName(false);
    if (!trimmed || trimmed === (subcategory.name || '').trim()) return;
    setSaving(true);
    await onUpdateSub({ id: subcategory.id, name: trimmed });
    setSaving(false);
  }

  async function handleOrderBlur() {
    const val = parseInt(orderInput, 10);
    if (isNaN(val) || val === subcategory.display_order) return;
    setSaving(true);
    await onUpdateSub({ id: subcategory.id, displayOrder: val });
    setSaving(false);
  }

  async function handleToggleActive() {
    setSaving(true);
    await onUpdateSub({ id: subcategory.id, isActive: !subcategory.is_active });
    setSaving(false);
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete subcategory '${subcategory.name}'? MPL entries logged against this subcategory will have their subcategory reference cleared.`
    );
    if (!confirmed) return;
    const err = await onDeleteSub({ id: subcategory.id });
    if (err) {
      const msg = err.message?.includes('row-level security')
        ? 'You do not have permission to delete this subcategory.'
        : err.message || 'Delete failed.';
      showDeleteError(msg);
    }
  }

  return (
    <div style={{ opacity: subcategory.is_active ? 1 : 0.55 }}>
      <div style={rowStyle}>
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
            {subcategory.name}
          </span>
        )}

        {!subcategory.is_active && <span style={inactiveLabelStyle}>Inactive</span>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
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

        <button onClick={handleToggleActive} style={toggleBtnStyle(subcategory.is_active)} disabled={saving}>
          {subcategory.is_active ? 'Active' : 'Inactive'}
        </button>

        <button onClick={handleDelete} style={deleteBtnStyle} title="Delete subcategory">
          <TrashIcon />
        </button>
      </div>

      {deleteError && <div style={errorStyle}>{deleteError}</div>}
    </div>
  );
}
