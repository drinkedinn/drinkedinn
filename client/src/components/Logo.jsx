import { useTheme } from '../context/ThemeContext';

export default function Logo({ size = 'md', onClick }) {
  const { t } = useTheme();
  const big = size === 'lg';
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: big ? 10 : 6, userSelect: 'none', cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ fontWeight: 900, fontSize: big ? 32 : 22, color: t.text, letterSpacing: -1, transition: 'color 0.3s' }}>
        Drinked
      </span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a66c2, #1d8fe8)',
        color: '#fff', fontWeight: 900, fontSize: big ? 28 : 18,
        borderRadius: big ? 8 : 5, padding: big ? '4px 10px' : '2px 7px',
        letterSpacing: -0.5, boxShadow: '0 2px 12px rgba(10,102,194,0.3)',
      }}>
        Inn 🍺
      </span>
    </div>
  );
}
