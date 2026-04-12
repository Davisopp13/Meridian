// ct-widget.js
// Vanilla JS CT overlay widget — injected into Salesforce pages via meridian-trigger.js
// Received via: new Function('MERIDIAN_PAYLOAD', code)(payload)
// MERIDIAN_PAYLOAD = { userId, relayFrame, caseNumber, caseType, caseSubtype, accountId }

(function () {

  // ── Double-injection guard ──────────────────────────────────────────────
  var existingHost = document.getElementById('meridian-ct-widget');
  if (existingHost) {
    // Widget already on page — toggle visibility, refresh case data if new payload
    if (existingHost.style.display === 'none') {
      existingHost.style.display = '';
      if (existingHost._meridianRefresh) {
        existingHost._meridianRefresh(MERIDIAN_PAYLOAD);
      }
    } else {
      existingHost.style.display = 'none';
    }
    return;
  }

  // ── Design tokens ───────────────────────────────────────────────────────
  var T = {
    bg:       '#1a1a2e',
    bgDeep:   '#0f0f1e',
    blue:     '#003087',
    orange:   '#E8540A',
    resolved: '#22c55e',
    reclass:  '#ef4444',
    calls:    '#0d9488',
    awaiting: '#f59e0b',
    textPri:  'rgba(255,255,255,0.92)',
    textSec:  'rgba(255,255,255,0.55)',
    textDim:  'rgba(255,255,255,0.3)',
    border:   'rgba(255,255,255,0.12)',
    divider:  'rgba(255,255,255,0.08)',
    font:     '"Segoe UI", system-ui, -apple-system, sans-serif',
  };

  // ── State ────────────────────────────────────────────────────────────────
  var state = {
    userId:       MERIDIAN_PAYLOAD.userId       || '',
    relay:        MERIDIAN_PAYLOAD.relayFrame    || null,
    caseNumber:   MERIDIAN_PAYLOAD.caseNumber    || '',
    caseType:     MERIDIAN_PAYLOAD.caseType      || '',
    caseSubtype:  MERIDIAN_PAYLOAD.caseSubtype   || '',
    accountId:    MERIDIAN_PAYLOAD.accountId     || '',
    elapsed:      0,
    timerRunning: false,
    timerId:      null,
    isMinimized:  false,
    stats:        { resolved: 0, reclass: 0, calls: 0 },
    toastMsg:     null,
    toastTimer:   null,
  };

  // ── Host element + Shadow DOM ────────────────────────────────────────────
  var host = document.createElement('div');
  host.id = 'meridian-ct-widget';

  // Restore saved position (left/bottom) if available
  var savedPos = null;
  try { savedPos = JSON.parse(localStorage.getItem('meridian-ct-pos')); } catch (e) {}

  if (savedPos && typeof savedPos.left !== 'undefined') {
    host.style.cssText =
      'position:fixed;bottom:' + savedPos.bottom + 'px;left:' + savedPos.left + 'px;z-index:2147483647;';
  } else {
    host.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;';
  }

  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: 'closed' });

  // ── Helpers ──────────────────────────────────────────────────────────────
  function fmtTime(secs) {
    return (
      String(Math.floor(secs / 60)).padStart(2, '0') +
      ':' +
      String(secs % 60).padStart(2, '0')
    );
  }

  function showWidgetToast(msg) {
    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastMsg = msg;
    render();
    state.toastTimer = setTimeout(function () {
      state.toastMsg = null;
      render();
    }, 2000);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    var caseLabel  = state.caseNumber ? state.caseNumber : '\u2014';
    var timerLabel = fmtTime(state.elapsed);

    // Header bar (always visible)
    var headerHtml =
      '<div id="ct-header" style="' +
        'display:flex;align-items:center;gap:6px;' +
        'height:48px;padding:0 8px;' +
        'background:' + T.bgDeep + ';' +
        'cursor:move;flex-shrink:0;' +
      '">' +
        // M logo mark
        '<div style="' +
          'width:24px;height:24px;flex-shrink:0;' +
          'background:' + T.blue + ';border-radius:5px;' +
          'display:flex;align-items:center;justify-content:center;' +
          'color:' + T.orange + ';font:800 12px/1 ' + T.font + ';' +
        '">M</div>' +
        // Case number
        '<span style="' +
          'flex:1;min-width:0;' +
          'color:' + T.orange + ';' +
          'font:700 13px/1 "Courier New",monospace;' +
          'letter-spacing:0.05em;' +
          'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
        '">' + caseLabel + '</span>' +
        // Timer display
        '<span style="' +
          'flex-shrink:0;' +
          'color:' + T.textPri + ';' +
          'font:600 13px/1 "Courier New",monospace;' +
          'letter-spacing:0.05em;' +
        '">' + timerLabel + '</span>' +
        // Minimize toggle
        '<button data-action="minimize" style="' +
          'width:22px;height:22px;flex-shrink:0;' +
          'border:none;border-radius:4px;' +
          'background:rgba(255,255,255,0.06);' +
          'color:' + T.textSec + ';' +
          'font:700 12px/22px ' + T.font + ';' +
          'cursor:pointer;padding:0;' +
          'display:flex;align-items:center;justify-content:center;' +
        '">' + (state.isMinimized ? '\u25b2' : '\u25bc') + '</button>' +
        // Close button
        '<button data-action="close" style="' +
          'width:22px;height:22px;flex-shrink:0;' +
          'border:none;border-radius:4px;' +
          'background:rgba(255,255,255,0.06);' +
          'color:' + T.textSec + ';' +
          'font:700 15px/22px ' + T.font + ';' +
          'cursor:pointer;padding:0;' +
          'display:flex;align-items:center;justify-content:center;' +
        '">\u00d7</button>' +
      '</div>';

    // Action buttons (hidden when minimized)
    var actionsHtml = state.isMinimized ? '' :
      '<div style="' +
        'display:flex;gap:4px;padding:6px 8px 4px 8px;' +
        'border-top:1px solid ' + T.divider + ';' +
      '">' +
        '<button data-action="resolve" style="' +
          'flex:1;height:28px;border:none;border-radius:6px;' +
          'background:' + T.resolved + ';color:#fff;' +
          'font:700 11px/1 ' + T.font + ';cursor:pointer;letter-spacing:0.02em;' +
        '">Resolved</button>' +
        '<button data-action="reclass" style="' +
          'flex:1;height:28px;border:none;border-radius:6px;' +
          'background:' + T.reclass + ';color:#fff;' +
          'font:700 11px/1 ' + T.font + ';cursor:pointer;letter-spacing:0.02em;' +
        '">Reclass</button>' +
        '<button data-action="call" style="' +
          'flex:1;height:28px;border:none;border-radius:6px;' +
          'background:' + T.calls + ';color:#fff;' +
          'font:700 11px/1 ' + T.font + ';cursor:pointer;letter-spacing:0.02em;' +
        '">Call</button>' +
        '<button data-action="awaiting" style="' +
          'flex:1;height:28px;border:none;border-radius:6px;' +
          'background:' + T.awaiting + ';color:#fff;' +
          'font:700 11px/1 ' + T.font + ';cursor:pointer;letter-spacing:0.02em;' +
        '">Await</button>' +
      '</div>';

    // Stats row (hidden when minimized)
    var statsHtml = state.isMinimized ? '' :
      '<div style="' +
        'display:flex;align-items:center;justify-content:center;gap:6px;' +
        'padding:4px 8px 6px 8px;' +
        'font:11px/1 ' + T.font + ';color:' + T.textSec + ';' +
      '">' +
        '<span style="color:' + T.resolved + ';font-weight:700;">' + state.stats.resolved + '</span>' +
        '<span>Res</span>' +
        '<span style="color:' + T.divider + ';margin:0 1px;">|</span>' +
        '<span style="color:' + T.reclass + ';font-weight:700;">' + state.stats.reclass + '</span>' +
        '<span>Rec</span>' +
        '<span style="color:' + T.divider + ';margin:0 1px;">|</span>' +
        '<span style="color:' + T.calls + ';font-weight:700;">' + state.stats.calls + '</span>' +
        '<span>Call</span>' +
      '</div>';

    // Toast banner (when present, replaces stats row)
    var toastHtml = (state.toastMsg && !state.isMinimized)
      ? '<div style="' +
          'padding:5px 10px;' +
          'background:rgba(34,197,94,0.15);' +
          'border-top:1px solid rgba(34,197,94,0.3);' +
          'color:rgba(255,255,255,0.85);' +
          'font:11px/1.4 ' + T.font + ';text-align:center;' +
        '">' + state.toastMsg + '</div>'
      : '';

    shadow.innerHTML =
      '<div style="' +
        'width:320px;' +
        'background:' + T.bg + ';' +
        'border:1px solid ' + T.border + ';' +
        'border-radius:12px;' +
        'box-shadow:0 8px 32px rgba(0,0,0,0.5);' +
        'overflow:hidden;' +
        'user-select:none;' +
        'display:flex;flex-direction:column;' +
      '">' +
        headerHtml +
        actionsHtml +
        (state.toastMsg ? toastHtml : statsHtml) +
      '</div>';
  }

  // Initial render
  render();

  // ── Expose refresh hook for double-injection guard ────────────────────────
  host._meridianRefresh = function (payload) {
    if (payload.caseNumber && payload.caseNumber !== state.caseNumber) {
      state.caseNumber  = payload.caseNumber  || state.caseNumber;
      state.caseType    = payload.caseType    || '';
      state.caseSubtype = payload.caseSubtype || '';
      state.accountId   = payload.accountId   || '';
      state.elapsed     = 0;
      // Timer restart handled by Task 3
    }
    render();
  };

  // ── Event delegation on shadow root ──────────────────────────────────────
  shadow.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');

    if (action === 'minimize') {
      state.isMinimized = !state.isMinimized;
      render();
    } else if (action === 'close') {
      if (state.timerId) clearInterval(state.timerId);
      host.remove();
    } else if (action === 'resolve') {
      // Wired in Task 5 — handleResolved()
    } else if (action === 'reclass') {
      // Wired in Task 5 — handleReclass()
    } else if (action === 'call') {
      // Wired in Task 5 — handleCall()
    } else if (action === 'awaiting') {
      // Wired in Task 3 — pauses timer
    }
  });

  // ── Draggable header ─────────────────────────────────────────────────────
  var dragging = false;
  var dragStartX, dragStartY, hostStartLeft, hostStartBottom;

  shadow.addEventListener('mousedown', function (e) {
    var header = shadow.querySelector('#ct-header');
    if (!header || !header.contains(e.target)) return;
    if (e.target.closest('[data-action]')) return;   // ignore button clicks

    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    var rect = host.getBoundingClientRect();
    hostStartLeft   = rect.left;
    hostStartBottom = window.innerHeight - rect.bottom;

    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - dragStartX;
    var dy = e.clientY - dragStartY;

    var newLeft   = Math.max(0, Math.min(window.innerWidth  - 320, hostStartLeft + dx));
    var newBottom = Math.max(0, hostStartBottom - dy);

    host.style.right  = 'auto';
    host.style.left   = newLeft   + 'px';
    host.style.bottom = newBottom + 'px';

    try {
      localStorage.setItem('meridian-ct-pos',
        JSON.stringify({ left: newLeft, bottom: newBottom }));
    } catch (err) {}
  });

  document.addEventListener('mouseup', function () {
    dragging = false;
  });

})();
