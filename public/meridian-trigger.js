// meridian-trigger.js
// This code is fetched by meridian-relay.html and executed on the
// Salesforce page via new Function('MERIDIAN_PAYLOAD', code)(payload).
//
// MERIDIAN_PAYLOAD is injected by the bookmarklet and contains:
//   { userId, token, relayFrame }
//   - userId: read by the relay iframe from Meridian's Supabase localStorage session
//   - token: read by the relay iframe from Meridian's Supabase localStorage session
//   - relayFrame: reference to the relay iframe's contentWindow (set by bookmarklet)
//
// The bookmarklet itself is credential-free. Auth comes from the relay iframe
// which shares origin with meridian-hlag.com and can read the Supabase session.
//
// This script:
// 1. Detects if we're on a Salesforce case page (8+ digit number in title)
// 2. Extracts case metadata from the page if available
// 3. Sends a SUPABASE_INSERT_TRIGGER message to the relay iframe
// 4. The relay iframe inserts into pending_triggers (Supabase)
// 5. The Meridian app receives it via Realtime subscription
// 6. Shows a toast on the SF page confirming the action

(function() {
  var userId = MERIDIAN_PAYLOAD.userId;
  var token = MERIDIAN_PAYLOAD.token;
  var relay = MERIDIAN_PAYLOAD.relayFrame;

  if (!userId || !token || !relay) {
    showToast('Meridian: Not logged in. Open meridian-hlag.com and sign in first.', 'error');
    return;
  }

  // ── Detect Salesforce case ──────────────────────────────────────────────
  var title = document.title || '';
  var caseMatch = title.match(/(\d{8,})/);

  var triggerType, body;

  if (caseMatch) {
    // Salesforce case page
    var caseNumber = caseMatch[1];

    // Try to extract account ID from the page
    var accountId = extractAccountId();

    // Try to extract type/subtype from page
    var typeInfo = extractCaseTypeSubtype();

    triggerType = 'MERIDIAN_CASE_START';
    body = {
      user_id: userId,
      type: triggerType,
      case_number: caseNumber,
      account_id: accountId || null,
      case_type: typeInfo.type || null,
      case_subtype: typeInfo.subtype || null,
    };

    showToast('Meridian: Starting case ' + caseNumber + '...', 'info');
  } else {
    // Non-Salesforce page → process trigger
    triggerType = 'MERIDIAN_PROCESS_START';
    body = {
      user_id: userId,
      type: triggerType,
      page_url: window.location.href,
    };

    showToast('Meridian: Starting process timer...', 'info');
  }

  // ── Send to relay iframe ────────────────────────────────────────────────
  var msgId = 'mt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  function onRelayResponse(e) {
    if (!e.data || e.data.relay !== 'MERIDIAN_TRIGGER_RESPONSE') return;
    if (e.data.id !== msgId) return;
    window.removeEventListener('message', onRelayResponse);

    if (e.data.success) {
      if (triggerType === 'MERIDIAN_CASE_START') {
        showToast('Meridian: Case ' + body.case_number + ' sent!', 'success');
      } else {
        showToast('Meridian: Process timer started!', 'success');
      }
    } else {
      showToast('Meridian: Failed — ' + (e.data.error || 'unknown error'), 'error');
    }
  }
  window.addEventListener('message', onRelayResponse);

  relay.postMessage({
    relay: 'MERIDIAN_TRIGGER',
    id: msgId,
    action: 'SUPABASE_INSERT_TRIGGER',
    payload: {
      token: token,
      body: body,
    }
  }, '*');

  // Timeout — clean up listener if no response in 10s
  setTimeout(function() {
    window.removeEventListener('message', onRelayResponse);
  }, 10000);

  // ── Page scraping helpers ───────────────────────────────────────────────

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

  // ── Toast UI ────────────────────────────────────────────────────────────

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
