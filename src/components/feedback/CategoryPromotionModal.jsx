import { useState } from 'react';
import { promoteSuggestion } from '../../lib/api.js';

const C = {
  overlay:  'rgba(0,0,0,0.55)',
  bg:       'var(--bg-card)',
  border:   'var(--border)',
  textPri:  'var(--text-pri)',
  textSec:  'var(--text-sec)',
};

export default function CategoryPromotionModal({ suggestion, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const typeLabel = suggestion.type === 'subcategory' ? 'subcategories' : 'categories';

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const { error: err } = await promoteSuggestion(suggestion.id);
    setLoading(false);
    if (err) {
      setError(err.message || 'Promotion failed. Check your admin role and try again.');
      return;
    }
    onConfirm();
  }

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0,
        background: C.overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '24px 28px',
          maxWidth: 440,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <p style={{ color: C.textPri, fontSize: 15, lineHeight: 1.5, marginBottom: 20 }}>
          Promote &ldquo;{suggestion.title}&rdquo; to live {typeLabel} under{' '}
          <strong>{suggestion.haulage_type}</strong>? This will insert it into the live
          taxonomy. Agents will see it in their widget on next refresh.
        </p>

        {error && (
          <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 14 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '7px 16px', borderRadius: 6, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.textSec, cursor: 'pointer', fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              padding: '7px 16px', borderRadius: 6, border: 'none',
              background: '#16a34a', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14, opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Promoting...' : 'Promote to live'}
          </button>
        </div>
      </div>
    </div>
  );
}
