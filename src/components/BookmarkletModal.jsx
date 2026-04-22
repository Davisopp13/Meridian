import React from 'react';
import { buildCtBmHref, buildMplBmHref } from './onboarding/Step3Bookmarklet.jsx';


const instructions = [
  'Show your bookmarks bar — press Ctrl+Shift+B (Windows) or Cmd+Shift+B (Mac)',
  'Drag the button below up to your bookmarks bar',
  'Click it on any Salesforce case page to start tracking.',
];

export default function BookmarkletModal({ onClose, user }) {
  const userId = user?.id ?? '';
  const ctHref = userId ? buildCtBmHref(userId) : '#';
  const mplHref = userId ? buildMplBmHref(userId) : '#';

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 40,
          maxWidth: 500,
          width: '90%',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <span
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 20,
            color: 'var(--text-sec)', fontSize: 13, cursor: 'pointer',
          }}
        >
          ✕ Close
        </span>

        {/* Heading */}
        <h2 style={{ color: 'var(--text-pri)', fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>
          Install the Meridian Buttons
        </h2>
        <p style={{ color: 'var(--text-sec)', fontSize: 13, margin: '0 0 28px' }}>
          Drag the button to your bookmarks bar
        </p>

        {/* Instructions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {instructions.map((text, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 24, height: 24, minWidth: 24, borderRadius: '50%',
                background: 'var(--color-mbtn)', color: '#fff', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i + 1}
              </div>
              <span style={{ color: 'var(--text-pri)', fontSize: 14, lineHeight: '1.5', paddingTop: 3 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Bookmarklet anchor */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px auto' }}>
          <a
            href={ctHref}
            draggable="true"
            style={{
              display: 'inline-block',
              background: 'var(--color-mmark)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              padding: '10px 24px',
              borderRadius: 20,
              cursor: 'grab',
              userSelect: 'none',
              textDecoration: 'none',
            }}
            onClick={e => e.preventDefault()}
          >
            ⚡ Cases
          </a>
        </div>

        {/* Info callout */}
        <div style={{
          background: 'var(--card-bg-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '14px 16px',
        }}>
          <p style={{ color: 'var(--text-sec)', fontSize: 13, margin: 0, lineHeight: '1.5' }}>
            Works on Chrome and Edge 116+. The bookmarklets never store your passwords or personal data.
          </p>
        </div>
      </div>
    </div>
  );
}
