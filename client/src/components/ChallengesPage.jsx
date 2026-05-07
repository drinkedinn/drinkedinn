import { useState, useEffect } from 'react';
import api from '../api';
import { useTheme } from '../context/ThemeContext';

const fmtDate = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const daysLeft = d => Math.max(0, Math.ceil((new Date(d) - Date.now()) / 86400000));

export default function ChallengesPage() {
  const { t } = useTheme();
  const [challenges, setChallenges] = useState([]);
  const [leaderboards, setLeaderboards] = useState({});
  const [openLeaderboard, setOpenLeaderboard] = useState(null);

  useEffect(() => { api.get('/challenges').then(r => setChallenges(r.data)).catch(() => {}); }, []);

  const toggleJoin = async (challenge) => {
    const { data } = await api.post(`/challenges/${challenge.id}/join`);
    setChallenges(c => c.map(ch => ch.id === challenge.id ? { ...ch, is_joined: data.joined ? 1 : 0, participant_count: ch.participant_count + (data.joined ? 1 : -1) } : ch));
  };

  const loadLeaderboard = async (id) => {
    if (openLeaderboard === id) { setOpenLeaderboard(null); return; }
    const { data } = await api.get(`/challenges/${id}/leaderboard`);
    setLeaderboards(lb => ({ ...lb, [id]: data }));
    setOpenLeaderboard(id);
  };

  const cardStyle = { background: t.card, borderRadius: 16, padding: 20, border: `1px solid ${t.border}`, boxShadow: t.shadow, marginBottom: 14 };

  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 20, color: t.text, marginBottom: 16 }}>⚡ Monthly Challenges</div>
      <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 20 }}>Join a challenge, sip your way to glory, and climb the leaderboard.</div>

      {challenges.map(c => (
        <div key={c.id} style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ fontSize: 40, flexShrink: 0 }}>{c.drink_emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: t.text }}>{c.title}</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>{c.description}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: t.textFaint }}>
                <span>👥 {c.participant_count} joined</span>
                <span>⏳ {daysLeft(c.end_date)} days left</span>
                <span>📅 Ends {fmtDate(c.end_date)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => toggleJoin(c)} style={{
                background: c.is_joined ? t.cardAlt : 'linear-gradient(135deg,#f5a623,#ffcc5c)',
                border: c.is_joined ? `1.5px solid ${t.border}` : 'none',
                borderRadius: 20, padding: '8px 18px',
                color: c.is_joined ? t.textMuted : '#fff',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>{c.is_joined ? '✓ Joined' : 'Join Challenge'}</button>
              <button onClick={() => loadLeaderboard(c.id)} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 20, padding: '6px 14px', color: t.textMuted, fontSize: 12, cursor: 'pointer' }}>
                {openLeaderboard === c.id ? '▲ Hide Board' : '🏆 Leaderboard'}
              </button>
            </div>
          </div>

          {/* Progress bar if joined */}
          {c.is_joined && (
            <div style={{ marginTop: 14, background: t.cardAlt, borderRadius: 6, height: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (1 - daysLeft(c.end_date) / 31) * 100)}%`, background: 'linear-gradient(90deg,#f5a623,#ffcc5c)', borderRadius: 6 }} />
            </div>
          )}

          {/* Leaderboard */}
          {openLeaderboard === c.id && leaderboards[c.id] && (
            <div style={{ marginTop: 16, borderTop: `1px solid ${t.borderSub}`, paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Leaderboard</div>
              {leaderboards[c.id].length === 0 && <div style={{ color: t.textFaint, fontSize: 13 }}>No participants yet</div>}
              {leaderboards[c.id].map((entry, i) => (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < leaderboards[c.id].length - 1 ? `1px solid ${t.borderSub}` : 'none' }}>
                  <div style={{ width: 24, fontWeight: 800, fontSize: 14, color: i < 3 ? ['#f5a623','#aaa','#cd7f32'][i] : t.textFaint, textAlign: 'center' }}>{i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}</div>
                  <img src={entry.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: t.text }}>{entry.name}</div>
                    <div style={{ fontSize: 11, color: t.textFaint }}>{entry.title}</div>
                  </div>
                  <div style={{ fontSize: 11, color: t.textFaint }}>Joined {new Date(entry.joined_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
