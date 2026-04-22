// meridian-trigger.js
// This code is fetched by meridian-relay.html and executed on the
// host page via new Function('MERIDIAN_PAYLOAD', code)(payload).
//
// MERIDIAN_PAYLOAD is injected by the bookmarklet and contains:
//   { userId, relayFrame }
//   - userId: the Meridian user's UUID, baked into the bookmarklet at onboarding
//   - relayFrame: reference to the relay iframe's contentWindow
//
// Flow:
// 1. Detects whether the current page is Salesforce
// 2. On non-SF: shows a toast and returns
// 3. On SF: asks relay to load ct-widget.js (widget scrapes case on demand)

(function() {
  var userId = MERIDIAN_PAYLOAD.userId;
  var relay = MERIDIAN_PAYLOAD.relayFrame;

  // ── Shadow-DOM walker ────────────────────────────────────────────────────
  function walkShadow(root, visitor) {
    var stack = [root];
    while (stack.length) {
      var node = stack.pop();
      visitor(node);
      if (node.shadowRoot) stack.push(node.shadowRoot);
      var children = node.childNodes || [];
      for (var ci = children.length - 1; ci >= 0; ci--) {
        stack.push(children[ci]);
      }
    }
  }

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

  // ── List-view detection ──────────────────────────────────────────────────
  var isListView = window.location.pathname.includes('/lightning/o/Case/list');
  if (!isListView) {
    var trs = document.querySelectorAll('tr[data-row-key-value]');
    for (var i = 0; i < trs.length; i++) {
      var kv = trs[i].getAttribute('data-row-key-value');
      if (kv && kv.startsWith('500')) { isListView = true; break; }
    }
  }

  if (isListView) {
    handleListViewContext(relay, userId, showToast);
    return;
  }

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

  // ── collectSelectedCases ─────────────────────────────────────────────────
  function collectSelectedCases() {
    var cases = [];
    walkShadow(document.documentElement, function(node) {
      if (!node.getAttribute) return;
      var kv = node.getAttribute('data-row-key-value');
      if (!kv || !kv.startsWith('500')) return;
      var checkbox = node.querySelector('input[type="checkbox"]');
      if (!checkbox || !checkbox.checked) return;
      var caseNumber = null;
      var primary = node.querySelector('th[data-label="Case Number"] span[title]');
      if (primary) {
        caseNumber = primary.getAttribute('title');
      } else {
        var spans = node.querySelectorAll('span[title]');
        for (var si = 0; si < spans.length; si++) {
          var t = spans[si].getAttribute('title');
          if (t && /^\d{8,}$/.test(t)) { caseNumber = t; break; }
        }
      }
      if (caseNumber) cases.push({ case_number: caseNumber, sf_case_id: kv });
    });
    return cases;
  }

  // ── List-view handler ────────────────────────────────────────────────────
  function handleListViewContext(relay, userId, showToast) {
    var cases = collectSelectedCases();
    if (!cases.length) {
      showToast('Meridian: Select cases in the list, then click again.', 'info');
      return;
    }

    var id = 'mt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    var payload = {
      user_id: userId,
      type: 'MERIDIAN_MASS_RECLASS',
      action: 'mass_reclass',
      page_url: window.location.href,
      case_number: JSON.stringify(cases)
    };

    function onMassReclassResponse(e) {
      if (!e.data || e.data.relay !== 'MERIDIAN_TRIGGER_RESPONSE') return;
      if (e.data.id !== id) return;
      window.removeEventListener('message', onMassReclassResponse);
      if (e.data.success) {
        showToast('Meridian: Opened with ' + cases.length + ' cases', 'success');
      } else {
        showToast('Meridian: Failed — ' + (e.data.error || 'unknown error'), 'error');
      }
    }
    window.addEventListener('message', onMassReclassResponse);

    relay.postMessage({
      relay: 'MERIDIAN_TRIGGER',
      id: id,
      action: 'SUPABASE_INSERT_TRIGGER',
      payload: payload
    }, '*');

    setTimeout(function() {
      window.removeEventListener('message', onMassReclassResponse);
    }, 10000);
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
