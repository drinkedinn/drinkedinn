import { useState, useEffect } from 'react';
import api from '../api';
import { useTheme } from '../context/ThemeContext';
import PostCard from './PostCard';

const ENDPOINTS = {
  home: '/posts',
  explore: '/posts/explore',
  trips: '/posts/trips',
  cheered: '/posts/cheered',
};

const EMPTY_MESSAGES = {
  home: { icon: '🥃', text: 'No pours yet. Be the first to share!' },
  explore: { icon: '🔥', text: 'Nothing trending yet. Start pouring!' },
  trips: { icon: '✈️', text: 'No travel pours yet. Tag a location in your next post!' },
  cheered: { icon: '🥂', text: "You haven't cheered any posts yet. Go explore and raise a glass!" },
  hashtag: { icon: '#️⃣', text: 'No posts with this hashtag yet.' },
};

export default function Feed({ mode = 'home', hashtag = null, onUserClick, refresh }) {
  const { t } = useTheme();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const url = hashtag
        ? `/posts/hashtag/${encodeURIComponent(hashtag.replace('#', ''))}`
        : (ENDPOINTS[mode] || '/posts');
      const { data } = await api.get(url);
      setPosts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [mode, hashtag, refresh]);

  const handleDelete = id => setPosts(p => p.filter(post => post.id !== id));

  const emptyMsg = EMPTY_MESSAGES[hashtag ? 'hashtag' : mode] || EMPTY_MESSAGES.home;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 3D gyro loader */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '12px 0 4px' }}>
        <span className="gyro-loader">🥃</span>
        <span style={{ color: t.textMuted, fontSize: 14, fontStyle: 'italic' }}>Pouring your feed…</span>
      </div>
      {/* 3D skeleton cards */}
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton-3d" style={{
          background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
          boxShadow: t.shadow, overflow: 'hidden', padding: 20,
          animationDelay: `${i * 0.18}s`,
        }}>
          {/* Avatar row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: t.border }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, borderRadius: 6, background: t.border, marginBottom: 6, width: '40%' }} />
              <div style={{ height: 10, borderRadius: 6, background: t.border, width: '25%' }} />
            </div>
          </div>
          {/* Content lines */}
          {[100, 85, 65].map((w, j) => (
            <div key={j} style={{ height: 11, borderRadius: 6, background: t.border, marginBottom: 8, width: `${w}%` }} />
          ))}
          {/* Action row */}
          <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
            {[60, 60, 50].map((w, j) => (
              <div key={j} style={{ height: 10, borderRadius: 6, background: t.border, width: w }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (!posts.length) return (
    <div style={{
      background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
      padding: 40, textAlign: 'center', color: t.textMuted, boxShadow: t.shadow,
      transition: 'background 0.3s',
    }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{emptyMsg.icon}</div>
      <div style={{ fontSize: 16 }}>{emptyMsg.text}</div>
    </div>
  );

  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} onUserClick={onUserClick} onDelete={handleDelete} />
      ))}
    </div>
  );
}
