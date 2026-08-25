import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

/* ── 3D Whisky Glass ─────────────────────────────────────────────────── */
function Glass3D({ accent }) {
  return (
    <div style={{
      perspective: '600px',
      width: 100, height: 130,
      position: 'relative',
      margin: '0 auto',
    }}>
      <div style={{
        width: '100%', height: '100%',
        transformStyle: 'preserve-3d',
        animation: 'glassOrbit 3s linear infinite',
        position: 'relative',
      }}>
        {/* Glass body — SVG with CSS 3D */}
        <svg viewBox="0 0 80 110" width="100" height="130" style={{ position: 'absolute', top: 0, left: 0, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.35))' }}>
          {/* Glow behind glass */}
          <defs>
            <radialGradient id="glowGrad" cx="50%" cy="80%" r="50%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
            <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="rgba(255,255,255,0.35)" />
              <stop offset="40%"  stopColor="rgba(255,255,255,0.08)" />
              <stop offset="70%"  stopColor="rgba(255,255,255,0.18)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.35)" />
            </linearGradient>
            <linearGradient id="liquidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#c8862a" />
              <stop offset="50%"  stopColor="#e6a832" />
              <stop offset="100%" stopColor="#8b5e15" />
            </linearGradient>
            <clipPath id="glassClip">
              <polygon points="18,10 62,10 72,95 8,95" />
            </clipPath>
          </defs>

          {/* Glow ellipse */}
          <ellipse cx="40" cy="95" rx="35" ry="12" fill="url(#glowGrad)" />

          {/* Glass outline */}
          <polygon points="18,10 62,10 72,95 8,95"
            fill="rgba(200,220,255,0.07)"
            stroke="rgba(200,220,255,0.45)" strokeWidth="1.5" />

          {/* Liquid fill (animated) */}
          <g clipPath="url(#glassClip)">
            <rect x="0" y="40" width="80" height="60"
              fill="url(#liquidGrad)" opacity="0.88"
              style={{ animation: 'liquidRise 2.2s cubic-bezier(0.4,0,0.2,1) forwards' }}
            />
            {/* Liquid surface shimmer */}
            <ellipse cx="40" cy="40" rx="22" ry="4"
              fill="#f0c060" opacity="0.4"
              style={{ animation: 'liquidRise 2.2s cubic-bezier(0.4,0,0.2,1) forwards' }}
            />
          </g>

          {/* Bubbles */}
          {[{cx:30,cy:80,r:2.5,delay:'0s'},{cx:44,cy:70,r:2,delay:'0.4s'},{cx:35,cy:60,r:1.5,delay:'0.8s'},{cx:50,cy:75,r:1.8,delay:'0.2s'}].map((b,i) => (
            <circle key={i} cx={b.cx} cy={b.cy} r={b.r}
              fill="rgba(255,255,255,0.7)"
              style={{ animation: `bubble 2s ${b.delay} ease-in infinite` }}
            />
          ))}

          {/* Glass highlight (left) */}
          <polygon points="20,12 28,12 20,85 14,85"
            fill="url(#glassGrad)" opacity="0.6" />

          {/* Glass top rim */}
          <ellipse cx="40" cy="10" rx="22" ry="5"
            fill="rgba(200,220,255,0.15)"
            stroke="rgba(200,220,255,0.5)" strokeWidth="1" />

          {/* Base */}
          <ellipse cx="40" cy="95" rx="32" ry="7"
            fill="rgba(150,180,220,0.18)"
            stroke="rgba(200,220,255,0.4)" strokeWidth="1" />
          <rect x="28" y="95" width="24" height="6" rx="3"
            fill="rgba(150,180,220,0.25)"
            stroke="rgba(200,220,255,0.35)" strokeWidth="1" />
        </svg>

        {/* Ice cube hint */}
        <div style={{
          position: 'absolute', top: 38, left: 28,
          width: 18, height: 18,
          background: 'rgba(200,230,255,0.35)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.6)',
          borderRadius: 4,
          transform: 'rotateZ(15deg) rotateX(20deg)',
          boxShadow: 'inset 0 0 8px rgba(255,255,255,0.4)',
        }} />
      </div>
    </div>
  );
}

/* ── Floating emoji particles ────────────────────────────────────────── */
const PARTICLES = ['🥃','🍷','🍺','🥂','🍸','🍹','🥃','🍷','🍺'];

function Particles() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {PARTICLES.map((e, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${8 + i * 10}%`,
          bottom: '-5%',
          fontSize: `${14 + (i % 3) * 8}px`,
          animation: `floatEmoji ${5 + i * 0.7}s ${i * 0.5}s linear infinite`,
          opacity: 0,
        }}>{e}</div>
      ))}
    </div>
  );
}

/* ── Splash Screen ───────────────────────────────────────────────────── */
export default function Splash({ onDone }) {
  const { t } = useTheme();
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress bar
    const inc = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(inc); return 100; }
        return p + (p < 70 ? 3 : p < 90 ? 1.5 : 0.8);
      });
    }, 40);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 500);
    }, 2600);
    return () => { clearTimeout(timer); clearInterval(inc); };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: `radial-gradient(ellipse at 50% 60%, ${t.accent}18 0%, ${t.bg} 70%)`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 0.5s ease', opacity: visible ? 1 : 0,
      pointerEvents: visible ? 'all' : 'none',
      overflow: 'hidden',
    }}>
      <Particles />

      {/* Pulse rings behind glass */}
      {[1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          width: 160, height: 160,
          borderRadius: '50%',
          border: `2px solid ${t.accent}`,
          animation: `pulseRing 2.2s ${i * 0.7}s ease-out infinite`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* 3D Glass */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: 28 }}>
        <Glass3D accent={t.accent} />
      </div>

      {/* Brand text */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px',
          color: t.text, marginBottom: 4,
          textShadow: `0 0 40px ${t.accent}60`,
        }}>
          DrinkedInn
        </div>
        <div style={{ color: t.textMuted, fontSize: 13, fontStyle: 'italic', letterSpacing: '0.3px' }}>
          Every good story starts at the inn
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'relative', zIndex: 1,
        marginTop: 36, width: 180,
        height: 3, background: t.border, borderRadius: 99, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(progress, 100)}%`,
          background: `linear-gradient(90deg, ${t.accent}, #f0c060)`,
          borderRadius: 99,
          transition: 'width 0.05s linear',
          boxShadow: `0 0 8px ${t.accent}`,
        }} />
      </div>
    </div>
  );
}
