import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import PostCard from './PostCard';
import EditProfileModal from './EditProfileModal';
import MyBarPage from './MyBarPage';

export default function ProfilePage({ userId, onBack, onUserClick }) {
  const { user: me, refreshUser } = useAuth();
  const { t } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [profileTab, setProfileTab] = useState('pours');

  const loadProfile = () => {
    setLoading(true);
    api.get(`/users/${userId}`).then(r => setProfile(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { loadProfile(); }, [userId]);

  const toggleConnect = async () => {
    const { data } = await api.post(`/users/${userId}/connect`);
    setProfile(p => ({ ...p, isConnected: data.connected, connections: p.connections + (data.connected ? 1 : -1) }));
  };

  const handleEditClose = async () => {
    setShowEdit(false);
    await refreshUser();
    loadProfile();
  };

  if (loading) return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 16px', color: t.textMuted, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🥃</div>
      <div>Loading profile…</div>
    </div>
  );
  if (!profile) return null;

  const isMe = me?.id === parseInt(userId);

  return (
    <div style={{ maxWidth: 700, margin: '24px auto', padding: '0 16px' }}>
      {showEdit && <EditProfileModal onClose={handleEditClose} />}

      <button onClick={onBack} style={{
        background: t.card, border: `1.5px solid ${t.border}`, borderRadius: 20,
        padding: '8px 16px', color: t.textMuted, fontSize: 13, cursor: 'pointer', marginBottom: 16,
        boxShadow: t.shadow, transition: 'border-color 0.2s, color 0.2s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
      >← Back</button>

      <div className="fadeInUp" style={{
        background: t.card, borderRadius: 16, overflow: 'hidden',
        border: `1px solid ${t.border}`, marginBottom: 16, boxShadow: t.shadow,
        transition: 'background 0.3s, border-color 0.3s',
      }}>
        <div style={{ height: 120, background: 'linear-gradient(135deg, #0a66c2 0%, #f5a623 100%)', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'url(https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&q=40) center/cover', opacity: 0.15 }} />
        </div>
        <div style={{ padding: '0 24px 24px', marginTop: -36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
            <img src={profile.avatar} alt="" style={{
              width: 80, height: 80, borderRadius: '50%', border: `4px solid ${t.card}`,
              objectFit: 'cover', boxShadow: t.shadowMd,
            }}
              onError={e => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}`; }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              {isMe ? (
                <button onClick={() => setShowEdit(true)} style={{
                  background: t.cardAlt, border: `1.5px solid ${t.border}`,
                  borderRadius: 24, padding: '10px 20px', color: t.textSub,
                  fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSub; }}
                >✏️ Edit Profile</button>
              ) : (
                <button onClick={toggleConnect} style={{
                  background: profile.isConnected ? t.cardAlt : 'linear-gradient(135deg, #f5a623, #ffcc5c)',
                  border: profile.isConnected ? `1.5px solid ${t.border}` : 'none',
                  borderRadius: 24, padding: '10px 24px',
                  color: profile.isConnected ? t.textMuted : '#fff',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: profile.isConnected ? 'none' : '0 4px 16px rgba(245,166,35,0.35)',
                }}>
                  {profile.isConnected ? '✓ Connected' : '+ Connect'}
                </button>
              )}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>
              {profile.name} <span style={{ color: t.link, fontSize: 16 }}>✓</span>
            </div>
            <div style={{ color: t.textMuted, fontSize: 14, marginTop: 4 }}>{profile.title}</div>
            {profile.bio && <div style={{ color: t.textSub, fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>{profile.bio}</div>}

            <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
              {[
                ['🔗', profile.connections, 'Connections'],
                ['📝', profile.posts?.length || 0, 'Posts'],
              ].map(([icon, val, label]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: t.accent }}>{val}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>{icon} {label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: t.card, borderRadius: 12, padding: 4, border: `1px solid ${t.border}` }}>
        {[
          { id: 'pours', icon: '🥃', label: 'Pours' },
          { id: 'mybar', icon: '🍶', label: 'My Bar' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setProfileTab(tab.id)} style={{
            flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: profileTab === tab.id ? 'linear-gradient(135deg,#f5a623,#ffcc5c)' : 'none',
            color: profileTab === tab.id ? '#fff' : t.textMuted,
            fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
          }}>{tab.icon} {tab.label}</button>
        ))}
      </div>

      {profileTab === 'mybar' ? (
        <MyBarPage userId={userId} />
      ) : (
        <div>
          {profile.posts?.length === 0 ? (
            <div style={{
              background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
              padding: 40, textAlign: 'center', color: t.textMuted,
              transition: 'background 0.3s',
            }}>
              <div style={{ fontSize: 40 }}>🥃</div>
              <div style={{ marginTop: 8 }}>
                {isMe ? "You haven't poured anything yet. Share your first drink!" : 'No pours yet'}
              </div>
            </div>
          ) : (
            profile.posts?.map(post => (
              <PostCard key={post.id} post={post} onUserClick={onUserClick} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
