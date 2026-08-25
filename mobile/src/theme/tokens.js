// src/theme/tokens.js
// Design tokens for DrinkedInn. Two complete palettes — a warm paper-light mode
// (default) and a deep bar-at-night dark mode. Every surface, text and border
// role exists in both so no component ever hardcodes a colour.

const amber = {
  50: '#FDF6EA',
  100: '#F9E7C6',
  200: '#F2CE8E',
  400: '#DFA23F',
  500: '#C8831F',
  600: '#A96A14',
  700: '#83500F',
};

const blue = {
  50: '#EAF1FA',
  100: '#CBDDF2',
  400: '#3F7FCB',
  500: '#2A66AE',
  600: '#1F4E88',
};

export const light = {
  mode: 'light',

  bg: '#FBF8F2',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F4EFE5',
  surfacePress: '#EDE6D8',
  scrim: 'rgba(30,24,14,0.45)',

  border: '#E4DACA',
  borderStrong: '#D3C6B0',
  divider: '#EFE8DA',

  text: '#1E1913',
  textSecondary: '#5D5343',
  textMuted: '#8C8271',
  textOnAccent: '#2A1B05',

  accent: amber[500],
  accentHover: amber[600],
  accentSoft: amber[50],
  accentBorder: amber[200],
  accentText: amber[700],

  blue: blue[500],
  blueSoft: blue[50],
  blueText: blue[600],

  success: '#2E7D4F',
  successSoft: '#E7F3EB',
  danger: '#B3261E',
  dangerSoft: '#FBEAE9',
  warning: '#9A6412',

  tabBar: 'rgba(255,255,255,0.82)',
  skeleton: '#EDE6D8',
  skeletonSheen: 'rgba(255,255,255,0.65)',

  statusBar: 'dark',
  blurTint: 'light',
  shadowColor: '#3A2E1B',
  shadowOpacity: 0.1,
};

export const dark = {
  mode: 'dark',

  bg: '#0D0F16',
  bgElevated: '#141722',
  surface: '#171B28',
  surfaceAlt: '#1D2231',
  surfacePress: '#232839',
  scrim: 'rgba(0,0,0,0.6)',

  border: '#262C3D',
  borderStrong: '#333A4F',
  divider: '#1F2432',

  text: '#F2EEE5',
  textSecondary: '#A8AABC',
  textMuted: '#71748A',
  textOnAccent: '#221604',

  accent: amber[400],
  accentHover: amber[200],
  accentSoft: 'rgba(223,162,63,0.14)',
  accentBorder: 'rgba(223,162,63,0.34)',
  accentText: amber[200],

  blue: blue[400],
  blueSoft: 'rgba(63,127,203,0.16)',
  blueText: blue[100],

  success: '#4ADE80',
  successSoft: 'rgba(74,222,128,0.14)',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255,107,107,0.14)',
  warning: '#F0B44A',

  tabBar: 'rgba(20,23,34,0.72)',
  skeleton: '#1D2231',
  skeletonSheen: 'rgba(255,255,255,0.06)',

  statusBar: 'light',
  blurTint: 'dark',
  shadowColor: '#000000',
  shadowOpacity: 0.4,
};

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 26, pill: 999 };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const type = {
  display: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  h1: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '500' },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9 },
};

export function elevation(theme, level = 1) {
  const map = {
    1: { radius: 6, offset: 2, opacity: theme.shadowOpacity * 0.7 },
    2: { radius: 14, offset: 6, opacity: theme.shadowOpacity },
    3: { radius: 26, offset: 12, opacity: theme.shadowOpacity * 1.15 },
  };
  const e = map[level] || map[1];
  return {
    shadowColor: theme.shadowColor,
    shadowOpacity: e.opacity,
    shadowRadius: e.radius,
    shadowOffset: { width: 0, height: e.offset },
    elevation: level * 3,
  };
}
