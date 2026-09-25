// src/theme.js
// A single premium, committed dark theme — deep bar-at-night charcoal-navy with
// warm amber as the star accent and a deep hospitality blue as the secondary.

export const colors = {
  bg: '#0A0B12',
  bgElevated: '#10121C',
  card: '#141726',
  cardAlt: '#191D2E',
  cardPress: '#1E2233',
  border: '#242942',
  borderSoft: '#1C2033',

  text: '#F1EEE6',
  textDim: '#A7A9BE',
  textFaint: '#6B6E85',

  whisky: '#F5A623',
  whiskyLight: '#FFCC5C',
  whiskyDeep: '#C97B21',
  whiskyGlow: 'rgba(245,166,35,0.16)',

  blue: '#2D6FC9',
  blueLight: '#4C8DE0',

  like: '#FF4D6D',
  green: '#22C55E',

  overlay: 'rgba(6,7,12,0.72)',
};

export const gradients = {
  whisky: ['#F5A623', '#FFCC5C'],
  blue: ['#0A66C2', '#1D8FE8'],
  story: ['#F5A623', '#FF6B9D', '#7C5CFF'],
  heroGlow: ['rgba(245,166,35,0.20)', 'rgba(10,11,18,0)'],
  card: ['#161A2B', '#12141F'],
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const space = (n) => n * 4;

export const font = {
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '500' },
  mono: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  glow: {
    shadowColor: colors.whisky,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
};
