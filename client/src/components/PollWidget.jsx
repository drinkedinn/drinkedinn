import { useState, useEffect } from 'react';
import api from '../api';
import { useTheme } from '../context/ThemeContext';

export default function PollWidget({ postId }) {
  const { t } = useTheme();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/polls/${postId}`).then(r => setData(r.data)).catch(() => {});
  }, [postId]);

  const vote = async optionId => {
    const r = await api.post(`/polls/${postId}/vote`, { option_id: optionId });
    setData(r.data);
  };

  if (!data) return null;
  const { options, total } = data;
  const userVoted = options.find(o => o.user_voted);

  return (
    <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(opt => {
        const pct = total > 0 ? Math.round((opt.vote_count / total) * 100) : 0;
        const isVoted = opt.user_voted;
        return (
          <button key={opt.id} onClick={() => vote(opt.id)} style={{
            position: 'relative', width: '100%', textAlign: 'left',
            background: 'none', border: `2px solid ${isVoted ? t.accent : t.border}`,
            borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
            overflow: 'hidden', transition: 'border-color 0.2s',
          }}>
            {/* fill bar */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: userVoted ? `${pct}%` : '0%',
              background: isVoted ? t.accentSoft : t.cardAlt,
              transition: 'width 0.4s ease',
            }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: isVoted ? t.accent : t.textSub, fontWeight: isVoted ? 700 : 500 }}>
                {isVoted ? '✓ ' : ''}{opt.text}
              </span>
              {userVoted && <span style={{ fontSize: 13, fontWeight: 700, color: isVoted ? t.accent : t.textMuted }}>{pct}%</span>}
            </div>
          </button>
        );
      })}
      <div style={{ fontSize: 12, color: t.textFaint, paddingLeft: 4 }}>
        {total} vote{total !== 1 ? 's' : ''}{userVoted ? ' · tap to change' : ' · tap to vote'}
      </div>
    </div>
  );
}
