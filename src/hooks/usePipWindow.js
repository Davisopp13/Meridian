import { useState, useRef, useCallback } from 'react';
import { SIZES } from '../lib/constants.js';

export function usePipWindow() {
  const [pipWindow, setPipWindow] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const pipRootRef = useRef(null);

  const openPip = useCallback(async () => {
    if (!window.documentPictureInPicture) {
      console.warn('Document Picture-in-Picture API not supported in this browser.');
      return null;
    }

    try {
      const pw = await window.documentPictureInPicture.requestWindow({
        width: SIZES.idle.width,
        height: SIZES.idle.height,
      });

      pw.document.body.style.cssText =
        'margin:0;padding:0;overflow:hidden;background:transparent;font-family:"Inter",system-ui,sans-serif';

      // Inject Google Fonts for Inter
      const link = pw.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap';
      pw.document.head.appendChild(link);

      // Inject CSS custom properties (PiP window has no access to parent's index.css)
      const style = pw.document.createElement('style');
      style.textContent = `
        :root {
          --font-family: 'Inter', system-ui, sans-serif;
          --bg-deep: #0f0f1e;
          --bg-card: #1a1a2e;
          --color-mbtn: #003087;
          --color-mmark: #E8540A;
          --color-resolved: #22c55e;
          --color-reclass: #ef4444;
          --color-calls: #3b82f6;
          --color-process: #64748b;
          --color-process-navy: rgba(0,48,135,0.4);
          --color-awaiting: #f59e0b;
          --color-active-dot: #4ade80;
          --divider: rgba(255,255,255,0.08);
          --border: rgba(255,255,255,0.12);
          --card-bg-subtle: rgba(255,255,255,0.04);
          --text-pri: rgba(255,255,255,0.95);
          --text-sec: rgba(255,255,255,0.55);
          --text-dim: rgba(255,255,255,0.3);
          --shadow-subtle: 0 4px 12px rgba(0,0,0,0.15);
          --shadow-glow: 0 0 16px rgba(0,48,135,0.3);
          --case-focus: rgba(0,48,135,0.15);
          --case-border: rgba(0,48,135,0.4);
          --row-focus: rgba(255,255,255,0.06);
          --amber-row: rgba(217,119,6,0.12);
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `;
      pw.document.head.appendChild(style);

      pw.addEventListener('pagehide', () => {
        setPipWindow(null);
        setIsOpen(false);
        pipRootRef.current = null;
      });

      setPipWindow(pw);
      setIsOpen(true);
      return pw;
    } catch (err) {
      console.error('Failed to open PiP window:', err);
      return null;
    }
  }, []);

  const closePip = useCallback(() => {
    if (pipWindow) {
      try {
        pipWindow.close();
      } catch (err) {
        console.warn('Error closing PiP window:', err);
      }
      setPipWindow(null);
      setIsOpen(false);
      pipRootRef.current = null;
    }
  }, [pipWindow]);

  const resizePip = useCallback((mode) => {
    if (!pipWindow) {
      console.warn('resizePip called but pipWindow is null');
      return;
    }
    const size = SIZES[mode];
    if (!size) {
      console.warn(`resizePip: unknown mode "${mode}"`);
      return;
    }
    try {
      pipWindow.resizeTo(size.width, size.height);
    } catch (e) {
      // resizeTo requires user activation — called outside gesture context, skipping
      console.warn('[Meridian] resizePip skipped (no user activation):', mode);
    }
  }, [pipWindow]);

  return {
    pipWindow,
    isOpen,
    openPip,
    closePip,
    resizePip,
    pipRootRef,
  };
}
