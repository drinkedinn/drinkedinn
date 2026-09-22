// src/components/composer/createActions.js
// The four things a member can start from the Create sheet.
//
// Kept apart from the sheet itself so the list is data, not layout: the sheet
// renders whatever it is handed, and a caller can pass a trimmed or reordered
// list (a place page offering only "Add a rating", say) without touching the
// sheet's internals.
//
// Order is deliberate and follows the brand triad — the fleeting moment first,
// then the keepsake post, then the place, and the rating last, because a rating
// is a detail about a night rather than the night itself.

export const CREATE_ACTIONS = [
  {
    key: 'story',
    label: 'New story',
    subtitle: 'Here for 24 hours, then it’s gone',
    icon: 'flash-outline',
    route: 'CreateStory',
  },
  {
    key: 'post',
    label: 'New post',
    subtitle: 'A photo, a moment, a place',
    icon: 'create-outline',
    route: 'Compose',
  },
  {
    key: 'place',
    label: 'Add a place',
    subtitle: 'So you find your way back',
    icon: 'location-outline',
    route: 'AddPlace',
  },
  {
    key: 'rating',
    label: 'Add a rating',
    subtitle: 'How was it?',
    icon: 'star-outline',
    route: 'AddRating',
  },
];

/**
 * Coerce a caller-supplied list into something the sheet can render without
 * crashing: drop nulls and entries with no label, and guarantee a stable key.
 * Anything falsy falls back to the full default list.
 */
export function normalizeActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) return CREATE_ACTIONS;

  const cleaned = actions
    .filter((a) => a && typeof a === 'object' && typeof a.label === 'string' && a.label.length > 0)
    .map((a, i) => ({
      ...a,
      key: a.key || a.route || `action_${i}`,
      icon: a.icon || 'ellipse-outline',
    }));

  return cleaned.length ? cleaned : CREATE_ACTIONS;
}

/** Convenience for callers that want a subset by key, in the canonical order. */
export function pickActions(keys) {
  if (!Array.isArray(keys) || !keys.length) return CREATE_ACTIONS;
  const wanted = new Set(keys);
  const subset = CREATE_ACTIONS.filter((a) => wanted.has(a.key));
  return subset.length ? subset : CREATE_ACTIONS;
}

export default CREATE_ACTIONS;
