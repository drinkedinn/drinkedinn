// src/screens/onboarding/tasteOptions.js
// The palette shown on step 2. Zero-proof leads because we're a people-first
// place, not a bottle shop — and platform policy expects no/low to be a first-
// class choice, not an afterthought at the bottom.
//
// The `key` values are what get saved into user.drinks.tastes and later
// consulted by the sommelier and taste screens.

const OPTIONS = [
  { key: 'zero_proof',   label: 'Zero-proof',       icon: 'leaf-outline',        badge: 'NEW' },
  { key: 'cocktails',    label: 'Cocktail bars',    icon: 'wine-outline' },
  { key: 'wine',         label: 'Wine',             icon: 'wine-outline' },
  { key: 'whisky',       label: 'Whisky',           icon: 'flame-outline' },
  { key: 'beer',         label: 'Beer',             icon: 'beer-outline' },
  { key: 'sake',         label: 'Sake',             icon: 'flower-outline' },
  { key: 'coffee_tea',   label: 'Coffee & tea',     icon: 'cafe-outline' },
  { key: 'natural_wine', label: 'Natural wine',     icon: 'leaf-outline' },
  { key: 'tequila',      label: 'Tequila & mezcal', icon: 'flame-outline' },
  { key: 'travel',       label: 'Travel',           icon: 'compass-outline' },
  { key: 'hosting',      label: 'Hosting',          icon: 'people-outline' },
  { key: 'food_pairing', label: 'Food pairing',     icon: 'restaurant-outline' },
];

export default OPTIONS;
