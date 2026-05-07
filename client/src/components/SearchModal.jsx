import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useTheme } from '../context/ThemeContext';
import { useDebounce } from '../hooks/useDebounce';

const fmtNum = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;

export default function SearchModal({ onClose, onUserClick, onHashtagClick }) {
  const { t } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 350);
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults({ users: [], posts: [] }); return; }
    setLoading(true);
    api.get(`/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => setResults(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const hasResults = results.users.length > 0 || results.posts.length > 0;

  const handleHashtag = tag => {
    onHashtagClick?.(tag);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: t.overlay, backdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '80px 20px 20px',
    }} onClick={onClose}>
      <div className="popIn" style={{
        width: '100%', maxWidth: 620,
        background: t.card, borderRadius: 20, border: `1px solid ${t.border}`,
        boxShadow: t.shadowLg, overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontSize: 18, color: t.textMuted }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search people, drinks, places, #hashtags…"
            onKeyDown={e => {
              if (e.key === 'Enter' && query.startsWith('#')) handleHashtag(query);
              if (e.key === 'Escape') onClose();
            }}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 16, color: t.text, fontFamily: 'Inter, sans-serif',
            }}
          />
          {loading && <span style={{ fontSize: 14, color: t.textMuted, animation: 'shimmer 1s infinite' }}>⏳</span>}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {!query.trim() && (
            <div style={{ padding: 32, textAlign: 'center', color: t.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Search for people, drinks, or stories</div>
              <div style={{ fontSize: 13 }}>Try a name, a drink, a place, or a #hashtag</div>
            </div>
          )}

          {query.trim() && !loading && !hasResults && (
            <div style={{ padding: 40, textAlign: 'center', color: t.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🥃</div>
              <div>No results for "<strong>{query}</strong>"</div>
              {query.startsWith('#') && (
                <button onClick={() => handleHashtag(query)} style={{
                  marginTop: 12, background: t.accentSoft, border: `1px solid ${t.accent}`,
                  borderRadius: 20, padding: '8px 20px', color: t.accent, cursor: 'pointer', fontWeight: 600,
                }}>Browse posts tagged {query}</button>
              )}
            </div>
          )}

          {/* Hashtag shortcut */}
          {query.startsWith('#') && hasResults && (
            <div style={{ padding: '8px 20px', background: t.accentSoft, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: t.link, fontWeight: 700 }}>{query}</span>
              <button onClick={() => handleHashtag(query)} style={{
                background: t.accent, border: 'none', borderRadius: 20, padding: '4px 14px',
                color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12,
              }}>Browse all posts →</button>
            </div>
          )}

          {/* People */}
          {results.users.length > 0 && (
            <div>
              <div style={{ padding: '10px 20px 6px', fontSize: 12, color: t.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>People</div>
              {results.users.map(u => (
                <div key={u.id} onClick={() => { onUserClick?.(u.id); onClose(); }} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 20px', cursor: 'pointer', transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = t.cardAlt}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <img src={u.avatar} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${t.border}` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{u.name} <span style={{ color: t.link, fontSize: 12 }}>✓</span></div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>{u.title}</div>
                  </div>
                  <div style={{ fontSize: 12, color: t.textFaint }}>{u.connections} connections</div>
                </div>
              ))}
            </div>
          )}

          {/* Posts */}
          {results.posts.length > 0 && (
            <div style={{ borderTop: results.users.length ? `1px solid ${t.border}` : 'none' }}>
              <div style={{ padding: '10px 20px 6px', fontSize: 12, color: t.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Posts</div>
              {results.posts.map(p => (
                <div key={p.id} onClick={() => { onUserClick?.(p.user_id); onClose(); }} style={{
                  padding: '12px 20px', cursor: 'pointer', transition: 'background 0.15s',
                  borderBottom: `1px solid ${t.borderSub}`,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = t.cardAlt}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'center' }}>
                    <img src={p.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{p.name}</div>
                      {p.location && <div style={{ fontSize: 11, color: t.textMuted }}>📍 {p.location}</div>}
                    </div>
                    <span style={{ fontSize: 18 }}>{p.drink}</span>
                  </div>
                  <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {p.content}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: t.textFaint, display: 'flex', gap: 12 }}>
                    <span>🍺 {fmtNum(p.cheer_count)}</span>
                    <span>💬 {p.comment_count}</span>
                    <span style={{ marginLeft: 'auto', color: t.link, fontWeight: 500 }}>View profile →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
