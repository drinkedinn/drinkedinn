// src/admin/content/PostDetail.jsx
// "View in context" — everything the console legitimately knows about one post,
// in one place, so a removal decision is not made off a 220-character preview.
//
// The web client has no per-post URL to deep-link to, so context is assembled
// here rather than faked with a link that 404s.
//
// Deliberately NOT shown: who reported the post. Counts and reasons are enough
// to judge it, and a reporter's name in a moderator's hands is a retaliation
// risk the job does not require.

import Avatar from '../../components/Avatar';
import Modal from './Modal';
import { C, Badge, actionBtn, fmtDateTime, fmtCount, plainPreview } from './ui';

const isChildSafety = (reason) => String(reason || '').toLowerCase().startsWith('csae');

export default function PostDetail({ post, reports, reportsAvailable, canRemove, onRemove, onClose }) {
  if (!post) return null;
  const rows = Array.isArray(reports) ? reports : [];

  return (
    <Modal
      title={`Post #${post.id} by ${post.name || (post.user_id != null ? `User #${post.user_id}` : 'unknown author')}`}
      subtitle={fmtDateTime(post.created_at)}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button type="button" onClick={onClose} style={actionBtn(C.textMuted)}>Close</button>
          {canRemove && (
            <button type="button" onClick={() => onRemove(post)} style={actionBtn(C.red)}>
              Remove post…
            </button>
          )}
        </>
      }
    >
      {/* Author + engagement */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
        <Avatar src={post.avatar} name={post.name || 'User'} size={44} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>
            {post.name || (post.user_id != null ? `User #${post.user_id}` : 'Unknown author')}
          </div>
          <div style={{ fontSize: 12, color: C.textFaint }}>
            User #{post.user_id ?? '—'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {post.drink ? <Badge label={post.drink} color={C.amber} bg={C.amber + '22'} /> : null}
          <Badge label={`🥂 ${fmtCount(post.cheer_count)}`} color={C.green} bg={C.green + '22'} />
          <Badge label={`💬 ${fmtCount(post.comment_count)}`} color={C.accentHi} bg={C.accent + '22'} />
        </div>
      </div>

      {/* The content itself — plain text, never HTML */}
      <div style={{
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px',
        color: C.text, fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: 320, overflowY: 'auto',
      }}>
        {plainPreview(post.content, 4000) || <span style={{ color: C.textFaint }}>(no text on this post)</span>}
      </div>

      {/* Attached metadata the list endpoint returns */}
      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 16px', margin: '18px 0 0', fontSize: 12.5 }}>
        <dt style={{ color: C.textMuted }}>Location text</dt>
        <dd style={{ margin: 0, color: post.location ? C.text : C.textFaint }}>{post.location || 'not set'}</dd>
        <dt style={{ color: C.textMuted }}>Posted</dt>
        <dd style={{ margin: 0, color: C.text }}>{fmtDateTime(post.created_at)}</dd>
      </dl>

      {/* Reports against this post */}
      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
          Reports
        </div>

        {!reportsAvailable ? (
          <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>
            The reports queue could not be loaded, so this post's report history is unknown — not zero.
          </div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>
            No reports against this post in the 50 most recent reports.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                  {isChildSafety(r.reason) && <Badge label="Child safety · P0" color={C.red} bg={C.red + '22'} />}
                  <Badge
                    label={r.status || 'pending'}
                    color={r.status === 'resolved' ? C.green : r.status === 'removed' ? C.red : C.amber}
                    bg={(r.status === 'resolved' ? C.green : r.status === 'removed' ? C.red : C.amber) + '22'}
                  />
                  <span style={{ fontSize: 11, color: C.textFaint }}>{fmtDateTime(r.created_at)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.55, wordBreak: 'break-word' }}>
                  {plainPreview(r.reason, 220) || 'No reason given.'}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: C.textFaint, lineHeight: 1.5 }}>
              Reporter identities are not shown in this console.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
