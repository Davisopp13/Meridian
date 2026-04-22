import React from 'react';

const C = {
  textPri: 'var(--text-pri)',
  textSec: 'var(--text-sec)',
  textDim: 'var(--text-dim)',
  divider: 'var(--border)',
  border:  'var(--border)',
  cardBg:  'var(--bg-card)',
};

const COLS = [
  { key: 'date', label: 'DATE', color: C.textPri, bold: true },
  { key: 'resolved', label: 'RESOLVED', color: '#16a34a', bold: false },
  { key: 'reclass', label: 'RECLASSIFIED', color: '#dc2626', bold: false },
  { key: 'calls', label: 'CALLS', color: '#0284c7', bold: false },
  { key: 'notACase', label: 'NOT A CASE', color: '#6b7280', bold: false },
  { key: 'processes', label: 'PROCESSES', color: '#60a5fa', bold: false },
  { key: 'total', label: 'TOTAL', color: C.textPri, bold: true },
  { key: 'totalActivity', label: 'TOTAL ACTIVITY', color: C.textPri, bold: true },
];

export default function DashboardTable({ rows }) {
  const tableStyle = {
    background: C.cardBg,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    boxShadow: 'var(--shadow-subtle)',
    animation: 'fade-in-up 0.5s ease-out forwards',
  };

  const headerRowStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${COLS.length}, 1fr)`,
    height: 40,
    background: C.cardBg,
    borderBottom: `1px solid ${C.border}`,
  };

  const headerCellStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: C.textSec,
  };

  if (!rows || rows.length === 0) {
    return (
      <div style={tableStyle}>
        <div style={headerRowStyle}>
          {COLS.map(col => (
            <div key={col.key} style={headerCellStyle}>{col.label}</div>
          ))}
        </div>
        <div style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.textSec,
          fontSize: 13,
        }}>
          No activity for this period
        </div>
      </div>
    );
  }

  return (
    <div style={tableStyle}>
      <div style={headerRowStyle}>
        {COLS.map(col => (
          <div key={col.key} style={headerCellStyle}>{col.label}</div>
        ))}
      </div>
      {rows.map((row, i) => {
        const rowStyle = {
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS.length}, 1fr)`,
          height: 44,
          background: i % 2 === 0 ? 'transparent' : 'var(--card-bg-subtle)',
          borderBottom: i < rows.length - 1 ? `1px solid ${C.divider}` : 'none',
          transition: 'background 0.2s',
        };

        return (
          <div key={row.date} style={rowStyle}>
            {COLS.map(col => {
              const val = row[col.key];
              const isZero = val === 0;
              const cellColor = isZero && col.key !== 'date' ? C.textDim : col.color;
              const cellWeight = col.bold ? 700 : 400;

              return (
                <div key={col.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  fontSize: 13,
                  fontWeight: cellWeight,
                  color: cellColor,
                }}>
                  {val}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
