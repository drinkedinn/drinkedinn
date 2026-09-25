// src/admin/content/PostDetail.jsx
// "View in context" — everything the console legitimately knows about one post,
// in one place, so a removal decision is not made off a 160-character preview.
//
// Every field here comes from the row GET /api/admin/posts already returned.
// The app has no per-post URL to deep-link to, so context is assembled here
// rather than faked with a link that 404s.
//
// Deliberately NOT shown: who reported the post. GET /api/admin/posts returns
// a report COUNT and nothing else, which is the right amount: a reporter's
// name in a moderator's hands is a retaliation risk the decision does not
// need. Reasons and reporters live in the Reports queue, behind reports.read.

import Avatar from '../../components/Avatar';
import Modal from './Modal';
import ImagePreview from './ImagePreview';
import { C, Badge, actionBtn, fmtDateTime, fmtCount, plainPreview } from './ui';

function Row({ label, children }) {
  return (
    <>
      <dt style={{ color: C.textMuted }}>{label}</dt>
      <dd style={{ margin: 0, color: C.text, wordBreak: 'break-word' }}>{children}</dd>
    </>
  );
}

export default function PostDetail({ post, canRemove, onRemove, onClose }) {
  if (!post) return null;

  const author = post.name || (post.user_id != null ? `User #${post.user_id}` : 'unknown author');
  const rawReports = Number(post.report_count);
  const reports = Number.isFinite(rawReports) ? rawReports : null;
  const image = String(post.image_url || '').trim();

  return (
    <Modal
      title={`Post #${post.id} by ${plainPreview(author, 48)}`}
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
          <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{plainPreview(author, 48)}</div>
          <div style={{ fontSize: 12, color: C.textFaint }}>User #{post.user_id ?? '—'}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {post.drink ? <Badge label={plainPreview(post.drink, 18)} color={C.amber} bg={C.amber + '22'} /> : null}
          <Badge label={`🥂 ${fmtCount(post.cheer_count)}`} color={C.green} bg={C.green + '22'} />
          <Badge label={`💬 ${fmtCount(post.comment_count)}`} color={C.accentHi} bg={C.accent + '22'} />
          {reports != null && reports > 0
            ? <Badge label={`🚩 ${fmtCount(reports)}`} color={C.red} bg={C.red + '22'} />
            : null}
        </div>
      </div>

      {/* The content itself — a text node, never HTML */}
      <div style={{
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px',
        color: C.text, fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: 320, overflowY: 'auto',
      }}>
        {plainPreview(post.content, 4000) || <span style={{ color: C.textFaint }}>(no text on this post)</span>}
      </div>

      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '10px 18px', margin: '18px 0 0', fontSize: 12.5, lineHeight: 1.5 }}>
        <Row label="Location text">
          {post.location ? plainPreview(post.location, 120) : <span style={{ color: C.textFaint }}>not set</span>}
        </Row>
        <Row label="Posted">{fmtDateTime(post.created_at)}</Row>
        <Row label="Reports">
          {reports == null
            ? <span style={{ color: C.textFaint }}>unknown</span>
            : reports === 0
              ? <span style={{ color: C.textFaint }}>none</span>
              : `${fmtCount(reports)} report${reports === 1 ? '' : 's'} — reasons and reporters are in the Reports queue`}
        </Row>
        <Row label="Image">
          <ImagePreview url={image} label="image" maxHeight={300} />
        </Row>
      </dl>

      <div style={{ marginTop: 18, fontSize: 11.5, color: C.textFaint, lineHeight: 1.6 }}>
        Opening a post is read-only and does not notify the author. Post text is rendered as plain text, so
        markup in a post cannot execute here.
      </div>
    </Modal>
  );
}
