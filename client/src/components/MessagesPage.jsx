import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const fmtTime = iso => { const diff = (Date.now() - new Date(iso)) / 1000; if (diff < 60) return 'now'; if (diff < 3600) return `${Math.floor(diff / 60)}m`; if (diff < 86400) return `${Math.floor(diff / 3600)}h`; return `${Math.floor(diff / 86400)}d`; };

export default function MessagesPage({ openUserId = null, openUserName = null, openUserAvatar = null }) {
  const { user } = useAuth();
  const { t } = useTheme();
  const [convos, setConvos] = useState([]);
  const [activeId, setActiveId] = useState(openUserId);
  const [activeName, setActiveName] = useState(openUserName);
  const [activeAvatar, setActiveAvatar] = useState(openUserAvatar);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { loadConvos(); }, []);
  useEffect(() => { if (activeId) loadMessages(activeId); }, [activeId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadConvos = () => api.get('/messages/conversations').then(r => setConvos(r.data)).catch(() => {});
  const loadMessages = (uid) => api.get(`/messages/${uid}`).then(r => { setMessages(r.data); loadConvos(); }).catch(() => {});

  const openChat = (id, name, avatar) => { setActiveId(id); setActiveName(name); setActiveAvatar(avatar); };

  const send = async () => {
    if (!input.trim() || !activeId || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/messages/${activeId}`, { content: input.trim() });
      setMessages(m => [...m, data]);
      setInput('');
      loadConvos();
    } finally { setSending(false); }
  };

  const sideStyle = { width: 280, borderRight: `1px solid ${t.border}`, overflowY: 'auto', flexShrink: 0 };

  return (
    <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.border}`, boxShadow: t.shadow, display: 'flex', overflow: 'hidden', height: 600 }}>
      {/* Sidebar */}
      <div style={sideStyle}>
        <div style={{ padding: '16px 16px 12px', fontWeight: 700, fontSize: 16, color: t.text, borderBottom: `1px solid ${t.border}` }}>Messages 💬</div>
        {convos.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>No conversations yet.<br />Connect with someone and start chatting!
          </div>
        )}
        {convos.map(c => (
          <div key={c.other_id} onClick={() => openChat(c.other_id, c.name, c.avatar)} style={{
            display: 'flex', gap: 10, padding: '12px 16px', cursor: 'pointer',
            background: activeId === c.other_id ? t.accentSoft : 'none',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => { if (activeId !== c.other_id) e.currentTarget.style.background = t.cardAlt; }}
            onMouseLeave={e => { if (activeId !== c.other_id) e.currentTarget.style.background = 'none'; }}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img src={c.avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
              {c.unread > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{c.unread}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: c.unread > 0 ? 700 : 600, fontSize: 13, color: t.text }}>{c.name}</div>
              <div style={{ fontSize: 12, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.last_message}</div>
            </div>
            <div style={{ fontSize: 11, color: t.textFaint, flexShrink: 0 }}>{fmtTime(c.last_at)}</div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      {activeId ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Chat header */}
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={activeAvatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
            <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{activeName}</div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map(m => {
              const isMe = m.sender_id === user?.id;
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 8 }}>
                  {!isMe && <img src={m.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, alignSelf: 'flex-end' }} />}
                  <div style={{
                    maxWidth: '70%', padding: '10px 14px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: isMe ? 'linear-gradient(135deg,#f5a623,#ffcc5c)' : t.cardAlt,
                    color: isMe ? '#fff' : t.text, fontSize: 14, lineHeight: 1.5,
                    boxShadow: t.shadow,
                  }}>
                    {m.content}
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: 'right' }}>{fmtTime(m.created_at)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message…"
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              style={{ flex: 1, background: t.inputBg, border: `1.5px solid ${t.border}`, borderRadius: 24, padding: '10px 16px', color: t.text, fontSize: 14, outline: 'none', transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border}
            />
            <button onClick={send} disabled={!input.trim() || sending} style={{
              background: input.trim() ? 'linear-gradient(135deg,#f5a623,#ffcc5c)' : t.cardAlt,
              border: 'none', borderRadius: 24, padding: '10px 18px',
              color: input.trim() ? '#fff' : t.textMuted, fontWeight: 700, cursor: input.trim() ? 'pointer' : 'not-allowed',
            }}>Send</button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: t.textMuted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Your Messages</div>
          <div style={{ fontSize: 14 }}>Select a conversation to start chatting</div>
        </div>
      )}
    </div>
  );
}
