import { useEffect, useState } from 'react'

/**
 * Banner that appears on the Dashboard when a bookmarklet trigger
 * arrives via Realtime but the PiP widget isn't open yet.
 *
 * Also fires a Web Notification so the user sees it even when
 * the Meridian tab is in the background (e.g. they're on SF).
 * Clicking the notification focuses the Meridian tab.
 */
export default function PendingTriggerBanner({ trigger, onLaunch, onDismiss }) {
  const [visible, setVisible] = useState(false)

  // Request notification permission on mount (only once)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Show banner animation + fire Web Notification when trigger arrives
  useEffect(() => {
    if (!trigger) {
      setVisible(false)
      return
    }

    requestAnimationFrame(() => setVisible(true))

    // Fire Web Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      const isCase = trigger.type === 'case'
      const title = isCase
        ? `Case ${trigger.data.caseNumber} received`
        : 'Process trigger received'
      const body = 'Click to open Meridian Widget and process the queued activity'

      try {
        const notification = new Notification(title, {
          body,
          icon: '/meridian-mark-192.png',
          tag: 'meridian-trigger', // replaces previous notification
          requireInteraction: true, // stays visible until dismissed
        })

        notification.onclick = () => {
          notification.close()
          // Focus the Meridian tab
          window.focus()
        }

        // Auto-close after 15 seconds
        setTimeout(() => notification.close(), 15000)
      } catch (e) {
        // Notification API may fail in some contexts — non-critical
        console.warn('[Meridian] Notification failed:', e)
      }
    }
  }, [trigger])

  if (!trigger) return null

  const isCase = trigger.type === 'case'
  const label = isCase
    ? `Case ${trigger.data.caseNumber} received`
    : 'Process trigger received'

  return (
    <div
      style={{
        position: 'fixed',
        top: 80,
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : '-20px'})`,
        opacity: visible ? 1 : 0,
        transition: 'all 300ms ease-out',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#1a1a2e',
        border: '1px solid #E8540A',
        borderRadius: 12,
        padding: '12px 20px',
        boxShadow: '0 8px 32px rgba(232, 84, 10, 0.25)',
        maxWidth: 480,
      }}
    >
      {/* Pulse dot */}
      <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: '#E8540A',
          animation: 'meridian-pulse 1.5s ease-in-out infinite',
        }} />
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
          {label}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
          Click to open Meridian Widget and continue
        </div>
      </div>

      {/* Launch button */}
      <button
        onClick={onLaunch}
        style={{
          background: '#E8540A',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Open Widget
      </button>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.3)',
          fontSize: 16,
          cursor: 'pointer',
          padding: '0 4px',
          lineHeight: 1,
        }}
      >
        ✕
      </button>

      <style>{`
        @keyframes meridian-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
