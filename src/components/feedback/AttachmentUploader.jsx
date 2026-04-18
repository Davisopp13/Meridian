import { useState, useRef, useEffect } from 'react';
import { validateFile, compressImage, sanitizeFilename } from '../../lib/attachments.js';

const C = {
  border:  'var(--border)',
  textSec: 'var(--text-sec)',
  textDim: 'var(--text-dim)',
  cardBg:  'var(--card-bg-subtle)',
};

export default function AttachmentUploader({ onChange }) {
  const [state, setState] = useState('empty'); // empty | processing | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [filename, setFilename] = useState('');
  const [sizeKb, setSizeKb] = useState(0);
  const inputRef = useRef(null);
  const prevUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  function revokePreview() {
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
  }

  async function handleFile(file) {
    setErrorMsg('');
    setState('processing');

    const validation = validateFile(file);
    if (!validation.ok) {
      setState('error');
      setErrorMsg(validation.reason);
      onChange(null, null);
      return;
    }

    try {
      const blob = await compressImage(file);
      revokePreview();
      const url = URL.createObjectURL(blob);
      prevUrlRef.current = url;
      const safeName = sanitizeFilename(file.name);
      setPreviewUrl(url);
      setFilename(safeName);
      setSizeKb(Math.round(blob.size / 1024));
      setState('ready');
      onChange(blob, safeName);
    } catch {
      setState('error');
      setErrorMsg('Could not read image — try a different file.');
      onChange(null, null);
    }
  }

  function handleRemove() {
    revokePreview();
    setPreviewUrl(null);
    setFilename('');
    setSizeKb(0);
    setState('empty');
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
    onChange(null, null);
  }

  return (
    <div style={{ marginTop: 4 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {state === 'empty' && (
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              background: C.cardBg,
              border: `1px dashed ${C.border}`,
              borderRadius: 6,
              padding: '7px 14px',
              color: C.textSec,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Attach screenshot (optional)
          </button>
          <div style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>
            JPEG, PNG, WebP, or GIF. Up to 5MB. One image per bug.
          </div>
        </div>
      )}

      {state === 'processing' && (
        <div style={{ color: C.textSec, fontSize: 13 }}>Preparing image...</div>
      )}

      {state === 'ready' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={previewUrl}
            alt="preview"
            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.border}` }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ color: C.textSec, fontSize: 12 }}>{filename}</div>
            <div style={{ color: C.textDim, fontSize: 11 }}>{sizeKb} KB</div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            style={{
              background: 'none',
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              padding: '3px 10px',
              color: C.textSec,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Remove
          </button>
        </div>
      )}

      {state === 'error' && (
        <div>
          <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 6 }}>{errorMsg}</div>
          <button
            type="button"
            onClick={() => {
              setState('empty');
              if (inputRef.current) inputRef.current.value = '';
            }}
            style={{
              background: C.cardBg,
              border: `1px dashed ${C.border}`,
              borderRadius: 6,
              padding: '7px 14px',
              color: C.textSec,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
