import { useState } from 'react';

export default function AgeGate({ children }) {
  const [ok, setOk] = useState(() => localStorage.getItem('di_age_ok') === '1');

  if (ok) return children;

  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0a0a0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🥃</div>
        <h2 style={{ color: '#f0f2f8', fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
          Are you of legal drinking age?
        </h2>
        <p style={{ color: '#8b8fa8', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
          DrinkedInn is a platform about alcohol and drink culture. You must be of legal
          drinking age in your country to enter.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => { localStorage.setItem('di_age_ok', '1'); setOk(true); }}
            style={{
              flex: 1, padding: '13px 20px',
              background: 'linear-gradient(135deg, #f5a623, #ffcc5c)',
              border: 'none', borderRadius: 12,
              color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(245,166,35,0.35)',
            }}
          >
            Yes, I'm of legal age
          </button>
          <button
            onClick={() => { window.location.href = 'https://www.drinkaware.co.uk/'; }}
            style={{
              flex: 1, padding: '13px 20px',
              background: 'none',
              border: '1.5px solid #2a2d3e', borderRadius: 12,
              color: '#8b8fa8', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            No, exit
          </button>
        </div>
        <p style={{ color: '#555870', fontSize: 11, marginTop: 20 }}>
          By entering you confirm you are of legal drinking age in your jurisdiction.
        </p>
      </div>
    </div>
  );
}
