import { useState, useEffect } from 'react';
import {
  createSuggestion,
  uploadAttachmentBlob,
  createAttachmentRow,
  fetchCategoriesForTeam,
} from '../../lib/api.js';
import AttachmentUploader from './AttachmentUploader.jsx';

const C = {
  border:    'var(--border)',
  cardBg:    'var(--card-bg-subtle)',
  textPri:   'var(--text-pri)',
  textSec:   'var(--text-sec)',
  textDim:   'var(--text-dim)',
  bg:        'var(--bg-card)',
  orange:    '#E8540A',
};

const TYPES = [
  { value: 'bug',         label: 'Bug' },
  { value: 'feature',     label: 'Feature request' },
  { value: 'category',    label: 'New category' },
  { value: 'subcategory', label: 'New subcategory' },
  { value: 'other',       label: 'Other' },
];

const BODY_PLACEHOLDERS = {
  bug:         'Steps to reproduce, what happened, what you expected.',
  feature:     'What problem does this solve?',
  category:    'When would an agent pick this? Give a short description.',
  subcategory: 'When would an agent pick this? Give a short description.',
  other:       '',
};

const inputStyle = {
  width: '100%',
  background: C.cardBg,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: '8px 10px',
  color: C.textPri,
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle = {
  display: 'block',
  color: C.textSec,
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

export default function SuggestionForm({ user, onSubmitted }) {
  const [type, setType] = useState('bug');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [haulageType, setHaulageType] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [attachmentBlob, setAttachmentBlob] = useState(null);
  const [attachmentFilename, setAttachmentFilename] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const needsHaulage   = type === 'category' || type === 'subcategory';
  const needsParent    = type === 'subcategory';
  const needsAttachment = type === 'bug';

  useEffect(() => {
    if (!needsHaulage || !haulageType) {
      setCategories([]);
      setParentCategoryId('');
      return;
    }
    let cancelled = false;
    fetchCategoriesForTeam(haulageType).then(({ data }) => {
      if (!cancelled) {
        setCategories(data || []);
        setParentCategoryId('');
      }
    });
    return () => { cancelled = true; };
  }, [haulageType, needsHaulage]);

  function validate() {
    if (title.trim().length < 3)   return 'Title must be at least 3 characters.';
    if (title.trim().length > 120) return 'Title must be 120 characters or fewer.';
    if (body.trim().length < 1)    return 'Body is required.';
    if (body.trim().length > 4000) return 'Body must be 4000 characters or fewer.';
    if (needsHaulage && !haulageType) return 'Please select a haulage type.';
    if (needsParent  && !parentCategoryId) return 'Please select a parent category.';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setWarning('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSubmitting(true);

    const { data, error: createErr } = await createSuggestion({
      userId: user.id,
      type,
      title: title.trim(),
      body: body.trim(),
      haulageType: needsHaulage ? haulageType : null,
      parentCategoryId: needsParent ? parentCategoryId : null,
    });

    if (createErr) {
      setError('Failed to submit suggestion. Please try again.');
      setSubmitting(false);
      return;
    }

    const suggestionId = data.id;

    if (needsAttachment && attachmentBlob) {
      const { data: uploadData, error: uploadErr } = await uploadAttachmentBlob({
        userId: user.id,
        suggestionId,
        blob: attachmentBlob,
        filename: attachmentFilename,
      });

      if (uploadErr) {
        setWarning('Suggestion posted, but image upload failed.');
      } else {
        const storagePath = uploadData.path;
        const { error: rowErr } = await createAttachmentRow({
          suggestionId,
          storagePath,
          mimeType: attachmentBlob.type,
          sizeBytes: attachmentBlob.size,
        });
        if (rowErr) {
          setWarning('Suggestion posted, but image upload failed.');
        }
      }
    }

    setType('bug');
    setTitle('');
    setBody('');
    setHaulageType('');
    setParentCategoryId('');
    setCategories([]);
    setAttachmentBlob(null);
    setAttachmentFilename(null);
    setSubmitting(false);

    onSubmitted && onSubmitted();
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Type</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TYPES.map(t => (
            <label key={t.value} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              color: C.textSec,
              fontSize: 14,
              padding: '4px 10px',
              background: type === t.value ? 'rgba(232,84,10,0.12)' : C.cardBg,
              border: `1px solid ${type === t.value ? 'rgba(232,84,10,0.4)' : C.border}`,
              borderRadius: 6,
            }}>
              <input
                type="radio"
                name="type"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
                style={{ display: 'none' }}
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Brief summary"
          style={inputStyle}
        />
        <div style={{ color: C.textDim, fontSize: 11, marginTop: 3, textAlign: 'right' }}>
          {title.length}/120
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Details</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={4000}
          rows={4}
          placeholder={BODY_PLACEHOLDERS[type]}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
        />
        <div style={{ color: C.textDim, fontSize: 11, marginTop: 3, textAlign: 'right' }}>
          {body.length}/4000
        </div>
      </div>

      {needsHaulage && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Haulage type</label>
          <select
            value={haulageType}
            onChange={e => setHaulageType(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select...</option>
            <option value="CH">CH</option>
            <option value="MH">MH</option>
          </select>
        </div>
      )}

      {needsParent && haulageType && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Parent category</label>
          <select
            value={parentCategoryId}
            onChange={e => setParentCategoryId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select...</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      )}

      {needsAttachment && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Screenshot</label>
          <AttachmentUploader
            onChange={(blob, filename) => {
              setAttachmentBlob(blob);
              setAttachmentFilename(filename);
            }}
          />
        </div>
      )}

      {error && (
        <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>{error}</div>
      )}
      {warning && (
        <div style={{ color: '#f59e0b', fontSize: 13, marginBottom: 10 }}>{warning}</div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          background: submitting ? 'rgba(232,84,10,0.5)' : C.orange,
          color: '#fff',
          border: 'none',
          borderRadius: 7,
          padding: '8px 20px',
          fontSize: 14,
          fontWeight: 600,
          cursor: submitting ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
