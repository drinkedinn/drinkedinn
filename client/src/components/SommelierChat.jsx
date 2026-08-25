/**
 * SommelierChat — Floating AI Sommelier powered by Claude.
 * Reads the user's real drink ratings, collection & taste profile from the
 * server and streams back hyper-personalised recommendations.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth }  from '../context/AuthContext';

/* ── Suggested starter questions ───────────────────────── */
const SUGGESTIONS = [
  { emoji: '🎁', text: 'What bottle should I gift a whisky lover?' },
  { emoji: '🍽️', text: 'What pairs well with a rich beef stew?' },
  { emoji: '🔍', text: 'Recommend something similar to my top-rated drink' },
  { emoji: '🍹', text: 'Build me a cocktail from common home spirits' },
  { emoji: '📦', text: 'What should I add to my collection next?' },
  { emoji: '🌍', text: 'Suggest a drink from a country I haven\'t tried yet' },
];

/* ── Tiny markdown renderer (bold + newlines only) ─────── */
function renderMd(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

export default function SommelierChat() {
  const { t } = useTheme();
  const { user } = useAuth();

  const [open, setOpen]           = useState(false);
  const [history, setHistory]     = useState([]);   // [{role,content}]
  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamBuf, setStreamBuf] = useState('');   // accumulating streamed tokens
  const [error, setError]         = useState('');
  const [unread, setUnread]       = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const readerRef  = useRef(null);   // abort handle

  /* ── scroll to bottom whenever messages change ─────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, streamBuf]);

  /* ── focus input when panel opens ──────────────────── */
  useEffect(() => {
    if (open) {
      setUnread(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  /* ── cleanup on unmount ─────────────────────────────── */
  useEffect(() => () => readerRef.current?.cancel?.(), []);

  const token = localStorage.getItem('di_token');

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || streaming) return;

    setInput('');
    setError('');
    const userMsg = { role: 'user', content: msg };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    setStreaming(true);
    setStreamBuf('');

    try {
      const BASE = import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL}/api`
        : '/api';

      const res = await fetch(`${BASE}/sommelier/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: msg, history: history.slice(-10) }),
      });

      /* non-streaming fallback (no API key) */
      if (res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        const assistantMsg = { role: 'assistant', content: data.content || data.error || 'No response.' };
        setHistory(h => [...h, assistantMsg]);
        setStreaming(false);
        if (!open) setUnread(true);
        return;
      }

      /* SSE stream */
      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const payload = JSON.parse(raw);
            if (payload.token) {
              full += payload.token;
              setStreamBuf(full);
            } else if (payload.done) {
              const assistantMsg = { role: 'assistant', content: full };
              setHistory(h => [...h, assistantMsg]);
              setStreamBuf('');
              if (!open) setUnread(true);
            } else if (payload.error) {
              setError(payload.error);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Connection lost. Please try again.');
      }
    } finally {
      setStreaming(false);
      setStreamBuf('');
    }
  }, [input, history, streaming, token, open]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => { setHistory([]); setStreamBuf(''); setError(''); };

  /* ── display messages: committed + current stream ──── */
  const allMessages = [
    ...history,
    ...(streamBuf ? [{ role: 'assistant', content: streamBuf, streaming: true }] : []),
  ];

  /* ───────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Floating trigger button ───────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Ask the AI Sommelier"
        style={{
          position: 'fixed',
          bottom: 80,           /* above mobile bottom nav */
          right: 20,
          zIndex: 1200,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, #f5a623, #e8870a)',
          boxShadow: open
            ? '0 0 0 3px rgba(245,166,35,0.4), 0 8px 24px rgba(245,166,35,0.35)'
            : '0 4px 16px rgba(245,166,35,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          transition: 'transform 0.2s, box-shadow 0.2s',
          transform: open ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        {open ? '✕' : '🍸'}
        {unread && !open && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 10, height: 10, borderRadius: '50%',
            background: '#ef4444',
            border: `2px solid ${t.bg}`,
          }} />
        )}
      </button>

      {/* ── Chat panel ───────────────────────────────── */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 144,
            right: 20,
            zIndex: 1199,
            width: 'min(400px, calc(100vw - 40px))',
            height: 'min(580px, calc(100vh - 200px))',
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 20,
            boxShadow: t.shadowLg,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'sommelierIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #f5a623 0%, #e8870a 100%)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 26 }}>🍸</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: 15, lineHeight: 1.2 }}>
                AI Sommelier
              </div>
              <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11 }}>
                {streaming
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <TypingDots /> Pouring a thought…
                    </span>
                  : 'Your personal drinks expert'}
              </div>
            </div>
            {history.length > 0 && (
              <button
                onClick={clearChat}
                title="Clear chat"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '4px 9px',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            {/* Welcome state */}
            {allMessages.length === 0 && (
              <div style={{ animation: 'fadeInUp 0.3s ease' }}>
                <div style={{
                  textAlign: 'center',
                  padding: '16px 8px 12px',
                  color: t.textSub,
                }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🥃</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: t.text, marginBottom: 4 }}>
                    Welcome, {user?.name?.split(' ')[0] || 'there'}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                    I know your taste profile and collection. Ask me anything about drinks.
                  </div>
                </div>

                {/* Suggestion chips */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 7,
                  marginTop: 4,
                }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s.text)}
                      style={{
                        background: t.accentSoft,
                        border: `1px solid ${t.vibeBorder}`,
                        borderRadius: 20,
                        padding: '6px 11px',
                        fontSize: 12,
                        color: t.text,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = t.accentSoftHover}
                      onMouseLeave={e => e.currentTarget.style.background = t.accentSoft}
                    >
                      <span>{s.emoji}</span>
                      <span>{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat bubbles */}
            {allMessages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  gap: 8,
                  alignItems: 'flex-end',
                  animation: 'fadeInUp 0.2s ease',
                }}
              >
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f5a623, #e8870a)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, flexShrink: 0, marginBottom: 2,
                  }}>
                    🍸
                  </div>
                )}
                <div style={{
                  maxWidth: '80%',
                  padding: '9px 13px',
                  borderRadius: msg.role === 'user'
                    ? '18px 18px 4px 18px'
                    : '18px 18px 18px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #f5a623, #e8870a)'
                    : t.cardAlt,
                  color: msg.role === 'user' ? '#fff' : t.text,
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  border: msg.role === 'assistant' ? `1px solid ${t.border}` : 'none',
                  boxShadow: t.shadow,
                }}>
                  <span
                    dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }}
                  />
                  {msg.streaming && <BlinkCursor />}
                </div>
              </div>
            ))}

            {/* Error */}
            {error && (
              <div style={{
                background: t.dangerBg,
                border: `1px solid ${t.dangerBorder}`,
                color: t.danger,
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 12,
              }}>
                ⚠️ {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div style={{
            padding: '10px 12px',
            borderTop: `1px solid ${t.border}`,
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            flexShrink: 0,
            background: t.card,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about a drink, pairing, recipe…"
              rows={1}
              disabled={streaming}
              style={{
                flex: 1,
                background: t.inputBg,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                padding: '9px 12px',
                fontSize: 13,
                color: t.text,
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.4,
                maxHeight: 90,
                overflowY: 'auto',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = '#f5a623'}
              onBlur={e => e.target.style.borderColor = t.border}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 90) + 'px';
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={streaming || !input.trim()}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                border: 'none',
                background: streaming || !input.trim()
                  ? t.border
                  : 'linear-gradient(135deg, #f5a623, #e8870a)',
                color: streaming || !input.trim() ? t.textMuted : '#fff',
                cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              {streaming ? <TypingDots small /> : '↑'}
            </button>
          </div>

          {/* Footer note */}
          <div style={{
            textAlign: 'center',
            padding: '4px 12px 8px',
            fontSize: 10,
            color: t.textMuted,
            flexShrink: 0,
          }}>
            Powered by Claude · Knows your collection & taste profile
          </div>
        </div>
      )}

      {/* ── Panel slide-in keyframe ───────────────────── */}
      <style>{`
        @keyframes sommelierIn {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </>
  );
}

/* ── Micro-components ─────────────────────────────────── */

function TypingDots({ small }) {
  const size = small ? 5 : 6;
  const gap  = small ? 3 : 4;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: size, height: size, borderRadius: '50%',
            background: 'currentColor',
            display: 'inline-block',
            animation: `dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

function BlinkCursor() {
  return (
    <span style={{
      display: 'inline-block',
      width: 2,
      height: '1em',
      background: '#f5a623',
      marginLeft: 2,
      verticalAlign: 'text-bottom',
      animation: 'blink 0.9s step-end infinite',
    }} />
  );
}
