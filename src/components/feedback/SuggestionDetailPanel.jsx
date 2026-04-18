import { useState, useEffect } from 'react';
import {
  fetchAttachmentForSuggestion,
  updateSuggestion,
  fetchCategoriesForTeam,
} from '../../lib/api.js';
import SuggestionStatusBadge from './SuggestionStatusBadge.jsx';
import AttachmentPreview from './AttachmentPreview.jsx';
import CategoryPromotionModal from './CategoryPromotionModal.jsx';

const STATUSES = ['new', 'acknowledged', 'in_progress', 'shipped', 'wont_fix'];
const STATUS_LABEL = {
  new: 'New', acknowledged: 'Acknowledged', in_progress: 'In progress',
  shipped: 'Shipped', wont_fix: "Won't fix",
};

const C = {
  bg:      'var(--bg-card)',
  border:  'var(--border)',
  divider: 'var(--divider, var(--border))',
  textPri: 'var(--text-pri)',
  textSec: 'var(--text-sec)',
  textDim: 'var(--text-dim)',
  input:   'var(--card-bg-subtle)',
};

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function SuggestionDetailPanel({ suggestion, onClose, onUpdated }) {
  const [attachment, setAttachment]         = useState(null);
  const [attachLoading, setAttachLoading]   = useState(false);
  const [parentCatName, setParentCatName]   = useState(null);
  const [status, setStatus]                 = useState(suggestion.status);
  const [adminNotes, setAdminNotes]         = useState(suggestion.admin_notes ?? '');
  const [saving, setSaving]                 = useState(false);
  const [saveMsg, setSaveMsg]               = useState(null);
  const [showModal, setShowModal]           = useState(false);

  // Fetch attachment for bug suggestions
  useEffect(() => {
    if (suggestion.type !== 'bug') return;
    let cancelled = false;
    setAttachLoading(true);
    fetchAttachmentForSuggestion(suggestion.id).then(({ data, error }) => {
      if (cancelled) return;
      setAttachLoading(false);
      if (!error && data) setAttachment(data);
    });
    return () => { cancelled = true; };
  }, [suggestion.id, suggestion.type]);

  // Fetch parent category name for subcategory suggestions
  useEffect(() => {
    if (suggestion.type !== 'subcategory' || !suggestion.parent_category_id || !suggestion.haulage_type) return;
    let cancelled = false;
    fetchCategoriesForTeam(suggestion.haulage_type).then(({ data }) => {
      if (cancelled) return;
      const match = (data || []).find(c => c.id === suggestion.parent_category_id);
      if (match) setParentCatName(match.name);
    });
    return () => { cancelled = true; };
  }, [suggestion.type, suggestion.parent_category_id, suggestion.haulage_type]);

  async function handleStatusChange(newStatus) {
    setStatus(newStatus);
    const { error } = await updateSuggestion({ id: suggestion.id, status: newStatus });
    if (!error) onUpdated();
  }

  async function handleSaveNotes() {
    setSaving(true);
    setSaveMsg(null);
    const { error } = await updateSuggestion({ id: suggestion.id, adminNotes });
    setSaving(false);
    setSaveMsg(error ? 'Save failed.' : 'Saved.');
    if (!error) onUpdated();
    setTimeout(() => setSaveMsg(null), 2500);
  }

  const submitter     = suggestion.platform_users;
  const canPromote    = (suggestion.type === 'category' || suggestion.type === 'subcategory') && status !== 'shipped';

  return (
    <>
      <div style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '20px 24px',
        marginBottom: 10,
        position: 'relative',
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          title="Close"
          style={{
            position: 'absolute', top: 14, right: 14,
            background: 'transparent', border: 'none',
            color: C.textDim, fontSize: 18, cursor: 'pointer', lineHeight: 1,
          }}
        >✕</button>

        {/* Title + badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, paddingRight: 28 }}>
          <h3 style={{ color: C.textPri, fontSize: 16, fontWeight: 600, margin: 0, flex: 1 }}>
            {suggestion.title}
          </h3>
          <SuggestionStatusBadge status={status} />
        </div>

        {/* Body */}
        <p style={{
          color: C.textSec, fontSize: 14, lineHeight: 1.6,
          whiteSpace: 'pre-wrap', marginBottom: 16,
        }}>
          {suggestion.body}
        </p>

        {/* Attachment preview (bugs only) */}
        {suggestion.type === 'bug' && !attachLoading && attachment && (
          <div style={{ marginBottom: 16 }}>
            <AttachmentPreview storagePath={attachment.storage_path} />
          </div>
        )}

        <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 14, marginBottom: 16 }}>
          {/* Submitter */}
          {submitter && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <span style={{ color: C.textDim, fontSize: 13, minWidth: 100 }}>Submitted by</span>
              <span style={{ color: C.textSec, fontSize: 13 }}>
                {submitter.full_name || submitter.email}
                {submitter.full_name && submitter.email && (
                  <span style={{ color: C.textDim }}> · {submitter.email}</span>
                )}
              </span>
            </div>
          )}

          {/* Timestamps */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
            <span style={{ color: C.textDim, fontSize: 13, minWidth: 100 }}>Submitted</span>
            <span style={{ color: C.textSec, fontSize: 13 }}>{fmt(suggestion.created_at)}</span>
          </div>
          {suggestion.updated_at !== suggestion.created_at && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <span style={{ color: C.textDim, fontSize: 13, minWidth: 100 }}>Updated</span>
              <span style={{ color: C.textSec, fontSize: 13 }}>{fmt(suggestion.updated_at)}</span>
            </div>
          )}

          {/* Category/subcategory extras */}
          {(suggestion.type === 'category' || suggestion.type === 'subcategory') && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <span style={{ color: C.textDim, fontSize: 13, minWidth: 100 }}>Haulage type</span>
              <span style={{ color: C.textSec, fontSize: 13 }}>{suggestion.haulage_type}</span>
            </div>
          )}
          {suggestion.type === 'subcategory' && parentCatName && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <span style={{ color: C.textDim, fontSize: 13, minWidth: 100 }}>Parent category</span>
              <span style={{ color: C.textSec, fontSize: 13 }}>{parentCatName}</span>
            </div>
          )}
        </div>

        {/* Status picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: C.textDim, fontSize: 12, marginBottom: 6 }}>Status</label>
          <select
            value={status}
            onChange={e => handleStatusChange(e.target.value)}
            style={{
              background: C.input, border: `1px solid ${C.border}`,
              borderRadius: 6, color: C.textPri, fontSize: 14,
              padding: '6px 10px', cursor: 'pointer',
            }}
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>

        {/* Admin notes */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: C.textDim, fontSize: 12, marginBottom: 6 }}>Admin notes</label>
          <textarea
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            rows={4}
            placeholder="Internal notes visible only to admins…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: C.input, border: `1px solid ${C.border}`,
              borderRadius: 6, color: C.textPri, fontSize: 14,
              padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <button
              onClick={handleSaveNotes}
              disabled={saving}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none',
                background: '#E8540A', color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13, opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save notes'}
            </button>
            {saveMsg && (
              <span style={{ fontSize: 13, color: saveMsg === 'Saved.' ? '#16a34a' : '#ef4444' }}>
                {saveMsg}
              </span>
            )}
          </div>
        </div>

        {/* Promote button */}
        {canPromote && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '7px 16px', borderRadius: 6, border: 'none',
              background: '#16a34a', color: '#fff', cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Promote to live categories
          </button>
        )}
      </div>

      {showModal && (
        <CategoryPromotionModal
          suggestion={suggestion}
          onConfirm={() => { setShowModal(false); setStatus('shipped'); onUpdated(); }}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  );
}
