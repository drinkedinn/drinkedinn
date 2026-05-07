import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import Logo from './Logo';

export default function Splash({ onDone }) {
  const { t } = useTheme();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => { setVisible(false); setTimeout(onDone, 500); }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: t.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 0.5s', opacity: visible ? 1 : 0, pointerEvents: visible ? 'all' : 'none',
    }}>
      <div className="popIn" style={{
        padding: 32, background: t.card, borderRadius: 24,
        boxShadow: t.shadowLg, border: `1px solid ${t.border}`,
      }}>
        <Logo size="lg" />
      </div>
      <div style={{ marginTop: 20, color: t.textMuted, fontSize: 15, fontStyle: 'italic' }}>
        Where Professionals Actually Unwind 🥃
      </div>
      <div style={{ marginTop: 40, display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', background: t.accent,
            animation: `dot 1s ${i * 0.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}
