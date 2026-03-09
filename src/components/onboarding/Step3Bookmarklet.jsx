import React from 'react';

const C = {
  bg:      '#1a1a2e',
  bgDeep:  '#0f0f1e',
  mBtn:    '#003087',
  textPri: 'rgba(255,255,255,0.93)',
  textSec: 'rgba(255,255,255,0.45)',
  border:  'rgba(255,255,255,0.12)',
};

export default function Step3Bookmarklet({ onComplete, onBack }) {
  const host = import.meta.env.VITE_APP_URL || window.location.origin;

  const bmHref = `javascript:(function(){let cN='',aN='',typeVal='',subtypeVal='';try{let m=document.title.match(/\\d{8,}/);if(m&&m[0])cN=m[0].trim()}catch(e){}try{function w(n,d){if(d>50)return;if(!typeVal&&n.classList?.contains('slds-p-around_small')){let t=n.textContent?.trim()||'';if(t.startsWith('Type / Sub-Type')){let v=t.replace('Type / Sub-Type','').trim(),p=v.split(' / ');typeVal=p[0]||'';subtypeVal=p[1]||''}}if(!aN&&n.tagName==='A'){let h=n.getAttribute('href');if(h&&h.startsWith('/lightning/r/Account/001')){let i=h.match(/001[a-zA-Z0-9]{12,15}/);if(i&&i[0])aN=i[0]}}if(n.shadowRoot)for(let c of n.shadowRoot.children)w(c,d+1);for(let c of n.children)w(c,d+1)}w(document.body,0)}catch(e){}const isSF=!!cN,HOST='${host}',RELAY_ID='meridian-relay-iframe';const pl=isSF?{type:'MERIDIAN_CASE_START',caseNumber:cN,accountId:aN||null,caseType:typeVal||null,caseSubtype:subtypeVal||null,timestamp:Date.now()}:{type:'MERIDIAN_PROCESS_START',pageUrl:window.location.href,timestamp:Date.now()};const ex=document.getElementById(RELAY_ID);if(ex)ex.remove();const rf=document.createElement('iframe');rf.id=RELAY_ID;rf.src=HOST+'/meridian-relay.html?load=trigger&t='+Date.now();rf.style.cssText='display:none;position:fixed;width:0;height:0;border:none;z-index:-1';document.body.appendChild(rf);window.addEventListener('message',function h(e){if(e.data&&e.data.meridianTriggerCode){window.removeEventListener('message',h);rf.remove();try{(new Function('MERIDIAN_PAYLOAD',e.data.meridianTriggerCode))(pl)}catch(err){console.error('[Meridian] trigger exec error:',err)}}if(e.data&&e.data.meridianTriggerError){window.removeEventListener('message',h);rf.remove();console.error('[Meridian] relay error:',e.data.meridianTriggerError)}});try{const et=document.getElementById('meridian-toast');if(et)et.remove();const t=document.createElement('div');t.id='meridian-toast';t.textContent=isSF?'\\u2713 Meridian \\u2014 Case '+cN:'\\u2713 Meridian \\u2014 Process timer started';t.style.cssText='position:fixed;bottom:24px;right:24px;background:#003087;color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;font-family:"Segoe UI",sans-serif;z-index:2147483647;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.3);border-left:3px solid #E8540A;transition:opacity 300ms';document.body.appendChild(t);setTimeout(function(){t.style.opacity='0'},2200);setTimeout(function(){t.remove()},2500)}catch(e){}})();`;
  const widgetHref = `javascript:(function(){window.open('${host}','_blank','noopener,noreferrer');})();`;

  const instructions = [
    'Show your bookmarks bar — press Ctrl+Shift+B (Windows) or Cmd+Shift+B (Mac)',
    'Drag both buttons below up to your bookmarks bar',
    'Use Log to Meridian to capture work. Use Meridian Widget if you need to open Meridian first.',
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bgDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 520, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 40 }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <img src="/meridian-mark-192.png" alt="Meridian" style={{ width: 64, height: 64, borderRadius: 12 }} />
        </div>

        {/* Heading */}
        <h1 style={{ color: C.textPri, fontSize: 24, fontWeight: 800, textAlign: 'center', margin: '0 0 8px' }}>
          Install Bookmarklets
        </h1>
        <p style={{ color: C.textSec, fontSize: 14, textAlign: 'center', margin: '0 0 32px' }}>
          One to log activity, one to open the widget helper
        </p>

        {/* Instructions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '24px auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
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
              Log to Meridian
            </a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <a
              href={widgetHref}
              draggable="true"
              style={{
                display: 'inline-block',
                background: C.mBtn,
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
              Meridian Widget
            </a>
          </div>
        </div>

        {/* Info box */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 28,
        }}>
          <p style={{ color: C.textSec, fontSize: 13, margin: 0, lineHeight: '1.5' }}>
            Works on Chrome and Edge 116+. The bookmarklet never stores your passwords or personal data.
          </p>
        </div>

        {/* Complete button */}
        <button
          onClick={onComplete}
          style={{
            width: '100%', height: 48, background: C.mBtn, color: '#fff',
            fontSize: 15, fontWeight: 700, borderRadius: 10, border: 'none',
            cursor: 'pointer',
          }}
        >
          All done — Launch Meridian →
        </button>

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span
            onClick={onBack}
            style={{ color: C.textSec, fontSize: 13, cursor: 'pointer' }}
          >
            ← Back
          </span>
        </div>
      </div>
    </div>
  );
}
