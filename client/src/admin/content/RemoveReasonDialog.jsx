// src/admin/content/RemoveReasonDialog.jsx
// The only way a post leaves the platform from this panel.
//
// Two things it refuses to allow: a removal nobody can explain later, and a
// removal that happened because a button was where a mouse already was. So it
// states the exact consequence and the exact target, and it will not enable
// Remove until a real reason has been typed.

import { useState } from 'react';
import Modal from './Modal';
import { C, actionBtn, labelStyle, inputStyle, plainPreview } from './ui';

export const MIN_REASON = 8;

export default function RemoveReasonDialog({ post, submitting, error, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const tooShort = trimmed.length < MIN_REASON;

  const author = post?.name || (post?.user_id != null ? `User #${post.user_id}` : 'an unknown author');
  const cheers = Number(post?.cheer_count) || 0;
  const comments = Number(post?.comment_count) || 0;

  const submit = (e) => {
    e.preventDefault();
    if (tooShort || submitting) return;
    onConfirm(trimmed);
  };

  return (
    <Modal
      title={`Remove post #${post?.id ?? '—'}?`}
      subtitle="Read what this does before you confirm."
      onClose={submitting ? () => {} : onCancel}
      dismissOnBackdrop={false}
      width={600}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={submitting} style={actionBtn(C.textMuted, submitting)}>
            Cancel
          </button>
          <button
            type="submit"
            form="remove-post-form"
            disabled={tooShort || submitting}
            style={actionBtn(C.red, tooShort || submitting)}
          >
            {submitting ? 'Removing…' : `Remove post #${post?.id ?? ''}`}
          </button>
        </>
      }
    >
      <form id="remove-post-form" onSubmit={submit}>
        <div style={{ background: C.red + '11', border: `1px solid ${C.red}44`, borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.65 }}>
            This permanently deletes <strong>post #{post?.id ?? '—'}</strong> by <strong>{author}</strong>,
            along with its <strong>{cheers.toLocaleString()} cheer{cheers === 1 ? '' : 's'}</strong> and{' '}
            <strong>{comments.toLocaleString()} comment{comments === 1 ? '' : 's'}</strong>.
            The author is not notified by this console. It cannot be undone.
          </div>
        </div>

        {post?.content ? (
          <div style={{ marginBottom: 18 }}>
            <div style={labelStyle}>The post being removed</div>
            <div style={{
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px',
              color: C.textMuted, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 140, overflowY: 'auto',
            }}>
              {plainPreview(post.content, 600) || '(no text)'}
            </div>
          </div>
        ) : null}

        <label htmlFor="remove-reason" style={labelStyle}>Reason (required, at least {MIN_REASON} characters)</label>
        <textarea
          id="remove-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          aria-describedby="remove-reason-help"
          placeholder="e.g. Targeted harassment of another member — report #412"
          style={{ ...inputStyle, width: '100%', background: C.bg, resize: 'vertical' }}
        />
        <div id="remove-reason-help" style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginTop: 6 }}>
          <span style={{ fontSize: 11.5, color: tooShort ? C.amber : C.textMuted, lineHeight: 1.5 }}>
            {tooShort
              ? `${MIN_REASON - trimmed.length} more character${MIN_REASON - trimmed.length === 1 ? '' : 's'} needed.`
              : 'Sent with the removal and attributed to your admin account — write it for whoever reads it in six months.'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textFaint, flexShrink: 0 }}>{trimmed.length}/500</span>
        </div>

        {error && (
          <div role="alert" style={{ marginTop: 14, background: C.red + '22', border: `1px solid ${C.red}44`, borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13, lineHeight: 1.5 }}>
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
