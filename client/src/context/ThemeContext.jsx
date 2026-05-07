import { createContext, useContext, useState, useEffect } from 'react';

const light = {
  bg: '#f0f2f5',
  card: '#ffffff',
  cardAlt: '#f8f9fa',
  border: '#eaeaea',
  borderSub: '#f5f5f5',
  text: '#1a1a1a',
  textSub: '#555',
  textMuted: '#aaa',
  textFaint: '#ccc',
  accent: '#f5a623',
  accentSoft: '#fff8ed',
  accentSoftHover: '#fff3d6',
  link: '#0a66c2',
  shadow: '0 2px 8px rgba(0,0,0,0.04)',
  shadowMd: '0 8px 24px rgba(0,0,0,0.09)',
  shadowLg: '0 24px 80px rgba(0,0,0,0.14)',
  navBg: 'rgba(255,255,255,0.97)',
  overlay: 'rgba(0,0,0,0.35)',
  inputBg: '#f8f9fa',
  green: '#22c55e',
  danger: '#dc2626',
  dangerBg: '#fff5f5',
  dangerBorder: '#fecaca',
  vibeBg: 'linear-gradient(135deg, #fff8ed, #fff3d6)',
  vibeBorder: '#f5e6c8',
  scrollThumb: '#d0d0d0',
};

const dark = {
  bg: '#0d0d0d',
  card: '#161616',
  cardAlt: '#1e1e1e',
  border: '#2a2a2a',
  borderSub: '#222222',
  text: '#f0f0f0',
  textSub: '#ccc',
  textMuted: '#888',
  textFaint: '#555',
  accent: '#f5a623',
  accentSoft: 'rgba(245,166,35,0.1)',
  accentSoftHover: 'rgba(245,166,35,0.2)',
  link: '#1d8fe8',
  shadow: 'none',
  shadowMd: '0 4px 20px rgba(0,0,0,0.4)',
  shadowLg: '0 24px 80px rgba(0,0,0,0.6)',
  navBg: 'rgba(13,13,13,0.96)',
  overlay: 'rgba(0,0,0,0.8)',
  inputBg: '#1e1e1e',
  green: '#22c55e',
  danger: '#ef4444',
  dangerBg: 'rgba(239,68,68,0.1)',
  dangerBorder: 'rgba(239,68,68,0.3)',
  vibeBg: 'linear-gradient(135deg, #1a1200, #2a1f00)',
  vibeBorder: 'rgba(245,166,35,0.2)',
  scrollThumb: '#2a2a2a',
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('di_theme') === 'dark');

  useEffect(() => {
    const t = isDark ? dark : light;
    document.body.style.background = t.bg;
    document.body.style.color = t.text;
    document.documentElement.style.setProperty('--scroll-thumb', t.scrollThumb);
    document.documentElement.style.setProperty('--scroll-track', t.bg);
    localStorage.setItem('di_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ t: isDark ? dark : light, isDark, toggleTheme: () => setIsDark(d => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
