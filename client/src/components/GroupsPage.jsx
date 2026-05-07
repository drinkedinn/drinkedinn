import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DRINK_TYPES = ['🥃','🍷','🍺','🍹','🍸','🥂','🍶','🧉'];

function GroupDetailPage({ groupId, onBack, t }) {
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  const load = () => api.get(`/groups/${groupId}`).then(r => setGroup(r.data)).catch(() => {});
  useEffect(() => { load(); }, [groupId]);

  const toggleJoin = async () => {
    const { data } = await api.post(`/groups/${groupId}/join`);
    setGroup(g => ({ ...g, is_member: data.joined ? 1 : 0, member_count: g.member_count + (data.joined ? 1 : -1) }));
  };

  const postInGroup = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/groups/${groupId}/posts`, { content });
      setGroup(g => ({ ...g, posts: [data, ...g.posts] }));
      setContent('');
    } finally { setPosting(false); }
  };

  if (!group) return <div style={{ padding: 40, textAlign: 'center', color: t.textMuted }}>Loading group…</div>;

  const cardStyle = { background: t.card, borderRadius: 14, padding: 16, border: `1px solid ${t.border}`, boxShadow: t.shadow, marginBottom: 12 };

  return (
    <div>
      <button onClick={onBack} style={{ background: t.card, border: `1.5px solid ${t.border}`, borderRadius: 20, padding: '8px 16px', color: t.textMuted, fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>← All Groups</button>

      {/* Group header */}
      <div style={{ ...cardStyle, overflow: 'hidden', padding: 0, marginBottom: 16 }}>
        <div style={{ height: 80, background: 'linear-gradient(135deg, #0a66c2, #f5a623)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>{group.drink_type}</div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20, color: t.text }}>{group.name}</div>
              <div style={{ color: t.textMuted, fontSize: 14, marginTop: 4 }}>{group.description}</div>
              <div style={{ color: t.textFaint, fontSize: 12, marginTop: 6 }}>{group.member_count} members</div>
            </div>
            <button onClick={toggleJoin} style={{
              background: group.is_member ? t.cardAlt : 'linear-gradient(135deg,#f5a623,#ffcc5c)',
              border: group.is_member ? `1.5px solid ${t.border}` : 'none', borderRadius: 20,
              padding: '10px 20px', color: group.is_member ? t.textMuted : '#fff',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>{group.is_member ? '✓ Joined' : '+ Join'}</button>
          </div>

          {/* Members row */}
          <div style={{ display: 'flex', gap: -6, marginTop: 14 }}>
            {group.members?.slice(0, 8).map((m, i) => (
              <img key={m.id} src={m.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${t.card}`, objectFit: 'cover', marginLeft: i > 0 ? -8 : 0 }} />
            ))}
            {group.members?.length > 8 && <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.cardAlt, border: `2px solid ${t.card}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: t.textMuted, marginLeft: -8 }}>+{group.members.length - 8}</div>}
          </div>
        </div>
      </div>

      {/* Post in group */}
      {group.is_member ? (
        <div style={{ ...cardStyle }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <img src={user?.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Share something with the group…"
              style={{ flex: 1, background: t.inputBg, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: '10px 14px', color: t.text, fontSize: 14, outline: 'none', resize: 'none', minHeight: 70, fontFamily: 'Inter,sans-serif' }}
              onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border}
            />
          </div>
          {content.trim() && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={postInGroup} disabled={posting} style={{ background: 'linear-gradient(135deg,#f5a623,#ffcc5c)', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {posting ? '…' : 'Pour 🥃'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...cardStyle, textAlign: 'center', color: t.textMuted, padding: 20 }}>
          Join this group to post and participate
        </div>
      )}

      {/* Group posts */}
      {group.posts?.map(p => (
        <div key={p.id} style={cardStyle}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <img src={p.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{p.name} <span style={{ color: t.link, fontSize: 12 }}>✓</span></div>
              <div style={{ fontSize: 11, color: t.textFaint }}>{p.title}</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 20 }}>{p.drink}</span>
          </div>
          <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{p.content}</div>
        </div>
      ))}
      {group.posts?.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', color: t.textMuted }}>No posts yet. Be the first!</div>}
    </div>
  );
}

export default function GroupsPage() {
  const { t } = useTheme();
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', drink_type: '🥃' });
  const [creating, setCreating] = useState(false);

  useEffect(() => { api.get('/groups').then(r => setGroups(r.data)).catch(() => {}); }, []);

  const createGroup = async () => {
    if (!newGroup.name.trim() || creating) return;
    setCreating(true);
    try {
      const { data } = await api.post('/groups', newGroup);
      setGroups(g => [{ ...data, member_count: 1, is_member: 1 }, ...g]);
      setShowCreate(false); setNewGroup({ name: '', description: '', drink_type: '🥃' });
      setActiveGroup(data.id);
    } finally { setCreating(false); }
  };

  if (activeGroup) return <GroupDetailPage groupId={activeGroup} onBack={() => { setActiveGroup(null); api.get('/groups').then(r => setGroups(r.data)).catch(()=>{}); }} t={t} />;

  const cardStyle = { background: t.card, borderRadius: 16, border: `1px solid ${t.border}`, boxShadow: t.shadow, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: t.text }}>🍶 Drink Groups</div>
        <button onClick={() => setShowCreate(true)} style={{ background: 'linear-gradient(135deg,#f5a623,#ffcc5c)', border: 'none', borderRadius: 20, padding: '10px 20px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+ Create Group</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {groups.map(g => (
          <div key={g.id} style={cardStyle} onClick={() => setActiveGroup(g.id)}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = t.shadowMd; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = t.shadow; }}
          >
            <div style={{ height: 64, background: 'linear-gradient(135deg, #0a66c2, #f5a623)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>{g.drink_type}</div>
            <div style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: t.text, marginBottom: 4 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{g.description}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: t.textFaint }}>👥 {g.member_count} members</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: g.is_member ? t.accent : t.link }}>{g.is_member ? '✓ Joined' : 'View →'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: t.overlay, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowCreate(false)}>
          <div className="popIn" style={{ background: t.card, borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, border: `1px solid ${t.border}`, boxShadow: t.shadowLg }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: t.text }}>Create a Group</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {DRINK_TYPES.map(d => (
                <button key={d} onClick={() => setNewGroup(g => ({ ...g, drink_type: d }))} style={{ fontSize: 22, background: newGroup.drink_type === d ? t.accentSoft : t.cardAlt, border: `2px solid ${newGroup.drink_type === d ? t.accent : t.border}`, borderRadius: 10, width: 44, height: 44, cursor: 'pointer' }}>{d}</button>
              ))}
            </div>
            {[['Group Name *', 'name', 'e.g. Mumbai Whisky Society'], ['Description', 'description', 'What\'s this group about?']].map(([label, key, ph]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>
                <input value={newGroup[key]} onChange={e => setNewGroup(g => ({ ...g, [key]: e.target.value }))} placeholder={ph}
                  style={{ width: '100%', background: t.inputBg, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: '10px 14px', color: t.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} />
              </div>
            ))}
            <button onClick={createGroup} disabled={!newGroup.name.trim() || creating} style={{ width: '100%', background: newGroup.name.trim() ? 'linear-gradient(135deg,#f5a623,#ffcc5c)' : t.cardAlt, border: 'none', borderRadius: 20, padding: 12, color: newGroup.name.trim() ? '#fff' : t.textMuted, fontWeight: 700, fontSize: 14, cursor: newGroup.name.trim() ? 'pointer' : 'not-allowed' }}>
              {creating ? 'Creating…' : 'Create Group 🥃'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
