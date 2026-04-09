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
  'Click "Meridian \u2014 Log" on Salesforce to log cases. Click "MPL \u2014 Log Process" to time manual work.',
];

export default function BookmarkletModal({ onClose, user }) {
  const userId = user?.id ?? '';
  const bmHref = `javascript:(function(){window.open('https://meridian-hlag.vercel.app?mode=widget','meridian-widget','popup,width=550,height=64,top=0,left='+(screen.availWidth-566));var SUPABASE_URL='https://wluynppocsoqjdbmwass.supabase.co';var ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsdXlucHBvY3NvcWpkYm13YXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDU4NzIsImV4cCI6MjA4ODIyMTg3Mn0.x9-t_038hz4eJUciA1F9-DWE8UN_V58KE0i43cpOAMk';var NS_HOST='https://meridian-hlag.vercel.app';var RELAY_ID='meridian-relay-iframe';var USER_ID='${userId}';var isSF=window.location.hostname.includes('force.com')||window.location.hostname.includes('salesforce.com')||window.location.hostname.includes('lightning.com');var cN='';try{var m=document.title.match(/\\d{8,}/);if(m&&m[0])cN=m[0].trim()}catch(e){}var aN='',typeVal='',subtypeVal='';try{function w(n,d){if(d>50)return;if(!typeVal&&n.classList?.contains('slds-p-around_small')){var tt=n.textContent?.trim()||'';if(tt.startsWith('Type / Sub-Type')){var v=tt.replace('Type / Sub-Type','').trim(),p=v.split(' / ');typeVal=p[0]||'';subtypeVal=p[1]||''}}if(!aN&&n.tagName==='A'){var href=n.getAttribute('href');if(href&&href.startsWith('/lightning/r/Account/001')){var ai=href.match(/001[a-zA-Z0-9]{12,15}/);if(ai&&ai[0])aN=ai[0]}}if(n.shadowRoot)for(var sc of n.shadowRoot.children)w(sc,d+1);for(var nc of n.children)w(nc,d+1)}w(document.body,0)}catch(e){}if(isSF){var ex=document.getElementById(RELAY_ID);if(ex)ex.remove();var rf=document.createElement('iframe');rf.id=RELAY_ID;rf.src=NS_HOST+'/meridian-relay.html?load=trigger&t='+Date.now();rf.style.cssText='display:none;position:fixed;width:0;height:0;border:none;z-index:-1';document.body.appendChild(rf);window.addEventListener('message',function h(e){if(e.data&&e.data.meridianTriggerCode){window.removeEventListener('message',h);try{(new Function('MERIDIAN_PAYLOAD',e.data.meridianTriggerCode))({userId:USER_ID,relayFrame:rf.contentWindow})}catch(err){console.error('[Meridian] trigger exec error:',err);rf.remove()}setTimeout(function(){var el=document.getElementById(RELAY_ID);if(el)el.remove()},15000)}if(e.data&&e.data.meridianTriggerError){window.removeEventListener('message',h);rf.remove();console.error('[Meridian] relay error:',e.data.meridianTriggerError)}})}else{fetch(SUPABASE_URL+'/rest/v1/pending_triggers',{method:'POST',headers:{'apikey':ANON_KEY,'Authorization':'Bearer '+ANON_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({user_id:USER_ID,type:'MERIDIAN_PROCESS_START',page_url:window.location.href})}).catch(function(err){console.error('[Meridian]',err)})}try{var et=document.getElementById('meridian-toast');if(et)et.remove();var t=document.createElement('div');t.id='meridian-toast';t.textContent=isSF?(cN?'\\u2713 Meridian \\u2014 Case '+cN:'\\u2713 Meridian \\u2014 Logging case...'):'\\u2713 Meridian \\u2014 Process timer started';t.style.cssText='position:fixed;bottom:24px;right:24px;background:#003087;color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;font-family:"Segoe UI",sans-serif;z-index:2147483647;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.3);border-left:3px solid #E8540A;transition:opacity 300ms';document.body.appendChild(t);setTimeout(function(){t.style.opacity='0'},2200);setTimeout(function(){t.remove()},2500)}catch(e){}})();`;
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
          Install the Meridian Button
        </h2>
        <p style={{ color: C.textSec, fontSize: 13, margin: '0 0 28px' }}>
          Drag this button to your bookmarks bar to launch and log
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

        {/* Bookmarklet anchors */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, margin: '20px auto', flexWrap: 'wrap' }}>
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
            ⚡ Meridian — Log
          </a>
          <a
            href={`javascript:(function(){window.open('https://meridian-hlag.vercel.app?mode=mpl','meridian-mpl');})();`}
            draggable="true"
            style={{
              display: 'inline-block',
              background: '#3b82f6',
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
            📋 MPL — Log Process
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
