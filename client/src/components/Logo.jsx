import { useTheme } from '../context/ThemeContext';

export default function Logo({ size = 'md', onClick }) {
  const { t, isDark } = useTheme();
  const big = size === 'lg';
  const iconSize = big ? 44 : 30;
  const fontSize = big ? 36 : 22;
  const badgeFontSize = big ? 30 : 19;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center',
        gap: big ? 12 : 8,
        userSelect: 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {/* Glass icon */}
      <svg viewBox="0 0 80 108" width={iconSize} height={Math.round(iconSize * 1.35)} style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id={`lq-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#F59E0B"/>
            <stop offset="60%"  stopColor="#D97706"/>
            <stop offset="100%" stopColor="#92400E"/>
          </linearGradient>
          <clipPath id={`gc-${size}`}>
            <polygon points="14,10 66,10 74,98 6,98"/>
          </clipPath>
        </defs>

        {/* Glass body */}
        <polygon points="14,10 66,10 74,98 6,98"
          fill="rgba(180,210,255,0.09)"
          stroke={isDark ? 'rgba(180,210,255,0.45)' : 'rgba(100,150,220,0.4)'}
          strokeWidth="2"/>

        {/* Liquid */}
        <rect x="0" y="46" width="80" height="55"
          fill={`url(#lq-${size})`} opacity="0.92"
          clipPath={`url(#gc-${size})`}/>

        {/* Surface glint */}
        <ellipse cx="40" cy="46" rx="22" ry="3.5"
          fill="#FCD34D" opacity="0.5"
          clipPath={`url(#gc-${size})`}/>

        {/* Bubbles */}
        <circle cx="28" cy="68" r="2.5" fill="rgba(255,255,255,0.55)"/>
        <circle cx="50" cy="60" r="1.8" fill="rgba(255,255,255,0.45)"/>
        <circle cx="36" cy="80" r="1.5" fill="rgba(255,255,255,0.4)"/>

        {/* Ice cube */}
        <rect x="28" y="28" width="16" height="16" rx="2.5"
          fill="rgba(210,235,255,0.38)"
          stroke="rgba(255,255,255,0.55)" strokeWidth="1"
          transform="rotate(12,36,36)"/>

        {/* Left shine */}
        <polygon points="16,12 23,12 14,88 8,88"
          fill="rgba(255,255,255,0.16)"/>

        {/* Rim */}
        <ellipse cx="40" cy="10" rx="26" ry="5"
          fill="rgba(180,210,255,0.12)"
          stroke={isDark ? 'rgba(180,210,255,0.5)' : 'rgba(100,150,220,0.4)'}
          strokeWidth="1.5"/>

        {/* Base */}
        <rect x="16" y="98" width="48" height="6" rx="3"
          fill="rgba(180,205,240,0.2)"
          stroke={isDark ? 'rgba(180,210,255,0.4)' : 'rgba(100,150,220,0.35)'}
          strokeWidth="1"/>
        <ellipse cx="40" cy="98" rx="36" ry="5"
          fill="rgba(180,205,240,0.1)"
          stroke={isDark ? 'rgba(180,210,255,0.3)' : 'rgba(100,150,220,0.25)'}
          strokeWidth="1"/>
      </svg>

      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: big ? 6 : 4 }}>
        <span style={{
          fontWeight: 800,
          fontSize: fontSize,
          color: t.text,
          letterSpacing: '-1px',
          lineHeight: 1,
          transition: 'color 0.3s',
        }}>
          Drinked
        </span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)',
          color: '#fff',
          fontWeight: 900,
          fontSize: badgeFontSize,
          borderRadius: big ? 10 : 6,
          padding: big ? '3px 11px 4px' : '2px 8px 3px',
          letterSpacing: '-0.5px',
          lineHeight: 1,
          boxShadow: '0 2px 12px rgba(217,119,6,0.45), inset 0 1px 0 rgba(255,255,255,0.2)',
        }}>
          Inn
        </span>
      </div>
    </div>
  );
}
