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
        'margin:0;padding:0;overflow:hidden;background:#1a1a2e;font-family:"Segoe UI",sans-serif';

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
