import { useState } from 'react';

const formStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
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

const radioGroupStyle = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  fontSize: 13,
  color: 'var(--text-sec)',
};

const radioLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
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

export default function AddTeamForm({ departmentId, onCreated }) {
  const [name, setName] = useState('');
  const [haulageType, setHaulageType] = useState('MH');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = name.trim().length > 2 && !saving;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const err = await onCreated({ name: name.trim(), departmentId, haulageType });
    setSaving(false);
    if (err) {
      const msg = err.message?.includes('row-level security')
        ? 'You do not have permission.'
        : err.message || 'Failed to create team.';
      setError(msg);
    } else {
      setName('');
      setHaulageType('MH');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={formStyle}>
        <input
          type="text"
          placeholder="Team name…"
          value={name}
          onChange={e => { setName(e.target.value); setError(null); }}
          style={inputStyle}
          maxLength={80}
        />

        <div style={radioGroupStyle}>
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name={`haulage-${departmentId}`}
              value="MH"
              checked={haulageType === 'MH'}
              onChange={() => setHaulageType('MH')}
            />
            MH
          </label>
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name={`haulage-${departmentId}`}
              value="CH"
              checked={haulageType === 'CH'}
              onChange={() => setHaulageType('CH')}
            />
            CH
          </label>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          style={canSubmit ? addBtnStyle : disabledBtnStyle}
        >
          {saving ? 'Adding…' : 'Add team'}
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}
    </form>
  );
}
