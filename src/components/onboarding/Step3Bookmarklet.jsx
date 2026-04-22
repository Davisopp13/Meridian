import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';

const C = {
  bg:      '#1a1a2e',
  bgDeep:  '#0f0f1e',
  mBtn:    '#003087',
  textPri: 'rgba(255,255,255,0.93)',
  textSec: 'rgba(255,255,255,0.45)',
  border:  'rgba(255,255,255,0.12)',
};

export function buildMplBmHref(userId) {
  return `javascript:(function(){window.open('https://meridian-hlag.vercel.app?mode=mpl-widget','meridian-mpl');var SUPABASE_URL='https://wluynppocsoqjdbmwass.supabase.co';var ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsdXlucHBvY3NvcWpkYm13YXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDU4NzIsImV4cCI6MjA4ODIyMTg3Mn0.x9-t_038hz4eJUciA1F9-DWE8UN_V58KE0i43cpOAMk';var USER_ID='${userId}';fetch(SUPABASE_URL+'/rest/v1/pending_triggers',{method:'POST',headers:{'apikey':ANON_KEY,'Authorization':'Bearer '+ANON_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({user_id:USER_ID,type:'MERIDIAN_PROCESS_START',page_url:window.location.href})}).catch(function(err){console.error('[Meridian]',err)});try{var et=document.getElementById('meridian-toast');if(et)et.remove();var t=document.createElement('div');t.id='meridian-toast';t.textContent='\\u2713 Meridian \\u2014 Process widget opened';t.style.cssText='position:fixed;bottom:24px;right:24px;background:#003087;color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;font-family:"Segoe UI",sans-serif;z-index:2147483647;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.3);border-left:3px solid #60a5fa;transition:opacity 300ms';document.body.appendChild(t);setTimeout(function(){t.style.opacity='0'},2200);setTimeout(function(){t.remove()},2500)}catch(e){}})();`;
}

export function buildCtBmHref(userId) {
  return `javascript:(function(){var NS_HOST='https://meridian-hlag.vercel.app';var RELAY_ID='meridian-relay-iframe';var USER_ID='${userId}';var isSF=window.location.hostname.includes('force.com')||window.location.hostname.includes('salesforce.com')||window.location.hostname.includes('lightning.com');var cN='';try{var m=document.title.match(/\\d{8,}/);if(m&&m[0])cN=m[0].trim()}catch(e){}var aN='',cID='',typeVal='',subtypeVal='';try{function w(n,d){if(d>50)return;if(!typeVal&&n.classList?.contains('slds-p-around_small')){var tt=n.textContent?.trim()||'';if(tt.startsWith('Type / Sub-Type')){var v=tt.replace('Type / Sub-Type','').trim(),p=v.split(' / ');typeVal=p[0]||'';subtypeVal=p[1]||''}}if(!aN&&n.tagName==='A'){var href=n.getAttribute('href');if(href&&href.startsWith('/lightning/r/Account/001')){var ai=href.match(/001[a-zA-Z0-9]{12,15}/);if(ai&&ai[0])aN=ai[0]}}if(!cID&&n.tagName==='A'){var hrefC=n.getAttribute('href');if(hrefC&&hrefC.startsWith('/lightning/r/Case/500')){var ci=hrefC.match(/500[a-zA-Z0-9]{12,15}/);if(ci&&ci[0])cID=ci[0]}}if(n.shadowRoot)for(var sc of n.shadowRoot.children)w(sc,d+1);for(var nc of n.children)w(nc,d+1)}w(document.body,0)}catch(e){}if(isSF){var ex=document.getElementById(RELAY_ID);if(ex)ex.remove();var rf=document.createElement('iframe');rf.id=RELAY_ID;rf.src=NS_HOST+'/meridian-relay.html?load=trigger&t='+Date.now();rf.style.cssText='display:none;position:fixed;width:0;height:0;border:none;z-index:-1';document.body.appendChild(rf);window.addEventListener('message',function h(e){if(e.data&&e.data.meridianTriggerCode){window.removeEventListener('message',h);try{(new Function('MERIDIAN_PAYLOAD',e.data.meridianTriggerCode))({userId:USER_ID,relayFrame:rf.contentWindow,sfCaseId:cID})}catch(err){console.error('[Meridian] trigger exec error:',err);rf.remove()}}if(e.data&&e.data.meridianTriggerError){window.removeEventListener('message',h);rf.remove();console.error('[Meridian] relay error:',e.data.meridianTriggerError)}})}try{var et=document.getElementById('meridian-toast');if(et)et.remove();var t=document.createElement('div');t.id='meridian-toast';t.textContent=isSF?(cN?'\\u2713 Meridian \\u2014 Case '+cN:'\\u2713 Meridian \\u2014 Logging case...'):'Meridian: Open a Salesforce case page to use Case Tracker';t.style.cssText='position:fixed;bottom:24px;right:24px;background:#003087;color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;font-family:"Segoe UI",sans-serif;z-index:2147483647;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.3);border-left:3px solid #E8540A;transition:opacity 300ms';document.body.appendChild(t);setTimeout(function(){t.style.opacity='0'},2200);setTimeout(function(){t.remove()},2500)}catch(e){}})();`;
}

export default function Step3Bookmarklet({ onComplete, onBack, submitting = false, submitError = null }) {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  const bmHref = userId ? buildCtBmHref(userId) : '#';
  const mplBmHref = userId ? buildMplBmHref(userId) : '#';
  const instructions = [
    'Show your bookmarks bar — press Ctrl+Shift+B (Windows) or Cmd+Shift+B (Mac)',
    'Drag the button below up to your bookmarks bar',
    'Click it on any Salesforce case page to start tracking.',
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
          Install the Bookmarklet
        </h1>
        <p style={{ color: C.textSec, fontSize: 14, textAlign: 'center', margin: '0 0 32px' }}>
          One click to start tracking from anywhere
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

        {/* Bookmarklet anchor */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '24px auto' }}>
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
            ⚡ Cases
          </a>
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

        {/* Error banner */}
        {submitError && (
          <div style={{
            background: 'rgba(232, 84, 10, 0.12)',
            border: '1px solid rgba(232, 84, 10, 0.45)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 14,
          }}>
            <p style={{ color: '#ffb28a', fontSize: 13, margin: 0, lineHeight: '1.5' }}>
              {submitError}
            </p>
          </div>
        )}

        {/* Complete button */}
        <button
          onClick={onComplete}
          disabled={submitting}
          style={{
            width: '100%', height: 48, background: C.mBtn, color: '#fff',
            fontSize: 15, fontWeight: 700, borderRadius: 10, border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.65 : 1,
          }}
        >
          {submitting ? 'Setting up…' : 'All done — Launch Meridian →'}
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
