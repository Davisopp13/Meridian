// meridian-trigger.js
// This code is fetched by meridian-relay.html and executed on the
// host page via new Function('MERIDIAN_PAYLOAD', code)(payload).
//
// MERIDIAN_PAYLOAD is injected by the bookmarklet and contains:
//   { userId, relayFrame }
//   - userId: the Meridian user's UUID, baked into the bookmarklet at onboarding
//   - relayFrame: reference to the relay iframe's contentWindow (null on non-SF pages)
//
// Flow:
// 1. Detects whether the current page is Salesforce
// 2. On non-SF: shows a toast and returns
// 3. On SF: detects if we're on a case page (8+ digit number in title)
// 4. On SF + no case: shows a toast and returns
// 5. On SF + case: scrapes case metadata, asks relay to load ct-widget.js,
//    executes the widget with extended MERIDIAN_PAYLOAD

(function() {
  var userId = MERIDIAN_PAYLOAD.userId;
  var relay = MERIDIAN_PAYLOAD.relayFrame;

  var isSalesforce =
    window.location.hostname.includes('force.com') ||
    window.location.hostname.includes('salesforce.com') ||
    window.location.hostname.includes('lightning.com');

  if (!userId) {
    showToast('Meridian: Missing config. Try re-installing the bookmarklet from Meridian.', 'error');
    return;
  }

  // ── Non-SF path ─────────────────────────────────────────────────────────
  if (!isSalesforce) {
    showToast('Meridian: Open a Salesforce case page to use Case Tracker', 'info');
    return;
  }

  // ── SF path — relay required ─────────────────────────────────────────────
  if (!relay) {
    showToast('Meridian: Missing relay. Try re-installing the bookmarklet from Meridian.', 'error');
    return;
  }

  // ── Detect Salesforce case ───────────────────────────────────────────────
  var title = document.title || '';
  var caseMatch = title.match(/(\d{8,})/);

  if (!caseMatch) {
    showToast('Meridian: No case detected on this page', 'info');
    return;
  }

  var caseNumber = caseMatch[1];
  var accountId = extractAccountId();
  var typeInfo = extractCaseTypeSubtype();

  // Extend MERIDIAN_PAYLOAD with case data so ct-widget.js can read it
  MERIDIAN_PAYLOAD.caseNumber = caseNumber;
  MERIDIAN_PAYLOAD.caseType = typeInfo.type || '';
  MERIDIAN_PAYLOAD.caseSubtype = typeInfo.subtype || '';
  MERIDIAN_PAYLOAD.accountId = accountId || '';

  // ── Ask relay to fetch ct-widget.js ─────────────────────────────────────
  var msgId = 'mt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  function onRelayResponse(e) {
    if (!e.data || e.data.relay !== 'MERIDIAN_TRIGGER_RESPONSE') return;
    if (e.data.id !== msgId) return;
    window.removeEventListener('message', onRelayResponse);

    if (e.data.success && e.data.data && e.data.data.code) {
      try {
        (new Function('MERIDIAN_PAYLOAD', e.data.data.code))(MERIDIAN_PAYLOAD);
      } catch (err) {
        showToast('Meridian: Widget error — ' + err.message, 'error');
        console.error('[Meridian] Widget execution error:', err);
      }
    } else {
      showToast('Meridian: Failed to load widget — ' + (e.data.error || 'unknown error'), 'error');
    }
  }
  window.addEventListener('message', onRelayResponse);

  relay.postMessage({
    relay: 'MERIDIAN_TRIGGER',
    id: msgId,
    action: 'FETCH_CODE',
    payload: { file: 'ct-widget.js' }
  }, '*');

  // Clean up listener if no response in 10s
  setTimeout(function() {
    window.removeEventListener('message', onRelayResponse);
  }, 10000);

  // ── Page scraping helpers ────────────────────────────────────────────────

  function extractAccountId() {
    try {
      // Look for the Account ID in common Salesforce Lightning locations
      // 1. URL hash fragment often has accountId
      var hash = window.location.hash || '';
      var accMatch = hash.match(/001[A-Za-z0-9]{12,15}/);
      if (accMatch) return accMatch[0];

      // 2. Look in visible text on the page
      var allText = document.body.innerText || '';
      var accTextMatch = allText.match(/001[A-Za-z0-9]{12,15}/);
      if (accTextMatch) return accTextMatch[0];

      return null;
    } catch (e) {
      return null;
    }
  }

  function extractCaseTypeSubtype() {
    try {
      // Look for Type and Subtype fields in Lightning record detail
      var result = { type: null, subtype: null };

      // Lightning uses span[data-output-element-id] or force-record-layout
      var labels = document.querySelectorAll('span.test-id__field-label, span[class*="FieldLabel"]');
      labels.forEach(function(label) {
        var text = (label.textContent || '').trim().toLowerCase();
        var valueEl = label.closest('.slds-form-element')?.querySelector('.slds-form-element__control');
        var value = valueEl ? (valueEl.textContent || '').trim() : '';
        if (!value) return;

        if (text === 'type' || text === 'case type') {
          result.type = value;
        } else if (text === 'subtype' || text === 'case subtype' || text === 'sub type' || text === 'sub-type') {
          result.subtype = value;
        }
      });

      return result;
    } catch (e) {
      return { type: null, subtype: null };
    }
  }

  // ── Toast UI ─────────────────────────────────────────────────────────────

  function showToast(message, level) {
    try {
      var existing = document.getElementById('meridian-toast');
      if (existing) existing.remove();

      var colors = {
        success: { bg: '#065f46', border: '#10b981' },
        error:   { bg: '#7f1d1d', border: '#ef4444' },
        info:    { bg: '#1e3a5f', border: '#3b82f6' },
      };
      var c = colors[level] || colors.info;

      var toast = document.createElement('div');
      toast.id = 'meridian-toast';
      toast.textContent = message;
      toast.style.cssText =
        'position:fixed;bottom:24px;right:24px;z-index:2147483647;' +
        'padding:12px 20px;border-radius:8px;font:14px/1.4 -apple-system,sans-serif;' +
        'color:#fff;background:' + c.bg + ';border:1px solid ' + c.border + ';' +
        'box-shadow:0 4px 12px rgba(0,0,0,0.3);opacity:0;transition:opacity 0.3s ease;' +
        'pointer-events:none;max-width:360px;';

      document.body.appendChild(toast);
      requestAnimationFrame(function() { toast.style.opacity = '1'; });

      var duration = level === 'error' ? 5000 : 3000;
      setTimeout(function() {
        toast.style.opacity = '0';
        setTimeout(function() { toast.remove(); }, 300);
      }, duration);
    } catch (e) {
      // Toast is non-critical — fail silently
    }
  }
})();
