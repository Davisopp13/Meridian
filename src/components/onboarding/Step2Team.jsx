import { useState } from 'react';

export default function Step2Team({ onNext, onBack }) {
  const [selected, setSelected] = useState(null);

  const teams = [
    { id: 'CH', label: 'CH', sublabel: 'Container Haulage', accent: '#d97706' },
    { id: 'MH', label: 'MH', sublabel: 'Merchant Haulage',  accent: '#60a5fa' },
  ];

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `${r},${g},${b}`;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 40 }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <img src="/meridian-mark-192.png" alt="Meridian" style={{ width: 64, height: 64, borderRadius: 12 }} />
        </div>

        {/* Heading */}
        <h1 style={{ margin: 0, color: '#fff', fontSize: 24, fontWeight: 800, textAlign: 'center' }}>
          Your Team
        </h1>
        <p style={{ margin: '8px 0 32px', color: 'var(--text-dim)', fontSize: 14, textAlign: 'center' }}>
          This determines which process categories you see
        </p>

        {/* Team cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {teams.map(t => {
            const isSelected = selected === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setSelected(t.id)}
                style={{
                  flex: 1,
                  height: 110,
                  borderRadius: 12,
                  border: `2px solid ${isSelected ? t.accent : 'var(--border)'}`,
                  background: isSelected ? `rgba(${hexToRgb(t.accent)},0.12)` : 'var(--card-bg-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all var(--motion-fast)',
                }}
              >
                <span style={{ fontSize: 32, fontWeight: 800, color: isSelected ? t.accent : '#fff' }}>
                  {t.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {t.sublabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Continue button */}
        <button
          onClick={() => selected && onNext({ team: selected })}
          disabled={!selected}
          style={{
            width: '100%',
            height: 48,
            background: 'var(--color-mbtn)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 10,
            border: 'none',
            cursor: selected ? 'pointer' : 'not-allowed',
            opacity: selected ? 1 : 0.4,
            transition: 'opacity var(--motion-fast)',
          }}
        >
          Continue →
        </button>

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span
            onClick={onBack}
            style={{ color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer' }}
          >
            ← Back
          </span>
        </div>
      </div>
    </div>
  );
}
