import { useState, useEffect } from 'react';
import { createSignedAttachmentUrl } from '../lib/api';

export function useSignedAttachmentUrl(storagePath) {
  const [state, setState] = useState({ url: null, loading: false, error: null });

  useEffect(() => {
    if (!storagePath) {
      setState({ url: null, loading: false, error: 'no path' });
      return;
    }

    let cancelled = false;
    setState({ url: null, loading: true, error: null });

    createSignedAttachmentUrl(storagePath, 300).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setState({ url: null, loading: false, error });
      } else {
        setState({ url: data?.signedUrl ?? null, loading: false, error: null });
      }
    });

    return () => { cancelled = true; };
  }, [storagePath]);

  return state;
}
