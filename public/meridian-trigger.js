// meridian-trigger.js
// This code is fetched by meridian-relay.html and executed on the
// host page via new Function('MERIDIAN_PAYLOAD', code)(payload).
//
// MERIDIAN_PAYLOAD is injected by the bookmarklet and contains:
//   { userId, relayFrame }
//   - userId: the Meridian user's UUID, baked into the bookmarklet at onboarding
//   - relayFrame: reference to the relay iframe's contentWindow (null on non-SF pages)
//
// On Salesforce pages the relay iframe proxies Supabase inserts (SF CSP blocks
// direct fetch to external domains). On all other pages we call Supabase REST
// directly — no relay needed.
//
// Flow:
// 1. Detects whether the current page is Salesforce
// 2. Detects if we're on a Salesforce case page (8+ digit number in title)
// 3. Extracts case metadata from the page if available
// 4a. [SF]     Sends a SUPABASE_INSERT_TRIGGER message to the relay iframe
// 4b. [non-SF] Calls Supabase REST directly via fetch()
// 5. The Meridian app receives the pending_triggers row via Realtime subscription
// 6. Shows a toast on the page confirming the action

(function() {
  var SUPABASE_URL = 'https://wluynppocsoqjdbmwass.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsdXlucHBvY3NvcWpkYm13YXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDU4NzIsImV4cCI6MjA4ODIyMTg3Mn0.x9-t_038hz4eJUciA1F9-DWE8UN_V58KE0i43cpOAMk';

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

  if (isSalesforce && !relay) {
    showToast('Meridian: Missing relay. Try re-installing the bookmarklet from Meridian.', 'error');
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

  // ── Send trigger ────────────────────────────────────────────────────────
  if (isSalesforce) {
    // SF path: Salesforce CSP blocks direct fetch to Supabase, use relay iframe
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
        body: body,
      }
    }, '*');

    // Timeout — clean up listener if no response in 10s
    setTimeout(function() {
      window.removeEventListener('message', onRelayResponse);
    }, 10000);
  } else {
    // Non-SF path: call Supabase REST directly (no relay needed)
    directInsert(body).then(function() {
      if (triggerType === 'MERIDIAN_CASE_START') {
        showToast('Meridian: Case ' + body.case_number + ' sent!', 'success');
      } else {
        showToast('Meridian: Process timer started!', 'success');
      }
    }).catch(function(err) {
      console.error('[Meridian]', err);
      showToast('Meridian: Failed — ' + err.message, 'error');
    });
  }

  async function directInsert(payload) {
    var res = await fetch(SUPABASE_URL + '/rest/v1/pending_triggers', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      var err = await res.text();
      throw new Error('Supabase insert failed: ' + res.status + ' ' + err);
    }
  }

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
