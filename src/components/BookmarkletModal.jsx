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
  // The bookmarklet uses a dual-path strategy:
  // - SF pages: relay iframe via meridian-hlag.com (required to bypass SF CSP)
  // - All other pages: direct window.open + postMessage to meridian-ashen-one.vercel.app (no relay, no Zscaler risk)
  const bmHref = `javascript:(function(){let cN='',aN='',typeVal='',subtypeVal='';try{let m=document.title.match(/\\d{8,}/);if(m&&m[0])cN=m[0].trim()}catch(e){}try{function w(n,d){if(d>50)return;if(!typeVal&&n.classList?.contains('slds-p-around_small')){let t=n.textContent?.trim()||'';if(t.startsWith('Type / Sub-Type')){let v=t.replace('Type / Sub-Type','').trim(),p=v.split(' / ');typeVal=p[0]||'';subtypeVal=p[1]||''}}if(!aN&&n.tagName==='A'){let h=n.getAttribute('href');if(h&&h.startsWith('/lightning/r/Account/001')){let i=h.match(/001[a-zA-Z0-9]{12,15}/);if(i&&i[0])aN=i[0]}}if(n.shadowRoot)for(let c of n.shadowRoot.children)w(c,d+1);for(let c of n.children)w(c,d+1)}w(document.body,0)}catch(e){}const isSF=!!cN,SF_HOST='https://meridian-hlag.com',NS_HOST='https://meridian-ashen-one.vercel.app',RELAY_ID='meridian-relay-iframe';const pl=isSF?{type:'MERIDIAN_CASE_START',caseNumber:cN,accountId:aN||null,caseType:typeVal||null,caseSubtype:subtypeVal||null,timestamp:Date.now()}:{type:'MERIDIAN_PROCESS_START',pageUrl:window.location.href,timestamp:Date.now()};if(isSF){const ex=document.getElementById(RELAY_ID);if(ex)ex.remove();const rf=document.createElement('iframe');rf.id=RELAY_ID;rf.src=SF_HOST+'/meridian-relay.html?load=trigger&t='+Date.now();rf.style.cssText='display:none;position:fixed;width:0;height:0;border:none;z-index:-1';document.body.appendChild(rf);window.addEventListener('message',function h(e){if(e.data&&e.data.meridianTriggerCode){window.removeEventListener('message',h);rf.remove();try{(new Function('MERIDIAN_PAYLOAD',e.data.meridianTriggerCode))(pl)}catch(err){console.error('[Meridian] trigger exec error:',err)}}if(e.data&&e.data.meridianTriggerError){window.removeEventListener('message',h);rf.remove();console.error('[Meridian] relay error:',e.data.meridianTriggerError)}})}else{const meridianTab=window.open(NS_HOST,'meridian-app');setTimeout(function(){if(meridianTab)meridianTab.postMessage(pl,NS_HOST)},800)}try{const et=document.getElementById('meridian-toast');if(et)et.remove();const t=document.createElement('div');t.id='meridian-toast';t.textContent=isSF?'\\u2713 Meridian \\u2014 Case '+cN:'\\u2713 Meridian \\u2014 Process timer started';t.style.cssText='position:fixed;bottom:24px;right:24px;background:#003087;color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;font-family:"Segoe UI",sans-serif;z-index:2147483647;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.3);border-left:3px solid #E8540A;transition:opacity 300ms';document.body.appendChild(t);setTimeout(function(){t.style.opacity='0'},2200);setTimeout(function(){t.remove()},2500)}catch(e){}})();`;
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
