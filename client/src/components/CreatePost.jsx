import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function CreatePost({ onPost }) {
  const { user } = useAuth();
  const { t } = useTheme();

  return (
    <div style={{ background: t.card, borderRadius: 16, padding: 20, border: `1px solid ${t.border}`, marginBottom: 16, boxShadow: t.shadow, transition: 'background 0.3s' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <img src={user?.avatar} alt="" style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${t.accent}` }} />
        <div onClick={onPost} style={{
          flex: 1, background: t.cardAlt, borderRadius: 24,
          padding: '12px 20px', color: t.textMuted, fontSize: 15, cursor: 'pointer',
          border: `1.5px solid ${t.border}`, transition: 'border-color 0.2s, background 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.background = t.accentSoft; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.cardAlt; }}
        >
          What's in your glass tonight? 🥃
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, paddingLeft: 56 }}>
        {[['📸', 'Photo'], ['📍', 'Location'], ['🏷️', 'Tag'], ['🍹', 'Drink']].map(([icon, label]) => (
          <button key={label} onClick={onPost} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: t.cardAlt, border: `1.5px solid ${t.border}`,
            borderRadius: 20, padding: '6px 14px', color: t.textMuted, fontSize: 13, cursor: 'pointer',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; e.currentTarget.style.background = t.accentSoft; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; e.currentTarget.style.background = t.cardAlt; }}
          >
            <span>{icon}</span><span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
