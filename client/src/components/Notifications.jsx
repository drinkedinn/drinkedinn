import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useTheme } from '../context/ThemeContext';

const fmtTime = iso => {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const typeInfo = { cheer: { icon: '🍺', verb: 'cheered your pour' }, comment: { icon: '💬', verb: 'commented on your pour' }, connect: { icon: '🤝', verb: 'connected with you' } };

export function NotificationBell() {
  const { t } = useTheme();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const ref = useRef();

  useEffect(() => {
    const load = () => api.get('/notifications/count').then(r => setCount(r.data.count)).catch(() => {});
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!open) return;
    api.get('/notifications').then(r => { setNotes(r.data); setCount(0); api.post('/notifications/read-all'); }).catch(() => {});
  }, [open]);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        position: 'relative', background: open ? t.accentSoft : 'none',
        border: 'none', borderRadius: 8, padding: '8px 10px',
        cursor: 'pointer', fontSize: 20, transition: 'background 0.2s',
        animation: count > 0 ? 'bellShake 0.6s ease' : 'none',
      }}>
        🔔
        {count > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            background: '#ef4444', color: '#fff', borderRadius: '50%',
            width: 18, height: 18, fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${t.card}`,
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="slideDown" style={{
          position: 'absolute', right: 0, top: 52, width: 340,
          background: t.card, border: `1px solid ${t.border}`, borderRadius: 16,
          boxShadow: t.shadowLg, zIndex: 300, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: t.text }}>Notifications</span>
            <span style={{ fontSize: 12, color: t.textMuted }}>All caught up 🥃</span>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notes.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: t.textMuted }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🔔</div>
                <div>No notifications yet</div>
              </div>
            ) : notes.map(n => {
              const info = typeInfo[n.type] || { icon: '🍺', verb: 'interacted with you' };
              return (
                <div key={n.id} style={{
                  display: 'flex', gap: 12, padding: '12px 16px',
                  borderBottom: `1px solid ${t.borderSub}`,
                  background: n.read ? 'transparent' : t.accentSoft,
                  transition: 'background 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = t.cardAlt}
                  onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : t.accentSoft}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={n.actor_avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: 14 }}>{info.icon}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: t.text, lineHeight: 1.4 }}>
                      <strong>{n.actor_name}</strong> {info.verb}
                    </div>
                    {n.post_preview && (
                      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        "{n.post_preview.slice(0, 60)}…"
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: t.textFaint, marginTop: 3 }}>{fmtTime(n.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
