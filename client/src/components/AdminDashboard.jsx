import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useTheme } from '../context/ThemeContext';

const fmt = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;
const ago = ts => {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

function StatCard({ icon, label, value, sub, color = '#f5a623' }) {
  const { t } = useTheme();
  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`, borderRadius: 16,
      padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: t.shadow,
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: t.text }}>{fmt(value)}</div>
        <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: color, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  const { t } = useTheme();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 28, maxWidth: 360, width: '90%', boxShadow: t.shadowLg }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 20 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '9px 20px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.textSub, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { t } = useTheme();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [posts, setPosts] = useState([]);
  const [postTotal, setPostTotal] = useState(0);
  const [postPage, setPostPage] = useState(1);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const loadStats = useCallback(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/admin/activity').then(r => setActivity(r.data)).catch(() => {});
  }, []);

  const loadUsers = useCallback(() => {
    setLoading(true);
    api.get(`/admin/users?search=${encodeURIComponent(userSearch)}&page=${userPage}`)
      .then(r => { setUsers(r.data.users); setUserTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userSearch, userPage]);

  const loadPosts = useCallback(() => {
    setLoading(true);
    api.get(`/admin/posts?page=${postPage}`)
      .then(r => { setPosts(r.data.posts); setPostTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postPage]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab, loadUsers]);
  useEffect(() => { if (tab === 'posts') loadPosts(); }, [tab, loadPosts]);

  const deleteUser = async id => {
    await api.delete(`/admin/users/${id}`);
    setConfirm(null);
    loadUsers();
    loadStats();
  };

  const deletePost = async id => {
    await api.delete(`/admin/posts/${id}`);
    setConfirm(null);
    loadPosts();
    loadStats();
  };

  const tabs = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'users',    icon: '👥', label: 'Users' },
    { id: 'posts',    icon: '📝', label: 'Posts' },
    { id: 'activity', icon: '⚡', label: 'Activity' },
  ];

  return (
    <div style={{ minHeight: '80vh' }}>
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Header */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, boxShadow: t.shadow }}>
        <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg,#f5a623,#ff6b35)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🛡️</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: t.text }}>Admin Dashboard</div>
          <div style={{ color: t.textMuted, fontSize: 13 }}>Full platform control · DrinkedInn</div>
        </div>
        <button onClick={loadStats} style={{ marginLeft: 'auto', background: t.cardAlt, border: `1px solid ${t.border}`, borderRadius: 10, padding: '8px 16px', cursor: 'pointer', color: t.textSub, fontWeight: 600, fontSize: 13 }}>
          ↻ Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 6, boxShadow: t.shadow }}>
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{
            flex: 1, padding: '10px 8px', border: 'none', borderRadius: 10, cursor: 'pointer',
            background: tab === tb.id ? 'linear-gradient(135deg,#f5a623,#ffcc5c)' : 'none',
            color: tab === tb.id ? '#fff' : t.textMuted,
            fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
          }}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
            <StatCard icon="👥" label="Total Users"    value={stats.users}       sub={`+${stats.usersToday} today`}  color="#6366f1" />
            <StatCard icon="📝" label="Total Posts"    value={stats.posts}       sub={`+${stats.postsToday} today`}  color="#f5a623" />
            <StatCard icon="🥂" label="Cheers"         value={stats.cheers}      color="#22c55e" />
            <StatCard icon="💬" label="Comments"       value={stats.comments}    color="#06b6d4" />
            <StatCard icon="🤝" label="Connections"    value={stats.connections} color="#8b5cf6" />
            <StatCard icon="📨" label="Messages"       value={stats.messages}    color="#ec4899" />
            <StatCard icon="📸" label="Stories"        value={stats.stories}     color="#f97316" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Top Posters */}
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, boxShadow: t.shadow }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: t.text, marginBottom: 14 }}>🏆 Top Posters</div>
              {stats.topPosters.map((u, i) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, color: t.textFaint, width: 18, fontSize: 12 }}>{i + 1}</span>
                  <img src={u.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: t.text, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                    <div style={{ color: t.textMuted, fontSize: 11 }}>{u.title}</div>
                  </div>
                  <span style={{ background: '#f5a62322', color: '#f5a623', borderRadius: 8, padding: '2px 8px', fontWeight: 700, fontSize: 12 }}>{u.post_count} posts</span>
                </div>
              ))}
            </div>

            {/* Recent Signups */}
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, boxShadow: t.shadow }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: t.text, marginBottom: 14 }}>🆕 Recent Signups</div>
              {stats.recentSignups.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <img src={u.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: t.text, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                    <div style={{ color: t.textMuted, fontSize: 11 }}>{u.email}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: t.textFaint }}>{ago(u.created_at)}</div>
                    {!u.onboarded && <span style={{ fontSize: 10, color: '#f97316', fontWeight: 600 }}>pending</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── USERS ── */}
      {tab === 'users' && (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: t.shadow }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              placeholder="Search users…"
              value={userSearch}
              onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
              style={{ flex: 1, background: t.inputBg, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: '9px 14px', color: t.text, fontSize: 14, outline: 'none' }}
            />
            <span style={{ color: t.textMuted, fontSize: 13, whiteSpace: 'nowrap' }}>{userTotal} users</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: t.textMuted }}>Loading…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: t.cardAlt }}>
                    {['User', 'Email', 'Title', 'Posts', 'Connections', 'Joined', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: t.textMuted, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderTop: `1px solid ${t.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = t.cardAlt}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <img src={u.avatar} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                          <span style={{ fontWeight: 600, color: t.text }}>{u.name}</span>
                          {u.id === 1 && <span style={{ background: '#f5a62322', color: '#f5a623', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6 }}>ADMIN</span>}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: t.textMuted }}>{u.email}</td>
                      <td style={{ padding: '10px 14px', color: t.textSub, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.title}</td>
                      <td style={{ padding: '10px 14px', color: t.text, fontWeight: 600, textAlign: 'center' }}>{u.post_count}</td>
                      <td style={{ padding: '10px 14px', color: t.text, fontWeight: 600, textAlign: 'center' }}>{u.connection_count}</td>
                      <td style={{ padding: '10px 14px', color: t.textFaint, whiteSpace: 'nowrap' }}>{ago(u.created_at)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {u.id !== 1 && (
                          <button
                            onClick={() => setConfirm({ message: `Delete "${u.name}"? This will remove all their posts, connections, and messages.`, onConfirm: () => deleteUser(u.id) })}
                            style={{ background: '#ef444422', border: '1px solid #ef444455', borderRadius: 8, padding: '5px 12px', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                          >
                            🗑 Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {userTotal > 30 && (
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage === 1}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.textSub, cursor: userPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>← Prev</button>
              <span style={{ color: t.textMuted, fontSize: 13 }}>Page {userPage} of {Math.ceil(userTotal / 30)}</span>
              <button onClick={() => setUserPage(p => p + 1)} disabled={userPage >= Math.ceil(userTotal / 30)}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.textSub, cursor: userPage >= Math.ceil(userTotal / 30) ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* ── POSTS ── */}
      {tab === 'posts' && (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: t.shadow }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: t.text }}>All Posts</span>
            <span style={{ color: t.textMuted, fontSize: 13 }}>{postTotal} total</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: t.textMuted }}>Loading…</div>
          ) : (
            posts.map(p => (
              <div key={p.id} style={{ display: 'flex', gap: 12, padding: '14px 20px', borderTop: `1px solid ${t.border}`, alignItems: 'flex-start' }}>
                <img src={p.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: t.text, fontSize: 13 }}>{p.name}</span>
                    <span style={{ color: t.textFaint, fontSize: 11 }}>{ago(p.created_at)}</span>
                    {p.drink && <span style={{ background: t.cardAlt, borderRadius: 6, padding: '1px 7px', fontSize: 11, color: t.textMuted }}>{p.drink}</span>}
                  </div>
                  <div style={{ color: t.textSub, fontSize: 13, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.content}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: t.textFaint }}>🥂 {p.cheer_count}</span>
                    <span style={{ fontSize: 11, color: t.textFaint }}>💬 {p.comment_count}</span>
                    {p.location && <span style={{ fontSize: 11, color: t.textFaint }}>📍 {p.location}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setConfirm({ message: `Delete this post by ${p.name}?`, onConfirm: () => deletePost(p.id) })}
                  style={{ background: '#ef444422', border: '1px solid #ef444455', borderRadius: 8, padding: '5px 10px', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: 12, flexShrink: 0 }}
                >
                  🗑
                </button>
              </div>
            ))
          )}

          {postTotal > 30 && (
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPostPage(p => Math.max(1, p - 1))} disabled={postPage === 1}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.textSub, cursor: postPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>← Prev</button>
              <span style={{ color: t.textMuted, fontSize: 13 }}>Page {postPage} of {Math.ceil(postTotal / 30)}</span>
              <button onClick={() => setPostPage(p => p + 1)} disabled={postPage >= Math.ceil(postTotal / 30)}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardAlt, color: t.textSub, cursor: postPage >= Math.ceil(postTotal / 30) ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVITY ── */}
      {tab === 'activity' && (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: t.shadow }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, fontWeight: 700, color: t.text }}>Live Activity Feed</div>
          {activity.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: i > 0 ? `1px solid ${t.border}` : 'none' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: a.type === 'signup' ? '#6366f122' : '#f5a62322', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {a.type === 'signup' ? '🆕' : '📝'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: t.text, fontSize: 13 }}>{a.name} </span>
                <span style={{ color: t.textMuted, fontSize: 13 }}>
                  {a.type === 'signup' ? 'joined DrinkedInn' : 'posted: '}
                </span>
                {a.type === 'post' && (
                  <span style={{ color: t.textSub, fontSize: 13, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                    "{a.detail}"
                  </span>
                )}
              </div>
              <span style={{ color: t.textFaint, fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>{ago(a.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
