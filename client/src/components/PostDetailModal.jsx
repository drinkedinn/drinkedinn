import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const fmtNum = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;
const fmtTime = iso => {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function PostDetailModal({ post: initial, onClose, onUserClick }) {
  const { user } = useAuth();
  const { t } = useTheme();
  const [post, setPost] = useState(initial);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/posts/${post.id}/comments`)
      .then(r => setComments(r.data))
      .finally(() => setLoading(false));
  }, [post.id]);

  const cheer = async () => {
    const { data } = await api.post(`/posts/${post.id}/cheer`);
    setPost(p => ({ ...p, user_cheered: data.cheered ? 1 : 0, cheer_count: p.cheer_count + (data.cheered ? 1 : -1) }));
  };

  const submitComment = async () => {
    if (!comment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/posts/${post.id}/comments`, { content: comment });
      setComments(c => [...c, data]);
      setPost(p => ({ ...p, comment_count: p.comment_count + 1 }));
      setComment('');
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: t.overlay, backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div className="popIn" style={{
        background: t.card, borderRadius: 20, width: '100%', maxWidth: 640,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        border: `1px solid ${t.border}`, boxShadow: t.shadowLg, overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => { onUserClick?.(post.user_id); onClose(); }}>
            <img src={post.avatar} alt="" style={{ width: 46, height: 46, borderRadius: '50%', border: `2px solid ${t.accent}`, objectFit: 'cover' }} />
            <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: 13 }}>{post.drink}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div onClick={() => { onUserClick?.(post.user_id); onClose(); }} style={{ fontWeight: 700, fontSize: 15, color: t.text, cursor: 'pointer' }}>
              {post.name} <span style={{ color: t.link, fontSize: 12 }}>✓</span>
            </div>
            <div style={{ color: t.textMuted, fontSize: 12 }}>{post.title}</div>
            <div style={{ color: t.textFaint, fontSize: 11, display: 'flex', gap: 8 }}>
              <span>{fmtTime(post.created_at)}</span>
              {post.location && <><span>•</span><span>📍 {post.location}</span></>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
            onMouseEnter={e => e.target.style.color = t.danger}
            onMouseLeave={e => e.target.style.color = t.textMuted}
          >×</button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Post content */}
          <div style={{ padding: '16px 20px', lineHeight: 1.7, fontSize: 15, color: t.textSub, whiteSpace: 'pre-line' }}>
            {post.content}
          </div>

          {/* Hashtags */}
          {post.content?.match(/#[\w]+/g) && (
            <div style={{ padding: '0 20px 16px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[...new Set(post.content.match(/#[\w]+/g))].map(tag => (
                <span key={tag} style={{ color: t.link, fontSize: 13, fontWeight: 500 }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Image */}
          {post.image_url && (
            <div style={{ overflow: 'hidden' }}>
              <img src={post.image_url} alt="" style={{ width: '100%', objectFit: 'cover', display: 'block', maxHeight: 360 }}
                onError={e => e.target.style.display = 'none'}
              />
            </div>
          )}

          {/* Stats bar */}
          <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', color: t.textFaint, fontSize: 13, borderTop: `1px solid ${t.borderSub}`, borderBottom: `1px solid ${t.borderSub}` }}>
            <span>🍺 {fmtNum(post.cheer_count)} cheers</span>
            <span>{post.comment_count} comments · {fmtNum(post.repour_count)} repours</span>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', padding: '4px 8px', borderBottom: `1px solid ${t.borderSub}` }}>
            <button onClick={cheer} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px', borderRadius: 8,
              color: post.user_cheered ? t.accent : t.textMuted, fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = t.cardAlt; e.currentTarget.style.color = t.accent; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = post.user_cheered ? t.accent : t.textMuted; }}
            >
              <span style={{ fontSize: 16 }}>{post.user_cheered ? '🍺' : '🥂'}</span>
              <span>{post.user_cheered ? 'Cheers!' : 'Cheers'}</span>
            </button>
            <button onClick={() => { navigator.clipboard?.writeText(window.location.origin); }} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px', borderRadius: 8,
              color: t.textMuted, fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = t.cardAlt; e.currentTarget.style.color = t.accent; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = t.textMuted; }}
            >
              <span style={{ fontSize: 16 }}>📤</span><span>Share</span>
            </button>
          </div>

          {/* Comments */}
          <div style={{ padding: '12px 20px 80px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {post.comment_count} Comments
            </div>
            {loading && <div style={{ color: t.textMuted, fontSize: 13 }}>Loading comments…</div>}
            {!loading && comments.length === 0 && (
              <div style={{ textAlign: 'center', color: t.textMuted, fontSize: 13, padding: '20px 0' }}>
                No comments yet. Start the conversation! 🥃
              </div>
            )}
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <img src={c.avatar} alt="" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
                <div style={{ flex: 1, background: t.cardAlt, borderRadius: 12, padding: '10px 14px', border: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: t.textFaint }}>{fmtTime(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: t.textSub }}>{c.content}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sticky comment input */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${t.border}`, background: t.card, display: 'flex', gap: 10 }}>
          <img src={user?.avatar} alt="" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
          <input value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Write a comment…"
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment()}
            style={{
              flex: 1, background: t.inputBg, border: `1.5px solid ${t.border}`,
              borderRadius: 20, padding: '8px 16px', color: t.text, fontSize: 13, outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = t.accent}
            onBlur={e => e.target.style.borderColor = t.border}
          />
          {comment.trim() && (
            <button onClick={submitComment} disabled={submitting} style={{
              background: 'linear-gradient(135deg, #f5a623, #ffcc5c)',
              border: 'none', borderRadius: 20, padding: '8px 18px',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
              {submitting ? '…' : 'Post'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
