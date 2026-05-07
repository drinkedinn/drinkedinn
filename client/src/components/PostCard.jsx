import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import PostDetailModal from './PostDetailModal';
import PollWidget from './PollWidget';

const fmtNum = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;
const fmtTime = iso => {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function PostCard({ post: initial, onUserClick, onDelete, style: extraStyle = {} }) {
  const { user } = useAuth();
  const { t } = useTheme();
  const [post, setPost] = useState(initial);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cheerAnim, setCheerAnim] = useState(false);
  const [connected, setConnected] = useState(!!initial.user_connected);
  const [connecting, setConnecting] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => { setPost(initial); setConnected(!!initial.user_connected); }, [initial]);

  const cheer = async () => {
    setCheerAnim(true);
    setTimeout(() => setCheerAnim(false), 600);
    const { data } = await api.post(`/posts/${post.id}/cheer`);
    setPost(p => ({ ...p, user_cheered: data.cheered ? 1 : 0, cheer_count: p.cheer_count + (data.cheered ? 1 : -1) }));
  };

  const repour = async () => {
    const { data } = await api.post(`/posts/${post.id}/repour`);
    setPost(p => ({ ...p, user_repoured: data.repoured ? 1 : 0, repour_count: p.repour_count + (data.repoured ? 1 : -1) }));
  };

  const connect = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const { data } = await api.post(`/users/${post.user_id}/connect`);
      setConnected(data.connected);
    } finally {
      setConnecting(false);
    }
  };

  const loadComments = async () => {
    if (!showComments) {
      const { data } = await api.get(`/posts/${post.id}/comments`);
      setComments(data);
    }
    setShowComments(p => !p);
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

  const deletePost = async () => {
    if (!window.confirm('Delete this post?')) return;
    await api.delete(`/posts/${post.id}`);
    onDelete?.(post.id);
  };

  const isOwn = user?.id === post.user_id;

  return (
    <>
    {showDetail && <PostDetailModal post={post} onClose={() => setShowDetail(false)} onUserClick={onUserClick} />}
    <div className="fadeInUp" style={{
      background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
      marginBottom: 16, overflow: 'hidden', boxShadow: t.shadow,
      transition: 'box-shadow 0.2s, transform 0.2s, background 0.3s, border-color 0.3s',
      ...extraStyle,
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = t.shadowMd; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = t.shadow; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 12px' }}>
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => onUserClick?.(post.user_id)}>
          <img src={post.avatar} alt="" style={{ width: 48, height: 48, borderRadius: '50%', border: `2px solid ${t.accent}`, objectFit: 'cover' }} />
          <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: 14 }}>{post.drink}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span onClick={() => onUserClick?.(post.user_id)} style={{ fontWeight: 700, fontSize: 15, color: t.text, cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = t.accent}
              onMouseLeave={e => e.target.style.color = t.text}
            >{post.name}</span>
            <span style={{ fontSize: 13, color: t.link }}>✓</span>
          </div>
          <div style={{ color: t.textMuted, fontSize: 12, marginTop: 1 }}>{post.title}</div>
          <div style={{ color: t.textFaint, fontSize: 11, marginTop: 2, display: 'flex', gap: 8 }}>
            <span>{fmtTime(post.created_at)}</span>
            {post.location && <><span>•</span><span>📍 {post.location}</span></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isOwn && (
            <button onClick={connect} disabled={connecting} style={{
              background: connected ? t.cardAlt : t.accentSoft,
              border: `1.5px solid ${connected ? t.border : t.accent}`,
              borderRadius: 20, padding: '6px 16px',
              color: connected ? t.textMuted : t.accent,
              fontSize: 13, fontWeight: 600, cursor: connecting ? 'wait' : 'pointer',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { if (!connecting) { e.currentTarget.style.background = connected ? t.dangerBg : t.accentSoftHover; e.currentTarget.style.borderColor = connected ? t.danger : t.accent; e.currentTarget.style.color = connected ? t.danger : t.accent; }}}
              onMouseLeave={e => { e.currentTarget.style.background = connected ? t.cardAlt : t.accentSoft; e.currentTarget.style.borderColor = connected ? t.border : t.accent; e.currentTarget.style.color = connected ? t.textMuted : t.accent; }}
            >{connecting ? '…' : connected ? '✓ Connected' : '+ Connect'}</button>
          )}
          {isOwn && (
            <button onClick={deletePost} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 20, padding: '6px 12px', color: t.textFaint, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = t.danger; e.currentTarget.style.borderColor = t.danger; }}
              onMouseLeave={e => { e.currentTarget.style.color = t.textFaint; e.currentTarget.style.borderColor = t.border; }}
            >🗑️</button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px 14px', lineHeight: 1.7, fontSize: 15, color: t.textSub, whiteSpace: 'pre-line' }}>
        {post.content}
      </div>

      {/* Hashtags */}
      {post.content?.match(/#[\w]+/g) && (
        <div style={{ padding: '0 20px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[...new Set(post.content.match(/#[\w]+/g))].map(tag => (
            <span key={tag} style={{ color: t.link, fontSize: 13, cursor: 'pointer', fontWeight: 500, transition: 'opacity 0.2s' }}
              onMouseEnter={e => { e.target.style.textDecoration = 'underline'; e.target.style.opacity = '0.8'; }}
              onMouseLeave={e => { e.target.style.textDecoration = 'none'; e.target.style.opacity = '1'; }}
            >{tag}</span>
          ))}
        </div>
      )}

      {/* Image */}
      {post.image_url && (
        <div style={{ overflow: 'hidden', maxHeight: 420 }}>
          <img src={post.image_url} alt="" style={{ width: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.4s' }}
            onMouseEnter={e => e.target.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
            onError={e => e.target.style.display = 'none'}
          />
        </div>
      )}

      {/* Poll */}
      {post.has_poll === 1 && <PollWidget postId={post.id} />}

      {/* Map */}
      {post.lat && post.lng && (
        <div style={{ margin: '0 20px 14px', borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.border}`, position: 'relative' }}>
          <iframe
            title={`map-${post.id}`}
            width="100%" height="160" frameBorder="0" scrolling="no"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${post.lng-0.04},${post.lat-0.025},${post.lng+0.04},${post.lat+0.025}&layer=mapnik&marker=${post.lat},${post.lng}`}
            style={{ border: 'none', display: 'block' }}
          />
          <a href={`https://www.google.com/maps?q=${post.lat},${post.lng}`} target="_blank" rel="noreferrer"
            style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, textDecoration: 'none', backdropFilter: 'blur(4px)' }}>
            Open in Google Maps ↗
          </a>
        </div>
      )}

      {/* Stats */}
      <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', color: t.textFaint, fontSize: 13, borderBottom: `1px solid ${t.borderSub}` }}>
        <span>🍺 {fmtNum(post.cheer_count)} cheers</span>
        <span onClick={() => setShowDetail(true)} style={{ cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={e => e.target.style.color = t.textSub}
          onMouseLeave={e => e.target.style.color = t.textFaint}
        >
          {post.comment_count} comments · {fmtNum(post.repour_count)} repours
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', padding: '4px 8px' }}>
        {[
          {
            icon: <span style={{ display: 'inline-block', animation: cheerAnim ? 'cheerBounce 0.6s ease' : 'none', fontSize: 16 }}>{post.user_cheered ? '🍺' : '🥂'}</span>,
            label: post.user_cheered ? 'Cheers!' : 'Cheers', action: cheer, active: post.user_cheered
          },
          { icon: <span style={{ fontSize: 16 }}>💬</span>, label: `Comment`, action: loadComments },
          { icon: <span style={{ fontSize: 16, display: 'inline-block', transition: 'transform 0.3s', transform: post.user_repoured ? 'rotate(180deg)' : 'none' }}>🔄</span>, label: post.user_repoured ? 'Repoured' : 'Repour', action: repour, active: post.user_repoured },
          { icon: <span style={{ fontSize: 16 }}>📤</span>, label: 'Share', action: () => { navigator.clipboard?.writeText(window.location.origin + '?post=' + post.id); } },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px', borderRadius: 8,
            color: btn.active ? t.accent : t.textMuted, fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = t.cardAlt; e.currentTarget.style.color = t.accent; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = btn.active ? t.accent : t.textMuted; }}
          >
            {btn.icon}
            <span>{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Comments */}
      {showComments && (
        <div className="slideUp" style={{ padding: '12px 20px 16px', borderTop: `1px solid ${t.borderSub}`, background: t.cardAlt }}>
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', color: t.textMuted, fontSize: 13, padding: '8px 0 16px' }}>No comments yet. Be the first!</div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <img src={c.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
              <div style={{ flex: 1, background: t.card, borderRadius: 12, padding: '10px 14px', border: `1px solid ${t.border}` }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: t.text }}>{c.name}</div>
                <div style={{ fontSize: 14, color: t.textSub }}>{c.content}</div>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <img src={user?.avatar} alt="" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
            <div style={{ flex: 1, display: 'flex', gap: 8 }}>
              <input value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Add a comment…" onKeyDown={e => e.key === 'Enter' && submitComment()}
                style={{
                  flex: 1, background: t.card, border: `1.5px solid ${t.border}`,
                  borderRadius: 20, padding: '8px 16px', color: t.text, fontSize: 13, outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e => e.target.style.borderColor = t.border}
              />
              {comment && (
                <button onClick={submitComment} disabled={submitting} style={{
                  background: 'linear-gradient(135deg, #f5a623, #ffcc5c)',
                  border: 'none', borderRadius: 20, padding: '8px 16px',
                  color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>
                  {submitting ? '…' : 'Post'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
