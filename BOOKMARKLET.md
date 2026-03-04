# Meridian Bookmarklet

The bookmarklet is what agents (users) save in their browser bookmarks toolbar. Clicking it on any page triggers the appropriate Meridian action.

## Behavior

- **On a Salesforce case page** (title contains a case number): fires `MERIDIAN_CASE_START` with case number, account ID, case type, and subtype scraped from the DOM.
- **On any other page**: fires `MERIDIAN_PROCESS_START` with the current page URL.

## How it works

1. The bookmarklet creates (or reuses) a hidden `<iframe>` in the current page pointing to `{HOST}/relay.html`.
2. Once the relay iframe signals `MERIDIAN_RELAY_READY`, the bookmarklet posts the message payload to it.
3. `relay.html` forwards the message to the Meridian app window (`window.opener || window.top`).
4. `App.jsx` receives the message and handles it.

## Relay

Hosted at `public/relay.html`. Do NOT modify after setup. It is a static file with no build step.

## Minified bookmarklet (give to agents)

Before distributing, update the `HOST` constant to the actual Vercel deploy URL.

```
javascript:(function(){let cN='',aN='',typeVal='',subtypeVal='';try{let m=document.title.match(/\d{8,}/);if(m&&m[0])cN=m[0].trim()}catch(e){}try{function w(n,d){if(d>50)return;if(!typeVal&&n.classList?.contains('slds-p-around_small')){let t=n.textContent?.trim()||'';if(t.startsWith('Type / Sub-Type')){let v=t.replace('Type / Sub-Type','').trim(),p=v.split(' / ');typeVal=p[0]||'';subtypeVal=p[1]||''}}if(!aN&&n.tagName==='A'){let h=n.getAttribute('href');if(h&&h.startsWith('/lightning/r/Account/001')){let i=h.match(/001[a-zA-Z0-9]{12,15}/);if(i&&i[0])aN=i[0]}}if(n.shadowRoot)for(let c of n.shadowRoot.children)w(c,d+1);for(let c of n.children)w(c,d+1)}w(document.body,0)}catch(e){}const isSF=!!cN,HOST='https://meridian.vercel.app',RELAY_ID='meridian-relay-iframe';const pl=isSF?{type:'MERIDIAN_CASE_START',caseNumber:cN,accountId:aN||null,caseType:typeVal||null,caseSubtype:subtypeVal||null,timestamp:Date.now()}:{type:'MERIDIAN_PROCESS_START',pageUrl:window.location.href,timestamp:Date.now()};let rf=document.getElementById(RELAY_ID);if(rf){rf.contentWindow.postMessage(pl,HOST)}else{rf=document.createElement('iframe');rf.id=RELAY_ID;rf.src=HOST+'/relay.html?t='+Date.now();rf.style.cssText='display:none;position:fixed;width:0;height:0;border:none;z-index:-1';document.body.appendChild(rf);function om(e){if(e.origin!==HOST)return;if(e.data&&e.data.type==='MERIDIAN_RELAY_READY'){window.removeEventListener('message',om);rf.contentWindow.postMessage(pl,HOST)}}window.addEventListener('message',om);setTimeout(function(){window.removeEventListener('message',om);try{rf.contentWindow.postMessage(pl,HOST)}catch(e){}},800)}try{const ex=document.getElementById('meridian-toast');if(ex)ex.remove();const t=document.createElement('div');t.id='meridian-toast';t.textContent=isSF?'✓ Meridian — Case '+cN:'✓ Meridian — Process timer started';t.style.cssText='position:fixed;bottom:24px;right:24px;background:#003087;color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;font-family:"Segoe UI",sans-serif;z-index:2147483647;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.3);border-left:3px solid #E8540A;transition:opacity 300ms';document.body.appendChild(t);setTimeout(function(){t.style.opacity='0'},2200);setTimeout(function(){t.remove()},2500)}catch(e){}})();
```

> **Important:** The `HOST` value in the minified bookmarklet above is set to `https://meridian.vercel.app`. Update it to match the actual Vercel deploy URL before distributing to agents.

## Development / localhost testing

For local testing, use a version with `HOST='http://localhost:5173'`. Do not check that version in — the production bookmarklet above is the canonical reference.
