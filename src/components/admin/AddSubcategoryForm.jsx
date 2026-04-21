import { useState } from 'react';

const formStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

const inputStyle = {
  padding: '4px 9px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-pri)',
  fontSize: 12,
  outline: 'none',
  width: 160,
};

const addBtnStyle = {
  padding: '4px 12px',
  background: 'var(--color-mbtn)',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 12,
  cursor: 'pointer',
  flexShrink: 0,
};

const disabledBtnStyle = {
  ...addBtnStyle,
  opacity: 0.4,
  cursor: 'not-allowed',
};

const errorStyle = {
  marginTop: 4,
  fontSize: 11,
  color: '#ff6b6b',
};

export default function AddSubcategoryForm({ categoryId, onCreated }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = name.trim().length > 2 && !saving;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const err = await onCreated({ name: name.trim(), categoryId });
    setSaving(false);
    if (err) {
      const msg = err.message?.includes('row-level security')
        ? 'You do not have permission.'
        : err.message || 'Failed to create subcategory.';
      setError(msg);
    } else {
      setName('');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={formStyle}>
        <input
          type="text"
          placeholder="New subcategory…"
          value={name}
          onChange={e => { setName(e.target.value); setError(null); }}
          style={inputStyle}
          maxLength={80}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          style={canSubmit ? addBtnStyle : disabledBtnStyle}
        >
          {saving ? 'Adding…' : 'Add subcategory'}
        </button>
      </div>
      {error && <div style={errorStyle}>{error}</div>}
    </form>
  );
}
