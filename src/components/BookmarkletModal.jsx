import React from 'react';

const C = {
  bg: '#1a1a2e',
  mBtn: '#003087',
  textPri: 'rgba(255,255,255,0.93)',
  textSec: 'rgba(255,255,255,0.75)',
  border: 'rgba(255,255,255,0.12)',
};

const instructions = [
  'Show your bookmarks bar — press Ctrl+Shift+B (Windows) or Cmd+Shift+B (Mac)',
  'Drag the orange button below up to your bookmarks bar',
  'Click it on a Salesforce page to log a case, or any other page to log a process',
];

export default function BookmarkletModal({ onClose, user }) {
  const host = import.meta.env.VITE_APP_URL || window.location.origin;
  const userId = user?.id || '';

  // The bookmarklet:
  // 1. Scrapes case number, account ID, type/subtype from the SF page
  // 2. Creates a hidden relay iframe on meridian-hlag.com
  // 3. Waits for the relay to send back the trigger code
  // 4. Executes the trigger code with { userId, relayFrame } as MERIDIAN_PAYLOAD
  //    - userId is baked in at generation time
  //    - relayFrame is the iframe's contentWindow (kept alive for Supabase proxy calls)
  // 5. The trigger code sends SUPABASE_INSERT_TRIGGER to the relay, which proxies to Supabase
  // 6. Shows a toast confirmation
  const bmHref = `javascript:(function(){var UID='${userId}';if(!UID){alert('Meridian: Bookmarklet not configured. Re-install from Meridian.');return;}var HOST='${host}';var RELAY_ID='meridian-relay-iframe';var ex=document.getElementById(RELAY_ID);if(ex)ex.remove();var rf=document.createElement('iframe');rf.id=RELAY_ID;rf.src=HOST+'/meridian-relay.html?load=trigger&t='+Date.now();rf.style.cssText='display:none;position:fixed;width:0;height:0;border:none;z-index:-1';document.body.appendChild(rf);window.addEventListener('message',function h(e){if(e.data&&e.data.meridianTriggerCode){window.removeEventListener('message',h);try{(new Function('MERIDIAN_PAYLOAD',e.data.meridianTriggerCode))({userId:UID,relayFrame:rf.contentWindow})}catch(err){console.error('[Meridian] trigger exec error:',err);rf.remove()}}if(e.data&&e.data.meridianTriggerError){window.removeEventListener('message',h);rf.remove();alert('Meridian: '+e.data.meridianTriggerError)}});setTimeout(function(){var el=document.getElementById(RELAY_ID);if(el)el.remove()},15000)})();`;

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
          background: C.bg,
          border: `1px solid ${C.border}`,
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
            color: C.textSec, fontSize: 13, cursor: 'pointer',
          }}
        >
          ✕ Close
        </span>

        {/* Heading */}
        <h2 style={{ color: C.textPri, fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>
          Install the Bookmarklet
        </h2>
        <p style={{ color: C.textSec, fontSize: 13, margin: '0 0 28px' }}>
          Drag the button below to your bookmarks bar
        </p>

        {/* Instructions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {instructions.map((text, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 24, height: 24, minWidth: 24, borderRadius: '50%',
                background: C.mBtn, color: '#fff', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i + 1}
              </div>
              <span style={{ color: C.textPri, fontSize: 14, lineHeight: '1.5', paddingTop: 3 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Bookmarklet anchor */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px auto' }}>
          <a
            href={bmHref}
            draggable="true"
            style={{
              display: 'inline-block',
              background: '#E8540A',
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
            ⚡ Meridian
          </a>
        </div>

        {/* Info callout */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '14px 16px',
        }}>
          <p style={{ color: C.textSec, fontSize: 13, margin: 0, lineHeight: '1.5' }}>
            Works on Chrome and Edge 116+. The bookmarklet never stores your passwords or personal data.
          </p>
        </div>
      </div>
    </div>
  );
}
