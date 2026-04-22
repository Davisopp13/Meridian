import React from 'react'

const MESSAGES = {
  unsupported: {
    title: "Your browser doesn't support Picture-in-Picture",
    detail: 'The Processes widget requires Chrome 116+ or Edge. Please switch browsers to use Meridian.',
    showRetry: false,
  },
  denied: {
    title: "Couldn't open the widget",
    detail: 'The browser blocked the Picture-in-Picture window. This usually happens if permission was denied or the launch was triggered too late after a page load.',
    showRetry: true,
  },
  setup: {
    title: 'Widget failed to initialize',
    detail: 'Something went wrong setting up the widget. Try again, and if it keeps failing, reload the dashboard and try the Process Widget button again.',
    showRetry: true,
  },
}

export default function MplLaunchError({ reason, onRetry }) {
  const msg = MESSAGES[reason] || MESSAGES.setup

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ maxWidth: 380, textAlign: 'center' }}>
        <img
          src="/meridian-mark-192.png"
          width={48}
          height={48}
          style={{ borderRadius: 10, marginBottom: 18, opacity: 0.9 }}
          alt="Meridian"
        />
        <div style={{
          color: 'rgba(255,255,255,0.95)',
          fontSize: 15,
          fontWeight: 600,
          marginBottom: 10,
        }}>
          {msg.title}
        </div>
        <div style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: 13,
          lineHeight: 1.55,
          marginBottom: msg.showRetry ? 20 : 0,
        }}>
          {msg.detail}
        </div>
        {msg.showRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '9px 18px',
              background: 'var(--color-mmark)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
