import { useState, useRef, useCallback } from 'react';
import { SIZES } from '../lib/constants.js';

const PIP_MARGIN = 16; // px from screen edge when pinned to bottom-right

export function usePipWindow() {
  const [pipWindow, setPipWindow] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const pipRootRef = useRef(null);
  // Ref always holds the latest pipWindow so resizeAndPin never uses a stale closure
  const pipWindowRef = useRef(null);

  const openPip = useCallback(async ({ width, height } = {}) => {
    if (!window.documentPictureInPicture) {
      console.warn('Document Picture-in-Picture API not supported in this browser.');
      return null;
    }

    try {
      const pw = await window.documentPictureInPicture.requestWindow({
        width: width ?? SIZES.idle.width,
        height: height ?? SIZES.idle.height,
      });

      pw.document.title = 'Meridian';
      pw.document.body.style.cssText =
        'margin:0;padding:0;overflow:hidden;background:#0f1117;font-family:"Inter",system-ui,sans-serif';

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
          --bg-deep: #0f172a;
          --bg-card: rgba(255,255,255,0.06);
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
          --border: rgba(255,255,255,0.1);
          --card-bg-subtle: rgba(255,255,255,0.05);
          --text-pri: rgba(255,255,255,0.9);
          --text-sec: rgba(255,255,255,0.55);
          --text-dim: rgba(255,255,255,0.3);
          --shadow-subtle: none;
          --shadow-glow: none;
          --case-focus: rgba(232,84,10,0.1);
          --case-border: rgba(232,84,10,0.25);
          --row-focus: rgba(255,255,255,0.04);
          --amber-row: rgba(217,119,6,0.12);
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.22); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.35); }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes meridian-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.75); }
        }
        .swap-dot-pulse { animation: meridian-pulse 1.4s ease-in-out infinite; }
      `;
      pw.document.head.appendChild(style);

      pw.addEventListener('pagehide', () => {
        setPipWindow(null);
        pipWindowRef.current = null;
        setIsOpen(false);
        pipRootRef.current = null;
      });

      setPipWindow(pw);
      pipWindowRef.current = pw;
      setIsOpen(true);
      return pw;
    } catch (err) {
      console.error('Failed to open PiP window:', err);
      return null;
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

  const resizeAndPin = useCallback((mode) => {
    const pw = pipWindowRef.current;
    if (!pw) {
      console.warn('resizeAndPin called but pipWindow is null');
      return;
    }
    const size = SIZES[mode];
    if (!size) {
      console.warn(`resizeAndPin: unknown mode "${mode}"`);
      return;
    }
    try {
      pw.resizeTo(size.width, size.height);
      const x = window.screen.availWidth - size.width - PIP_MARGIN;
      const y = window.screen.availHeight - size.height - PIP_MARGIN;
      pw.moveTo(x, y);
    } catch (e) {
      console.warn('[Meridian] PiP resize/move skipped (no user activation):', mode, e);
    }
  }, []);

  return {
    pipWindow,
    isOpen,
    openPip,
    closePip,
    resizeAndPin,
    pipRootRef,
  };
}
