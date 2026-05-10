import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DRINK_FILTERS = ['All', '🥃', '🍺', '🍷', '🍹', '🍸', '🥂', '🍶', '🧉'];

export default function PeoplePage({ onUserClick }) {
  const { user } = useAuth();
  const { t } = useTheme();
  const [people, setPeople] = useState([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState({});

  useEffect(() => {
    api.get('/users/discover')
      .then(r => setPeople(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleConnect = async (person) => {
    setConnecting(c => ({ ...c, [person.id]: true }));
    try {
      const { data } = await api.post(`/users/${person.id}/connect`);
      setPeople(p => p.map(u => u.id === person.id
        ? { ...u, isConnected: data.connected, connections: u.connections + (data.connected ? 1 : -1) }
        : u
      ));
    } finally {
      setConnecting(c => ({ ...c, [person.id]: false }));
    }
  };

  const topDrink = (drinksJson) => {
    try {
      const d = typeof drinksJson === 'string' ? JSON.parse(drinksJson) : drinksJson;
      return Object.entries(d || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || '🥃';
    } catch { return '🥃'; }
  };

  const filtered = people.filter(p => {
    if (p.id === user?.id) return false;
    if (filter !== 'All' && topDrink(p.drinks) !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const cardStyle = { background: t.card, borderRadius: 16, padding: 20, border: `1px solid ${t.border}`, boxShadow: t.shadow, display: 'flex', alignItems: 'flex-start', gap: 14 };

  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 20, color: t.text, marginBottom: 4 }}>🫂 Find People</div>
      <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 16 }}>Connect with professionals who drink the good stuff.</div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: t.textMuted }}>🔍</span>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or title…"
          style={{ width: '100%', background: t.card, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: '12px 14px 12px 40px', color: t.text, fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
          onFocus={e => e.target.style.borderColor = t.accent}
          onBlur={e => e.target.style.borderColor = t.border}
        />
      </div>

      {/* Drink filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {DRINK_FILTERS.map(d => (
          <button key={d} onClick={() => setFilter(d)} style={{
            background: filter === d ? t.accentSoft : t.card,
            border: `1.5px solid ${filter === d ? t.accent : t.border}`,
            borderRadius: 20, padding: '6px 14px', color: filter === d ? t.accent : t.textMuted,
            fontWeight: filter === d ? 700 : 500, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s',
          }}>{d}</button>
        ))}
      </div>

      {/* Results count */}
      <div style={{ fontSize: 12, color: t.textFaint, marginBottom: 14 }}>
        {loading ? 'Finding people…' : `${filtered.length} people`}
      </div>

      {/* People grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && [1, 2, 3].map(i => (
          <div key={i} style={{ ...cardStyle, opacity: 0.5 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: t.cardAlt }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, width: 140, background: t.cardAlt, borderRadius: 6, marginBottom: 8 }} />
              <div style={{ height: 12, width: 200, background: t.cardAlt, borderRadius: 6 }} />
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 600 }}>No people found</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Try a different filter or search term</div>
          </div>
        )}

        {filtered.map(person => (
          <div key={person.id} style={cardStyle}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }} onClick={() => onUserClick?.(person.id)}>
              <img src={person.avatar} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${t.border}` }} />
              <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: 14, lineHeight: 1 }}>{topDrink(person.drinks)}</span>
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span onClick={() => onUserClick?.(person.id)} style={{ fontWeight: 700, fontSize: 15, color: t.text, cursor: 'pointer' }}
                  onMouseEnter={e => e.target.style.color = t.accent}
                  onMouseLeave={e => e.target.style.color = t.text}
                >{person.name}</span>
                <span style={{ color: t.link, fontSize: 12 }}>✓</span>
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.title}</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: t.textFaint }}>
                <span>🔗 {person.connections || 0} connections</span>
                {person.mutual > 0 && <span style={{ color: t.accent }}>· {person.mutual} mutual</span>}
              </div>
            </div>

            {/* Connect button */}
            <button
              onClick={() => toggleConnect(person)}
              disabled={connecting[person.id]}
              style={{
                flexShrink: 0,
                background: person.isConnected ? t.cardAlt : 'linear-gradient(135deg,#f5a623,#ffcc5c)',
                border: person.isConnected ? `1.5px solid ${t.border}` : 'none',
                borderRadius: 20, padding: '10px 20px',
                color: person.isConnected ? t.textMuted : '#fff',
                fontWeight: 700, fontSize: 13,
                cursor: connecting[person.id] ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {connecting[person.id] ? '…' : person.isConnected ? '✓ Connected' : '+ Connect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
