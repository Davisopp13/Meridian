# Meridian Bookmarklet

The bookmarklet is what agents (users) save in their browser bookmarks toolbar. Clicking it on any page triggers the appropriate Meridian action.

## Behavior

- **On a Salesforce case page** (title contains a case number): fires `MERIDIAN_CASE_START` with case number, account ID, case type, and subtype scraped from the DOM.
- **On any other page**: fires `MERIDIAN_PROCESS_START` with the current page URL.

## How it works

### Non-SF pages (OWA, Teams, any non-Salesforce tab)

1. The bookmarklet calls `window.open('https://meridian-ashen-one.vercel.app', 'meridian-app')` to open or focus the Meridian tab.
2. After 800 ms it calls `postMessage(pl, NS_HOST)` directly on the returned window reference.
3. `App.jsx` receives the message via `window.addEventListener('message', ...)` and handles it.
4. No relay iframe, no `meridian-hlag.com` touch — no Zscaler risk on corporate-filtered pages.

### SF case pages

1. The bookmarklet creates a hidden `<iframe>` loading `https://meridian-hlag.com/meridian-relay.html?load=trigger`.
2. `meridian-relay.html` fetches `/meridian-trigger.js` from the same origin and posts the code back to the SF page as `{ meridianTriggerCode: '...' }`.
3. The bookmarklet receives the code and runs `new Function('MERIDIAN_PAYLOAD', code)(payload)`.
4. `meridian-trigger.js` calls `window.open(HOST, 'meridian-app')` to open or focus the Meridian tab, then `postMessage`s the payload to it after 800 ms.
5. `App.jsx` receives the message via `window.addEventListener('message', ...)` and handles it.

This relay pattern is required on Salesforce because SF's `connect-src` CSP blocks direct fetch calls. Every other page bypasses it entirely.

## Relay

`public/meridian-relay.html` — fetches and forwards the trigger script. Do NOT modify after setup.
`public/meridian-trigger.js` — runs on the SF page via `new Function`. Opens/focuses the Meridian tab and posts the payload. If the production domain changes, update the `HOST` constant in this file.

## Minified bookmarklet (give to agents)

Agents install this via the onboarding flow. The SF relay path always uses `https://meridian-hlag.com`; the non-SF direct path uses `https://meridian-ashen-one.vercel.app`. Both URLs are hardcoded in the bookmarklet — see the Production URLs table below.

```
javascript:(function(){let cN='',aN='',typeVal='',subtypeVal='';try{let m=document.title.match(/\d{8,}/);if(m&&m[0])cN=m[0].trim()}catch(e){}try{function w(n,d){if(d>50)return;if(!typeVal&&n.classList?.contains('slds-p-around_small')){let t=n.textContent?.trim()||'';if(t.startsWith('Type / Sub-Type')){let v=t.replace('Type / Sub-Type','').trim(),p=v.split(' / ');typeVal=p[0]||'';subtypeVal=p[1]||''}}if(!aN&&n.tagName==='A'){let h=n.getAttribute('href');if(h&&h.startsWith('/lightning/r/Account/001')){let i=h.match(/001[a-zA-Z0-9]{12,15}/);if(i&&i[0])aN=i[0]}}if(n.shadowRoot)for(let c of n.shadowRoot.children)w(c,d+1);for(let c of n.children)w(c,d+1)}w(document.body,0)}catch(e){}const isSF=!!cN,SF_HOST='https://meridian-hlag.com',NS_HOST='https://meridian-ashen-one.vercel.app',RELAY_ID='meridian-relay-iframe';const pl=isSF?{type:'MERIDIAN_CASE_START',caseNumber:cN,accountId:aN||null,caseType:typeVal||null,caseSubtype:subtypeVal||null,timestamp:Date.now()}:{type:'MERIDIAN_PROCESS_START',pageUrl:window.location.href,timestamp:Date.now()};if(isSF){const ex=document.getElementById(RELAY_ID);if(ex)ex.remove();const rf=document.createElement('iframe');rf.id=RELAY_ID;rf.src=SF_HOST+'/meridian-relay.html?load=trigger&t='+Date.now();rf.style.cssText='display:none;position:fixed;width:0;height:0;border:none;z-index:-1';document.body.appendChild(rf);window.addEventListener('message',function h(e){if(e.data&&e.data.meridianTriggerCode){window.removeEventListener('message',h);rf.remove();try{(new Function('MERIDIAN_PAYLOAD',e.data.meridianTriggerCode))(pl)}catch(err){console.error('[Meridian] trigger exec error:',err)}}if(e.data&&e.data.meridianTriggerError){window.removeEventListener('message',h);rf.remove();console.error('[Meridian] relay error:',e.data.meridianTriggerError)}})}else{const meridianTab=window.open(NS_HOST,'meridian-app');setTimeout(function(){if(meridianTab)meridianTab.postMessage(pl,NS_HOST)},800)}try{const et=document.getElementById('meridian-toast');if(et)et.remove();const t=document.createElement('div');t.id='meridian-toast';t.textContent=isSF?'✓ Meridian — Case '+cN:'✓ Meridian — Process timer started';t.style.cssText='position:fixed;bottom:24px;right:24px;background:#003087;color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;font-family:"Segoe UI",sans-serif;z-index:2147483647;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.3);border-left:3px solid #E8540A;transition:opacity 300ms';document.body.appendChild(t);setTimeout(function(){t.style.opacity='0'},2200);setTimeout(function(){t.remove()},2500)}catch(e){}})();
```

## Production URLs

| URL | Path | Notes |
|-----|------|-------|
| `https://meridian-ashen-one.vercel.app` | Non-SF (direct postMessage) | Current default for non-SF path |
| `https://meridian-hlag.com` | SF relay (`meridian-relay.html`) | IT-managed custom domain; confirmed working with CSP allowlist |

To switch non-SF to the custom domain once IT whitelists it: change the `HOST` constant in the bookmarklet from `'https://meridian-ashen-one.vercel.app'` to `'https://meridian-hlag.com'` and re-minify.

## Development / localhost testing

For local testing, use a version with `HOST='http://localhost:5173'`. Do not check that version in — the production bookmarklet above is the canonical reference.
