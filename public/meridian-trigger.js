// meridian-trigger.js
// This code is fetched by meridian-relay.html and executed on the
// host page via new Function('MERIDIAN_PAYLOAD', code)(payload).
//
// MERIDIAN_PAYLOAD is injected by the bookmarklet and contains:
//   { userId, relayFrame, mode }
//   - userId: the Meridian user's UUID, baked into the bookmarklet at onboarding
//   - relayFrame: reference to the relay iframe's contentWindow
//   - mode: 'single' or 'mass', detected at trigger time and injected before widget load
//
// Flow:
// 1. Detects whether the current page is Salesforce
// 2. On non-SF: shows a toast and returns
// 3. On SF: detects mode (single/mass), asks relay to load ct-widget.js

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

  // ── Mode detection ───────────────────────────────────────────────────────
  function detectMode() {
    // Single-case record page: URL like /lightning/r/Case/500.../view
    if (window.location.pathname.indexOf('/lightning/r/Case/') === 0) {
      return 'single';
    }
    // List view: URL like /lightning/o/Case/list OR DOM has checked case rows
    if (window.location.pathname.indexOf('/lightning/o/Case/list') === 0) {
      return 'mass';
    }
    // Fallback: if walkShadow finds any tr[data-row-key-value^="500"], treat as mass
    var foundCaseRow = false;
    try {
      walkShadow(document.documentElement, function (n) {
        if (foundCaseRow) return;
        if (!n.getAttribute) return;
        var kv = n.getAttribute('data-row-key-value');
        if (kv && kv.indexOf('500') === 0) foundCaseRow = true;
      });
    } catch (e) {}
    return foundCaseRow ? 'mass' : 'single';
  }

  // ── Ask relay to fetch ct-widget.js ─────────────────────────────────────
  var msgId = 'mt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  function onRelayResponse(e) {
    if (!e.data || e.data.relay !== 'MERIDIAN_TRIGGER_RESPONSE') return;
    if (e.data.id !== msgId) return;
    window.removeEventListener('message', onRelayResponse);

    if (e.data.success && e.data.data && e.data.data.code) {
      try {
        MERIDIAN_PAYLOAD.mode = detectMode();
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
