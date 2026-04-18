import { useSignedAttachmentUrl } from '../../hooks/useSignedAttachmentUrl.js';

const placeholder = {
  maxWidth: 320,
  padding: '10px 14px',
  background: 'var(--card-bg-subtle)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-dim)',
  fontSize: 13,
};

export default function AttachmentPreview({ storagePath }) {
  const { url, loading, error } = useSignedAttachmentUrl(storagePath);

  if (loading) return <div style={placeholder}>Loading image...</div>;
  if (error)   return <div style={placeholder}>Could not load image.</div>;

  return (
    <div>
      <img
        src={url}
        alt="Bug attachment"
        style={{ maxWidth: 320, height: 'auto', borderRadius: 6, display: 'block', border: '1px solid var(--border)' }}
      />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 12, color: 'var(--color-blue, #3b82f6)', marginTop: 6, display: 'inline-block' }}
      >
        Open full size in new tab
      </a>
    </div>
  );
}
