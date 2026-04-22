// ct-widget.js
// Vanilla JS CT overlay widget — injected into Salesforce pages via meridian-trigger.js
// Received via: new Function('MERIDIAN_PAYLOAD', code)(payload)
// MERIDIAN_PAYLOAD = { userId, relayFrame, caseNumber, caseType, caseSubtype, accountId, sfCaseId }

(function () {

  // Inlined Meridian icon (48x48 PNG → base64) so the widget stays
  // self-contained on Salesforce pages where CSP blocks cross-origin
  // image loads. Source: public/meridian-icon-512.png, downscaled.
  var MERIDIAN_ICON_B64 = 'data:image/png;base64,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';

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
    userId:       MERIDIAN_PAYLOAD.userId    || '',
    relay:        MERIDIAN_PAYLOAD.relayFrame || null,
    caseNumber:   '',
    caseType:     '',
    caseSubtype:  '',
    accountId:    '',
    sfCaseId:     '',
    sessionId:    '',
    elapsed:      0,
    timerRunning: false,
    timerId:      null,
    isAwaiting:   false,
    isMinimized:  false,
    stats:        { resolved: 0, reclass: 0, calls: 0 },
    toastMsg:     null,
    toastTimer:   null,
  };

  // ── Host element + Shadow DOM ────────────────────────────────────────────
  var host = document.createElement('div');
  host.id = 'meridian-ct-widget';

  // Restore saved position (left/bottom) if available, with viewport sanity check.
  // If the saved position is outside the current viewport (e.g. user changed
  // monitors, resolution, or zoom between sessions), fall back to default.
  var savedPos = null;
  try { savedPos = JSON.parse(localStorage.getItem('meridian-ct-pos')); } catch (e) {}

  // Viewport sanity: the widget is ~60px tall and anywhere from 320px (minimized)
  // to ~700px wide. Require at least 100px of the widget's footprint to be in view
  // on each axis, or fall back. Generous margins account for different widget states.
  function positionIsVisible(pos) {
    if (!pos || typeof pos.left === 'undefined' || typeof pos.bottom === 'undefined') return false;
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var horizontallyVisible = pos.left >= -200 && pos.left <= vw - 100;
    var verticallyVisible = pos.bottom >= 0 && pos.bottom <= vh - 40;
    return horizontallyVisible && verticallyVisible;
  }

  if (savedPos && positionIsVisible(savedPos)) {
    host.style.cssText =
      'position:fixed;bottom:' + savedPos.bottom + 'px;left:' + savedPos.left + 'px;z-index:2147483647;';
  } else {
    // Either no saved position, or saved position is off-screen — use default.
    // If savedPos exists but failed the check, clear it so we don't re-test every load.
    if (savedPos) {
      try { localStorage.removeItem('meridian-ct-pos'); } catch (e) {}
    }
    host.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;';
  }

  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: 'closed' });

  // ── Timer ────────────────────────────────────────────────────────────────
  function tick() {
    state.elapsed++;
    // Update timer display directly — avoid full re-render every second
    var timerEl = shadow.querySelector('#ct-timer');
    if (timerEl) timerEl.textContent = fmtTime(state.elapsed);
  }

  function startTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(tick, 1000);
    state.timerRunning = true;
  }

  function stopTimer() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    state.timerRunning = false;
  }

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

  // ── Relay communication helpers ──────────────────────────────────────────
  function relayPost(table, body) {
    return new Promise(function (resolve, reject) {
      if (!state.relay) { reject(new Error('No relay')); return; }
      var msgId = 'ct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      var timeoutId;
      function onResponse(e) {
        if (!e.data || e.data.relay !== 'MERIDIAN_TRIGGER_RESPONSE') return;
        if (e.data.id !== msgId) return;
        clearTimeout(timeoutId);
        window.removeEventListener('message', onResponse);
        if (e.data.success) resolve(e.data.data);
        else reject(new Error(e.data.error || 'Unknown error'));
      }
      window.addEventListener('message', onResponse);
      timeoutId = setTimeout(function () {
        window.removeEventListener('message', onResponse);
        reject(new Error('Timeout'));
      }, 10000);
      state.relay.postMessage({
        relay: 'MERIDIAN_TRIGGER',
        id: msgId,
        action: 'SUPABASE_POST',
        payload: { table: table, body: body }
      }, '*');
    });
  }

  function relayGet(table, query, token) {
    return new Promise(function (resolve, reject) {
      if (!state.relay) { reject(new Error('No relay')); return; }
      var msgId = 'ct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      var timeoutId;
      function onResponse(e) {
        if (!e.data || e.data.relay !== 'MERIDIAN_TRIGGER_RESPONSE') return;
        if (e.data.id !== msgId) return;
        clearTimeout(timeoutId);
        window.removeEventListener('message', onResponse);
        if (e.data.success) resolve(e.data.data);
        else reject(new Error(e.data.error || 'Unknown error'));
      }
      window.addEventListener('message', onResponse);
      timeoutId = setTimeout(function () {
        window.removeEventListener('message', onResponse);
        reject(new Error('Timeout'));
      }, 10000);
      state.relay.postMessage({
        relay: 'MERIDIAN_TRIGGER',
        id: msgId,
        action: 'SUPABASE_GET',
        payload: { table: table, query: query, token: token || undefined }
      }, '*');
    });
  }

  // ── Date helper ─────────────────────────────────────────────────────────
  function getTodayNY() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  }

  function newSessionId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  // ── Hydrate stats from Supabase on load ────────────────────────────────
  function fetchTodayStats() {
    if (!state.userId || !state.relay) return;

    // Build NY day boundaries as ISO strings for PostgREST filtering
    // Use the same Intl approach as the rest of ct-widget to get NY calendar date
    var todayStr = getTodayNY(); // YYYY-MM-DD

    // Compute tomorrow's date string in NY timezone
    // Create a date well into "today" in NY (noon UTC is always same-day in NY)
    var parts = todayStr.split('-');
    var noonUTC = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2], 17, 0, 0));
    var tomorrowUTC = new Date(noonUTC.getTime() + 86400000);
    var tomorrowStr = tomorrowUTC.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Use noon-anchored ISO timestamps — PostgREST compares against the DB timestamp column
    // The DB stores timestamps in UTC with DEFAULT now(), so we need UTC boundaries
    // Approximate: NY midnight ≈ 04:00 or 05:00 UTC depending on DST
    // Safe approach: use the date strings with T05:00:00Z (EST midnight) as floor
    // and widen slightly — a few hours of overlap is fine since we filter by user_id
    var startISO = todayStr + 'T04:00:00Z';     // earliest possible NY midnight (EDT)
    var endISO   = tomorrowStr + 'T05:00:00Z';   // latest possible NY midnight+1 (EST)

    // Query case_events for this user today
    var query = 'select=type,excluded' +
      '&user_id=eq.' + state.userId +
      '&timestamp=gte.' + encodeURIComponent(startISO) +
      '&timestamp=lt.' + encodeURIComponent(endISO);

    relayGet('case_events', query).then(function (rows) {
      if (!Array.isArray(rows)) return;
      var r = 0, rc = 0, ca = 0;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row.excluded) continue;
        if (row.type === 'resolved')     r++;
        if (row.type === 'reclassified') rc++;
        if (row.type === 'call')         ca++;
      }
      state.stats.resolved = r;
      state.stats.reclass  = rc;
      state.stats.calls    = ca;
      render();
    }).catch(function (err) {
      console.warn('[Meridian CT] Failed to fetch today stats:', err.message);
    });
  }

  // ── Action handlers ──────────────────────────────────────────────────────
  function handleResolved() {
    stopTimer();
    var caseNum = state.caseNumber;
    var now = new Date();
    relayPost('ct_cases', {
      id:          state.sessionId,
      user_id:     state.userId,
      case_number: caseNum || null,
      case_type:   state.caseType    || null,
      case_subtype: state.caseSubtype || null,
      duration_s:  state.elapsed,
      status:      'closed',
      resolution:  'resolved',
      is_rfc:      false,
      source:      'pip',
      sf_case_id:  state.sfCaseId || null,
      entry_date:  getTodayNY(),
      started_at:  new Date(now.getTime() - state.elapsed * 1000).toISOString(),
      ended_at:    now.toISOString(),
    }).then(function () {
      relayPost('case_events', {
        session_id: state.sessionId || null,
        user_id:    state.userId,
        type:       'resolved',
        excluded:   false,
        rfc:        false,
        sf_case_id: state.sfCaseId || null,
      }).catch(function (err) {
        console.warn('[Meridian CT] case_events write failed (non-blocking):', err.message);
      });
      state.elapsed = 0;
      state.caseNumber  = '';
      state.caseType    = '';
      state.caseSubtype = '';
      state.accountId   = '';
      state.sfCaseId    = '';
      state.sessionId   = '';
      state.stats.resolved++;
      showWidgetToast('\u2713 Resolved \u2014 Case ' + (caseNum || '\u2014'));
      render();
    }).catch(function (err) {
      showWidgetToast('Error: ' + (err.message || 'Unknown error'));
    });
  }

  function handleReclass() {
    stopTimer();
    var caseNum = state.caseNumber;
    var now = new Date();
    relayPost('ct_cases', {
      id:          state.sessionId,
      user_id:     state.userId,
      case_number: caseNum || null,
      case_type:   state.caseType    || null,
      case_subtype: state.caseSubtype || null,
      duration_s:  state.elapsed,
      status:      'closed',
      resolution:  'reclassified',
      is_rfc:      false,
      source:      'pip',
      sf_case_id:  state.sfCaseId || null,
      entry_date:  getTodayNY(),
      started_at:  new Date(now.getTime() - state.elapsed * 1000).toISOString(),
      ended_at:    now.toISOString(),
    }).then(function () {
      relayPost('case_events', {
        session_id: state.sessionId || null,
        user_id:    state.userId,
        type:       'reclassified',
        excluded:   false,
        rfc:        false,
        sf_case_id: state.sfCaseId || null,
      }).catch(function (err) {
        console.warn('[Meridian CT] case_events write failed (non-blocking):', err.message);
      });
      state.elapsed = 0;
      state.caseNumber  = '';
      state.caseType    = '';
      state.caseSubtype = '';
      state.accountId   = '';
      state.sfCaseId    = '';
      state.sessionId   = '';
      state.stats.reclass++;
      showWidgetToast('\u21a9 Reclassified \u2014 Case ' + (caseNum || '\u2014'));
      render();
    }).catch(function (err) {
      showWidgetToast('Error: ' + (err.message || 'Unknown error'));
    });
  }

  function handleCall() {
    // Does NOT stop the timer — calls happen while working a case
    relayPost('ct_calls', {
      user_id:    state.userId,
      case_id:    null,
      duration_s: null,
      entry_date: getTodayNY(),
      notes:      null,
    }).then(function () {
      relayPost('case_events', {
        session_id: state.sessionId || null,
        user_id:    state.userId,
        type:       'call',
        excluded:   false,
        rfc:        false,
        sf_case_id: state.sfCaseId || null,
      }).catch(function (err) {
        console.warn('[Meridian CT] case_events call write failed:', err.message);
      });
      state.stats.calls++;
      showWidgetToast('\uD83D\uDCDE Call logged');
      render();
    }).catch(function (err) {
      showWidgetToast('Error: ' + (err.message || 'Unknown error'));
    });
  }

  function handleStartCase() {
    var m = document.title.match(/(\d{8,})/);
    if (m) {
      state.caseNumber = m[1];
      state.sessionId  = newSessionId();
      state.elapsed    = 0;
      state.isAwaiting = false;
      startTimer();
      render();
    } else {
      showWidgetToast('No case detected on this page');
    }
  }

  function handleDismissCase() {
    stopTimer();
    state.caseNumber  = '';
    state.caseType    = '';
    state.caseSubtype = '';
    state.accountId   = '';
    state.sfCaseId    = '';
    state.sessionId   = '';
    state.elapsed     = 0;
    state.isAwaiting  = false;
    render();
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    var total    = state.stats.resolved + state.stats.reclass + state.stats.calls;
    var isActive = !!state.caseNumber;

    var mLogo =
      '<div data-action="dashboard" title="Open Meridian Dashboard" style="' +
        'width:28px;height:28px;border-radius:7px;background:#003087;' +
        'display:flex;align-items:center;justify-content:center;' +
        'cursor:pointer;flex-shrink:0;' +
      '"><img src="' + MERIDIAN_ICON_B64 + '" alt="Meridian" style="' +
        'width:20px;height:20px;display:block;pointer-events:none;' +
      '"/></div>';

    var statPills =
      '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
        '<button data-action="resolve" style="' +
          'height:26px;padding:0 10px;border-radius:6px;border:none;' +
          'background:#22c55e;color:#fff;font-size:11px;font-weight:700;cursor:pointer;' +
        '">' + state.stats.resolved + ' Resolved</button>' +
        '<button data-action="reclass" style="' +
          'height:26px;padding:0 10px;border-radius:6px;border:none;' +
          'background:#ef4444;color:#fff;font-size:11px;font-weight:700;cursor:pointer;' +
        '">' + state.stats.reclass + ' Reclass</button>' +
        '<button data-action="call" style="' +
          'height:26px;padding:0 10px;border-radius:6px;border:none;' +
          'background:#3b82f6;color:#fff;font-size:11px;font-weight:700;cursor:pointer;' +
        '">' + state.stats.calls + ' Calls</button>' +
        '<button style="' +
          'height:26px;padding:0 10px;border-radius:6px;border:none;' +
          'background:#6b7280;color:#fff;font-size:11px;font-weight:700;cursor:default;' +
        '">' + total + ' Total</button>' +
      '</div>';

    var divider = '<div style="width:1px;height:20px;background:rgba(255,255,255,0.1);flex-shrink:0;"></div>';
    var spacer  = '<div style="flex:1;"></div>';
    var minBtn  = '<button data-action="minimize" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:12px;cursor:pointer;padding:0 2px;flex-shrink:0;">';
    var closeBtn =
      '<button data-action="close" style="' +
        'background:none;border:none;color:rgba(255,255,255,0.4);' +
        'font-size:14px;cursor:pointer;padding:0 2px;flex-shrink:0;' +
      '">\u00d7</button>';

    var barStyle =
      'height:44px;background:' + T.bg + ';' +
      'border:1px solid ' + T.border + ';border-radius:10px;' +
      'display:flex;align-items:center;gap:6px;padding:0 10px;' +
      'box-shadow:0 4px 16px rgba(0,0,0,0.4);' +
      'font-family:' + T.font + ';cursor:move;user-select:none;';

    // ── Minimized ────────────────────────────────────────────────────────────
    if (state.isMinimized) {
      var minContent = isActive
        ? '<span style="color:#E8540A;font-family:monospace;font-weight:700;font-size:12px;">' + state.caseNumber + '</span>' +
          '<span id="ct-timer" style="color:#fff;font-weight:600;font-size:12px;font-variant-numeric:tabular-nums;margin-left:6px;">' + fmtTime(state.elapsed) + '</span>'
        : '';
      shadow.innerHTML =
        '<div id="ct-header" style="' + barStyle + '">' +
          mLogo +
          (minContent ? '<div style="display:flex;align-items:center;flex-shrink:0;">' + minContent + '</div>' : '') +
          spacer +
          minBtn + '\u25b2</button>' +
          closeBtn +
        '</div>';
      return;
    }

    // Toast (absolute, below bar)
    var toastHtml = state.toastMsg
      ? '<div style="' +
          'position:absolute;bottom:-28px;left:50%;transform:translateX(-50%);' +
          'background:#065f46;color:#fff;padding:4px 12px;border-radius:6px;' +
          'font-size:11px;font-weight:600;white-space:nowrap;' +
          'box-shadow:0 2px 8px rgba(0,0,0,0.3);pointer-events:none;' +
        '">' + state.toastMsg + '</div>'
      : '';

    // ── Idle (no case) ───────────────────────────────────────────────────────
    if (!isActive) {
      shadow.innerHTML =
        '<div id="ct-header" style="position:relative;' + barStyle + '">' +
          mLogo +
          '<button data-action="startcase" style="' +
            'height:26px;padding:0 12px;border-radius:6px;border:none;' +
            'background:#E8540A;color:#fff;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;' +
          '">Start Case</button>' +
          divider +
          statPills +
          spacer +
          minBtn + '\u25bc</button>' +
          closeBtn +
          toastHtml +
        '</div>';
      return;
    }

    // ── Active (case loaded) ─────────────────────────────────────────────────
    var awaitBtn =
      '<button data-action="awaiting" style="' +
        'height:26px;width:26px;border-radius:6px;border:none;' +
        'background:' + (state.isAwaiting ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.25)') + ';' +
        'color:#f59e0b;font-size:12px;cursor:pointer;flex-shrink:0;' +
      '">' + (state.isAwaiting ? '\u25b6' : '\u23f8') + '</button>';

    shadow.innerHTML =
      '<div id="ct-header" style="position:relative;' + barStyle + '">' +
        mLogo +
        '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
          '<span style="color:#E8540A;font-family:monospace;font-weight:700;font-size:12px;">' + state.caseNumber + '</span>' +
          '<button data-action="dismisscase" style="' +
            'background:none;border:none;color:rgba(255,255,255,0.4);' +
            'font-size:11px;cursor:pointer;padding:0 2px;' +
          '">\u00d7</button>' +
        '</div>' +
        '<span id="ct-timer" style="color:#fff;font-weight:600;font-size:12px;font-variant-numeric:tabular-nums;flex-shrink:0;">' + fmtTime(state.elapsed) + '</span>' +
        divider +
        statPills +
        awaitBtn +
        spacer +
        minBtn + '\u25bc</button>' +
        closeBtn +
        toastHtml +
      '</div>';
  }

  // Initial render (stats show 0 until hydration completes)
  render();

  // Hydrate stats from Supabase — updates counters and re-renders when data arrives
  fetchTodayStats();

  // ── Auto-start case if payload includes a case number ─────────────────
  if (MERIDIAN_PAYLOAD.caseNumber) {
    state.caseNumber  = MERIDIAN_PAYLOAD.caseNumber;
    state.caseType    = MERIDIAN_PAYLOAD.caseType    || '';
    state.caseSubtype = MERIDIAN_PAYLOAD.caseSubtype || '';
    state.accountId   = MERIDIAN_PAYLOAD.accountId   || '';
    state.sfCaseId    = MERIDIAN_PAYLOAD.sfCaseId    || '';
    state.sessionId   = newSessionId();
    startTimer();
    render();
  }

  if (MERIDIAN_PAYLOAD.sfCaseId) {
    state.sfCaseId = MERIDIAN_PAYLOAD.sfCaseId;
  }

  // ── Expose refresh hook for double-injection guard ────────────────────────
  host._meridianRefresh = function (payload) {
    if (payload && payload.caseNumber) {
      state.caseNumber  = payload.caseNumber;
      state.caseType    = payload.caseType    || '';
      state.caseSubtype = payload.caseSubtype || '';
      state.accountId   = payload.accountId   || '';
      state.sfCaseId    = payload.sfCaseId    || '';
      state.sessionId   = newSessionId();
      if (!state.timerRunning) {
        state.elapsed = 0;
        startTimer();
      }
    }
    fetchTodayStats();
    render();
  };

  // ── Event delegation on shadow root ──────────────────────────────────────
  shadow.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');

    if (action === 'dashboard') {
      window.open('https://meridian-hlag.vercel.app', '_blank');
    } else if (action === 'minimize') {
      state.isMinimized = !state.isMinimized;
      render();
    } else if (action === 'close') {
      stopTimer();
      host.remove();
    } else if (action === 'startcase') {
      handleStartCase();
    } else if (action === 'dismisscase') {
      handleDismissCase();
    } else if (action === 'resolve') {
      handleResolved();
    } else if (action === 'reclass') {
      handleReclass();
    } else if (action === 'call') {
      handleCall();
    } else if (action === 'awaiting') {
      if (state.isAwaiting) {
        // Resume
        state.isAwaiting = false;
        startTimer();
      } else {
        // Pause
        state.isAwaiting = true;
        stopTimer();
      }
      render();
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
