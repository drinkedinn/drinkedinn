import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DRINK_RECS = {
  '🥃': [{ emoji: '🥃', name: 'Talisker 10yr', note: 'Smoky, peaty Scotch' }, { emoji: '🥃', name: 'Woodford Reserve', note: 'Rich bourbon, vanilla finish' }, { emoji: '🥃', name: 'Nikka Coffey Grain', note: 'Smooth Japanese whisky' }],
  '🍷': [{ emoji: '🍷', name: 'Barolo 2018', note: 'King of Italian reds' }, { emoji: '🍷', name: 'Sancerre Blanc', note: 'Crisp Loire Valley white' }, { emoji: '🍷', name: 'Malbec Reserva', note: 'Bold Argentine red' }],
  '🍺': [{ emoji: '🍺', name: 'Pliny the Elder', note: 'Legendary West Coast IPA' }, { emoji: '🍺', name: 'Weihenstephaner Hefeweiss', note: 'Bavarian wheat beer' }, { emoji: '🍺', name: 'Guinness Nitro IPA', note: 'Smooth nitrogen pour' }],
  '🍹': [{ emoji: '🍹', name: 'Mai Tai', note: 'Classic Polynesian tiki' }, { emoji: '🍹', name: 'Jungle Bird', note: 'Bitter & tropical' }, { emoji: '🍹', name: 'Painkiller', note: 'Pusser\'s rum, coconut' }],
  '🍸': [{ emoji: '🍸', name: 'Hendrick\'s Martini', note: 'Cucumber & rose petal' }, { emoji: '🍸', name: 'Negroni Sbagliato', note: 'Prosecco twist on Negroni' }, { emoji: '🍸', name: 'Last Word', note: 'Chartreuse & maraschino' }],
  '🥂': [{ emoji: '🥂', name: 'Krug Grande Cuvée', note: 'Prestige champagne' }, { emoji: '🥂', name: 'Nyetimber Classic', note: 'English sparkling wine' }, { emoji: '🥂', name: 'Billecart-Salmon Rosé', note: 'Pink celebration' }],
  '🍶': [{ emoji: '🍶', name: 'Dassai 45 Junmai', note: 'Polished, fruity sake' }, { emoji: '🍶', name: 'Hakkaisan Yukimuro', note: 'Snow-aged 3 years' }, { emoji: '🍶', name: 'Born Gold', note: 'Ultra-premium daiginjo' }],
  '🧉': [{ emoji: '🧉', name: 'Rosamonte Especial', note: 'Full-bodied Argentine blend' }, { emoji: '🧉', name: 'CBSé Energía', note: 'Yerba with guaraná' }, { emoji: '🧉', name: 'Cruz de Malta', note: 'Traditional mild mate' }],
};

export default function RightSidebar({ onUserClick, onHashtagClick }) {
  const { user } = useAuth();
  const { t } = useTheme();
  const [trending, setTrending] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  // Pick recommendations based on user's top drink preference
  let userDrinks = {};
  try { userDrinks = JSON.parse(user?.drinks || '{}'); } catch {}
  const topDrink = Object.entries(userDrinks).sort((a, b) => b[1] - a[1])[0]?.[0];
  const recs = topDrink ? (DRINK_RECS[topDrink] || []) : [];

  useEffect(() => {
    api.get('/posts/trending').then(r => setTrending(r.data)).catch(() => {});
    api.get('/users/suggestions').then(r => setSuggestions(r.data)).catch(() => {});
  }, []);

  const toggleConnect = async (user) => {
    const { data } = await api.post(`/users/${user.id}/connect`);
    setSuggestions(prev => prev.map(u => u.id === user.id ? { ...u, is_connected: data.connected ? 1 : 0 } : u));
  };

  const cardStyle = {
    background: t.card, borderRadius: 16, padding: 16,
    border: `1px solid ${t.border}`, boxShadow: t.shadow,
    transition: 'background 0.3s, border-color 0.3s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Trending */}
      <div style={cardStyle}>
        <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Trending Pours 🔥</div>
        {trending.length === 0 && <div style={{ color: t.textFaint, fontSize: 13, padding: '8px 0' }}>No trending hashtags yet…</div>}
        {trending.map((item, i) => (
          <div key={item.tag} onClick={() => onHashtagClick?.(item.tag)} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderBottom: i < trending.length - 1 ? `1px solid ${t.borderSub}` : 'none',
            cursor: 'pointer', transition: 'padding-left 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.paddingLeft = '6px'}
            onMouseLeave={e => e.currentTarget.style.paddingLeft = '0'}
          >
            <div>
              <div style={{ color: t.link, fontWeight: 600, fontSize: 14 }}>{item.tag}</div>
              <div style={{ color: t.textFaint, fontSize: 12 }}>{item.count} posts</div>
            </div>
            <span style={{ color: t.textFaint, fontSize: 18 }}>›</span>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div style={cardStyle}>
        <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pour Buddies 👥</div>
        {suggestions.length === 0 && <div style={{ color: t.textFaint, fontSize: 13 }}>Loading…</div>}
        {suggestions.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <img src={s.avatar} alt="" onClick={() => onUserClick?.(s.id)} style={{
              width: 42, height: 42, borderRadius: '50%', border: `2px solid ${t.border}`,
              objectFit: 'cover', cursor: 'pointer', transition: 'border-color 0.2s',
            }}
              onMouseEnter={e => e.target.style.borderColor = t.accent}
              onMouseLeave={e => e.target.style.borderColor = t.border}
            />
            <div style={{ flex: 1, minWidth: 0 }} onClick={() => onUserClick?.(s.id)}>
              <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', color: t.text }}>{s.name}</div>
              <div style={{ color: t.textFaint, fontSize: 11 }}>{s.mutual > 0 ? `${s.mutual} mutual pour buddies` : 'New on DrinkedInn'}</div>
            </div>
            <button onClick={() => toggleConnect(s)} style={{
              background: s.is_connected ? t.cardAlt : t.accentSoft,
              border: `1.5px solid ${s.is_connected ? t.border : t.accent + '80'}`,
              borderRadius: 16, padding: '5px 12px',
              color: s.is_connected ? t.textMuted : t.accent,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = s.is_connected ? t.dangerBg : t.accentSoftHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = s.is_connected ? t.cardAlt : t.accentSoft; }}
            >
              {s.is_connected ? '✓ Added' : '+ Add'}
            </button>
          </div>
        ))}
      </div>

      {/* Tonight's Vibe */}
      <div style={{
        background: t.vibeBg, borderRadius: 16, padding: 16,
        border: `1px solid ${t.vibeBorder}`, boxShadow: t.shadow,
        transition: 'background 0.3s',
      }}>
        <div style={{ fontSize: 12, color: t.accent, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tonight's Vibe 🌙</div>
        <div style={{ fontSize: 28, marginBottom: 6 }}>🥃🎵✨</div>
        <div style={{ fontSize: 14, color: t.text, fontWeight: 600 }}>Old Fashioned & Jazz</div>
        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Pour your story tonight</div>
        <button onClick={() => onHashtagClick?.('#jazz')} style={{
          marginTop: 12, width: '100%',
          background: 'linear-gradient(135deg, #f5a623, #ffcc5c)',
          border: 'none', borderRadius: 20, padding: '8px',
          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(245,166,35,0.3)', transition: 'opacity 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Join the Vibe
        </button>
      </div>

      {/* Drink Recommendations */}
      {recs.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Recommended For You {topDrink}</div>
          {recs.map((rec, i) => (
            <div key={rec.name} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < recs.length - 1 ? `1px solid ${t.borderSub}` : 'none', alignItems: 'center' }}>
              <div style={{ fontSize: 24, flexShrink: 0 }}>{rec.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{rec.name}</div>
                <div style={{ fontSize: 11, color: t.textFaint }}>{rec.note}</div>
              </div>
              <button onClick={() => onHashtagClick?.(`#${rec.name.split(' ')[0].toLowerCase()}`)} style={{
                background: 'none', border: `1px solid ${t.border}`, borderRadius: 20,
                padding: '4px 10px', color: t.textMuted, fontSize: 11, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
              >Explore</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: t.textFaint, lineHeight: 1.6, padding: '0 4px' }}>
        DrinkedInn · About · Privacy · No Business Talk Policy 🚫💼<br />
        DrinkedInn Corp © 2024
      </div>
    </div>
  );
}
