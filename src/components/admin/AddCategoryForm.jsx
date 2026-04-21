import { useState } from 'react';

const formStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  padding: '8px 0 4px',
};

const inputStyle = {
  padding: '5px 10px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-pri)',
  fontSize: 13,
  outline: 'none',
  width: 180,
};

const addBtnStyle = {
  padding: '5px 14px',
  background: 'var(--color-mbtn)',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 13,
  cursor: 'pointer',
  flexShrink: 0,
};

const disabledBtnStyle = {
  ...addBtnStyle,
  opacity: 0.4,
  cursor: 'not-allowed',
};

const errorStyle = {
  marginTop: 6,
  fontSize: 12,
  color: '#ff6b6b',
};

export default function AddCategoryForm({ team, onCreated }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = name.trim().length > 2 && !saving;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const err = await onCreated({ name: name.trim(), team });
    setSaving(false);
    if (err) {
      const msg = err.message?.includes('row-level security')
        ? 'You do not have permission.'
        : err.message || 'Failed to create category.';
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
          placeholder={`New ${team} category…`}
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
          {saving ? 'Adding…' : 'Add category'}
        </button>
      </div>
      {error && <div style={errorStyle}>{error}</div>}
    </form>
  );
}
