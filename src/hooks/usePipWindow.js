import { useState, useRef, useCallback } from 'react';

const PIP_MARGIN = 16; // px from screen edge when pinned to bottom-right

function buildThemeTokens(theme) {
  if (theme === 'light') {
    return `
      :root {
        --font-family: 'Inter', system-ui, sans-serif;
        --bg-body:        #f1f5f9;
        --bg-deep:        #e2e8f0;
        --bg-card:        #ffffff;
        --card-bg-subtle: rgba(0,0,0,0.03);
        --text-pri:       #0f172a;
        --text-sec:       #475569;
        --text-dim:       #94a3b8;
        --divider:        rgba(0,0,0,0.08);
        --border:         rgba(0,0,0,0.10);
        --shadow-subtle:  0 1px 4px rgba(0,0,0,0.08);
        --shadow-glow:    none;
        --case-focus:     rgba(0,48,135,0.07);
        --case-border:    rgba(0,48,135,0.20);
        --row-focus:      rgba(0,0,0,0.04);
        --amber-row:      rgba(217,119,6,0.08);
        --color-mbtn:     #003087;
        --color-mmark:    #E8540A;
        --color-resolved: #22c55e;
        --color-reclass:  #ef4444;
        --color-calls:    #3b82f6;
        --color-process:  #64748b;
        --color-process-navy: rgba(0,48,135,0.15);
        --color-awaiting: #f59e0b;
        --color-active-dot: #4ade80;
      }
      body { background: #f1f5f9; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: rgba(0,0,0,0.04); border-radius: 3px; }
      ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.30); }
    `;
  }
  // dark (default)
  return `
    :root {
      --font-family: 'Inter', system-ui, sans-serif;
      --bg-body:        #0f1117;
      --bg-deep:        #0f172a;
      --bg-card:        rgba(255,255,255,0.05);
      --card-bg-subtle: rgba(255,255,255,0.03);
      --text-pri:       rgba(255,255,255,0.92);
      --text-sec:       rgba(255,255,255,0.55);
      --text-dim:       rgba(255,255,255,0.30);
      --divider:        rgba(255,255,255,0.08);
      --border:         rgba(255,255,255,0.10);
      --shadow-subtle:  none;
      --shadow-glow:    none;
      --case-focus:     rgba(0,48,135,0.25);
      --case-border:    rgba(0,48,135,0.5);
      --row-focus:      rgba(255,255,255,0.04);
      --amber-row:      rgba(217,119,6,0.15);
      --color-mbtn:     #003087;
      --color-mmark:    #E8540A;
      --color-resolved: #22c55e;
      --color-reclass:  #ef4444;
      --color-calls:    #3b82f6;
      --color-process:  #64748b;
      --color-process-navy: rgba(0,48,135,0.4);
      --color-awaiting: #f59e0b;
      --color-active-dot: #4ade80;
    }
    body { background: #0f1117; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 3px; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.22); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.35); }
  `;
}

export function usePipWindow() {
  const [pipWindow, setPipWindow] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const pipRootRef = useRef(null);
  // Ref always holds the latest pipWindow so resizeAndPin never uses a stale closure
  const pipWindowRef = useRef(null);

  const openPip = useCallback(async ({ width, height, position, theme = 'dark' } = {}) => {
    if (!window.documentPictureInPicture) {
      console.warn('Document Picture-in-Picture API not supported in this browser.');
      return { ok: false, reason: 'unsupported', error: null };
    }

    try {
      const w = width ?? 680;
      const h = height ?? 64;
      const pw = await window.documentPictureInPicture.requestWindow({
        width: w,
        height: h,
      });

      // Snap to the user's preferred corner.
      // After await requestWindow(), user activation is gone in the parent context,
      // so pw.moveTo() from here usually no-ops. We try it anyway (free), then
      // inject a one-time mousedown listener into the PiP window as a reliable
      // fallback — the first click gives the PiP window real user activation.
      {
        const sw = window.screen.availWidth;
        const sh = window.screen.availHeight;
        let x, y;
        if (position === 'bottom-left') {
          x = PIP_MARGIN;
          y = sh - h - PIP_MARGIN;
        } else if (position === 'top-right') {
          x = sw - w - PIP_MARGIN;
          y = PIP_MARGIN;
        } else if (position === 'top-left') {
          x = PIP_MARGIN;
          y = PIP_MARGIN;
        } else {
          x = sw - w - PIP_MARGIN;
          y = sh - h - PIP_MARGIN;
        }
        // Best-effort immediate snap (works if Chrome doesn't gate moveTo on PiP windows)
        try { pw.moveTo(x, y); } catch (e) { /* expected to fail */ }
        // Guaranteed fallback: snap on first interaction within the PiP widget.
        // mousedown provides user activation in the PiP window's context.
        const posScript = pw.document.createElement('script');
        posScript.textContent = `document.addEventListener('mousedown',function(){try{window.moveTo(${x},${y})}catch(e){}},{once:true})`;
        pw.document.head.appendChild(posScript);
        posScript.remove();
      }

      pw.document.title = 'Meridian';
      pw.document.body.style.cssText =
        `margin:0;padding:0;overflow:hidden;background:${theme === 'light' ? '#f1f5f9' : '#0f1117'};width:100%;height:100%;font-family:"Inter",system-ui,sans-serif`;
      pw.document.documentElement.style.cssText = 'width:100%;height:100%;margin:0;padding:0;';

      // Inject Google Fonts for Inter
      const link = pw.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap';
      pw.document.head.appendChild(link);

      // Inject CSS custom properties (PiP window has no access to parent's index.css)
      const style = pw.document.createElement('style');
      style.id = 'meridian-pip-theme';
      style.textContent = buildThemeTokens(theme) + `
        * { box-sizing: border-box; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes meridian-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.75); }
        }
        .swap-dot-pulse { animation: meridian-pulse 1.4s ease-in-out infinite; }
      `;
      pw.document.head.appendChild(style);

      // Inject a resize/move helper that runs inside the PiP window's execution
      // context.  pw.resizeTo() called from the opener fails silently when the
      // opener doesn't hold transient user activation (e.g. after a button click
      // inside the PiP window).  Dispatching a CustomEvent to pw is synchronous
      // and the listener below fires with the PiP window's own activation, so
      // resizeTo/moveTo succeed even when the opener's activation is stale.
      const resizeScript = pw.document.createElement('script');
      resizeScript.textContent = `
        window.addEventListener('__mResize', function(e) {
          var d = e.detail;
          try {
            window.resizeTo(d.w, d.h);
          } catch(err) {
            console.warn('[Meridian] PiP resizeTo failed:', err.name, err.message);
          }
          try {
            window.moveTo(d.x, d.y);
          } catch(err) {
            console.warn('[Meridian] PiP moveTo failed:', err.name, err.message);
          }
        });
      `;
      pw.document.head.appendChild(resizeScript);
      resizeScript.remove();

      pw.addEventListener('pagehide', () => {
        setPipWindow(null);
        pipWindowRef.current = null;
        setIsOpen(false);
        pipRootRef.current = null;
      });

      setPipWindow(pw);
      pipWindowRef.current = pw;
      setIsOpen(true);
      return { ok: true, window: pw };
    } catch (err) {
      console.error('Failed to open PiP window:', err);
      const reason = (err?.name === 'NotAllowedError' || err?.name === 'AbortError')
        ? 'denied'
        : 'setup';
      return { ok: false, reason, error: err };
    }
  }, []);

  const closePip = useCallback(() => {
    const pw = pipWindowRef.current;
    if (pw) {
      try {
        pw.close();
      } catch (err) {
        console.warn('Error closing PiP window:', err);
      }
      setPipWindow(null);
      pipWindowRef.current = null;
      setIsOpen(false);
      pipRootRef.current = null;
    }
  }, []);

  const reapplyTheme = useCallback((theme) => {
    const pw = pipWindowRef.current;
    if (!pw) return;
    const style = pw.document.getElementById('meridian-pip-theme');
    if (style) {
      style.textContent = buildThemeTokens(theme) + `
        * { box-sizing: border-box; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes meridian-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.75); }
        }
        .swap-dot-pulse { animation: meridian-pulse 1.4s ease-in-out infinite; }
      `;
    }
    pw.document.body.style.background = theme === 'light' ? '#f1f5f9' : '#0f1117';
  }, []);

  const resizeAndPin = useCallback((size, position = 'bottom-right') => {
    const pw = pipWindowRef.current;
    if (!pw || !size) {
      console.warn('resizeAndPin called but pipWindow or size is null');
      return;
    }
    const sw = window.screen.availWidth;
    const sh = window.screen.availHeight;
    const { width, height } = size;
    let x, y;
    if (position === 'bottom-left') {
      x = PIP_MARGIN;
      y = sh - height - PIP_MARGIN;
    } else if (position === 'top-right') {
      x = sw - width - PIP_MARGIN;
      y = PIP_MARGIN;
    } else if (position === 'top-left') {
      x = PIP_MARGIN;
      y = PIP_MARGIN;
    } else {
      // bottom-right (default)
      x = sw - width - PIP_MARGIN;
      y = sh - height - PIP_MARGIN;
    }
    // Dispatch via the PiP window's own event listener so the resize/moveTo
    // executes with the PiP window's transient user activation (which is set
    // when the user clicks inside the PiP widget).  A direct pw.resizeTo()
    // call from the opener context fails silently because Chrome checks the
    // caller's browsing context for activation, not the target window's.
    try {
      pw.dispatchEvent(new pw.CustomEvent('__mResize', { detail: { w: width, h: height, x, y } }));
    } catch (e) {
      console.warn('[Meridian] PiP resize dispatch failed:', size, e);
    }
  }, []);

  return {
    pipWindow,
    isOpen,
    openPip,
    closePip,
    reapplyTheme,
    resizeAndPin,
    pipRootRef,
  };
}
