# CC Prompt: Bookmarklet Direct-Fetch for Non-Salesforce Pages

## Goal

Fix the bookmarklet so that clicking it on a non-Salesforce page (OWA, Teams, any browser tab) triggers `MERIDIAN_PROCESS_START` **without** going through the relay iframe hosted on `meridian-hlag.com`. Currently the bookmarklet always loads the relay regardless of page, which means Zscaler can block MPL triggers on corporate-filtered pages.

**SF pages** (where `isSF === true`) must continue using the relay exactly as today — do not touch that path.

---

## Background

The bookmarklet today always does this, regardless of page:
1. Creates a hidden `<iframe>` loading `{HOST}/meridian-relay.html?load=trigger`
2. Relay fetches `/meridian-trigger.js` and postMessages the code back
3. Bookmarklet runs `new Function('MERIDIAN_PAYLOAD', code)(pl)`
4. `meridian-trigger.js` calls `window.open(HOST, 'meridian-app')` to open/focus the Meridian tab, then postMessages the payload after 800ms
5. `App.jsx` receives via `window.addEventListener('message', ...)`

The relay is only necessary on Salesforce because SF's `connect-src` CSP blocks direct fetch calls. On every other page, the bookmarklet can directly:
1. `window.open(HOST, 'meridian-app')` to open/focus the Meridian tab
2. After a short delay, `postMessage` the payload directly to that window reference
3. No relay. No `meridian-hlag.com` touch. No Zscaler risk.

---

## What to change

### File: `BOOKMARKLET.md`

The minified bookmarklet string at the bottom of this file is the canonical reference. Update it to include the `isSF` branch described below.

The readable (pre-minification) logic for the non-SF path should be:

```js
if (isSF) {
  // EXISTING PATH — relay iframe — do not touch
  const rf = document.createElement('iframe');
  rf.id = RELAY_ID;
  rf.src = HOST + '/meridian-relay.html?load=trigger&t=' + Date.now();
  rf.style.cssText = 'display:none;position:fixed;width:0;height:0;border:none;z-index:-1';
  document.body.appendChild(rf);
  window.addEventListener('message', function h(e) {
    if (e.data && e.data.meridianTriggerCode) {
      window.removeEventListener('message', h);
      rf.remove();
      try { (new Function('MERIDIAN_PAYLOAD', e.data.meridianTriggerCode))(pl); } 
      catch(err) { console.error('[Meridian] trigger exec error:', err); }
    }
    if (e.data && e.data.meridianTriggerError) {
      window.removeEventListener('message', h);
      rf.remove();
      console.error('[Meridian] relay error:', e.data.meridianTriggerError);
    }
  });
} else {
  // NEW PATH — direct postMessage to Meridian tab — no relay needed
  const meridianTab = window.open(HOST, 'meridian-app');
  // Give the tab a moment to be ready (either focusing an existing tab or loading fresh)
  setTimeout(function() {
    if (meridianTab) {
      meridianTab.postMessage(pl, HOST);
    }
  }, 800);
}
```

### Payload for non-SF path

The `pl` object for the non-SF direct path is already correct — it uses `type: 'MERIDIAN_PROCESS_START'` when `isSF` is false. No change needed to the payload construction logic.

### Toast

The existing toast logic at the bottom of the bookmarklet should remain unchanged — it fires for both paths.

---

## What NOT to change

- `public/meridian-relay.html` — DO NOT TOUCH
- `public/meridian-trigger.js` — DO NOT TOUCH (only used by SF relay path)
- `src/App.jsx` message listener — already handles both `MERIDIAN_CASE_START` and `MERIDIAN_PROCESS_START` types correctly
- The SF relay path in the bookmarklet — must remain identical to today

---

## Acceptance criteria

1. Clicking bookmarklet on OWA/non-SF page → toast shows "✓ Meridian — Process timer started" → Meridian tab opens/focuses → `MERIDIAN_PROCESS_START` message received → MPL session begins in PiP widget
2. Clicking bookmarklet on a Salesforce case page → toast shows case number → relay path fires → CT session begins (no regression)
3. `BOOKMARKLET.md` minified string is updated to reflect the new dual-path logic
4. `npm run build` passes

---

## Notes

- `HOST` in the non-SF path should be set to `'https://meridian-ashen-one.vercel.app'`. The SF/relay path keeps using `'https://meridian-hlag.com'` since that's already confirmed working. Document both URLs in `BOOKMARKLET.md` so the switch to the custom domain is a one-line change once IT whitelists it.
- The `window.open(..., 'meridian-app')` named target means repeated bookmarklet clicks will focus the same tab rather than opening new ones — this is correct behavior.
- `meridian-ashen-one.vercel.app` is the current live deploy URL (visible in the repo's About section). `meridian-hlag.com` is the IT-managed custom domain used by the SF relay path.
