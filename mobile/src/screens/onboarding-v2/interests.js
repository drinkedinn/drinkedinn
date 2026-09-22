// src/screens/onboarding-v2/interests.js
// The onboarding interest set.
//
// These are deliberately BROAD life interests — people, moments and places.
// Nothing here is alcohol-specific, and nothing should be added that is.
// Drink-level personalisation (wine, whisky, zero-proof, and so on) happens
// later, inside Collection and Explore, once someone has actually used the app.
// Leading a first run with a grid of spirits presents DrinkedInn as an
// alcohol-first product to a Play reviewer and contradicts the
// People / Places / Stories positioning the brand is built on.
//
// `key` is what POST /onboarding/interests stores (the server lowercases,
// de-dupes and caps at 20 items / 30 chars each, so these are already safe).

export const INTERESTS = [
  { key: 'travel', label: 'Travel', icon: 'airplane-outline' },
  { key: 'food', label: 'Food', icon: 'restaurant-outline' },
  { key: 'music', label: 'Music', icon: 'musical-notes-outline' },
  { key: 'nightlife', label: 'Nightlife', icon: 'moon-outline' },
  { key: 'events', label: 'Events', icon: 'calendar-outline' },
  { key: 'photography', label: 'Photography', icon: 'camera-outline' },
  { key: 'experiences', label: 'Experiences', icon: 'sparkles-outline' },
  { key: 'sports', label: 'Sports', icon: 'football-outline' },
  { key: 'art', label: 'Art', icon: 'color-palette-outline' },
  { key: 'fashion', label: 'Fashion', icon: 'shirt-outline' },
  { key: 'social', label: 'Social', icon: 'people-outline' },
  { key: 'places', label: 'Places', icon: 'location-outline' },
];

/** How many picks unlock the next step. Enough to personalise, not a wall. */
export const MIN_INTERESTS = 3;

export default INTERESTS;
