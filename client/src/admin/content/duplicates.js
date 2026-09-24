// src/admin/content/duplicates.js
// Client-side duplicate detection for the places catalogue.
//
// Two rows for the same bar split one place profile in two: half the visits and
// half the stories land on each, and neither looks like the venue people
// actually went to. There is no merge endpoint, so the most this can do is make
// the split visible and name the pair precisely enough to fix by hand.
//
// The heuristic is deliberately conservative and deliberately explainable:
// normalise the name, normalise the city, group on both. It is a suggestion
// for a human, not a verdict — "The Dead Rabbit" and "Dead Rabbit Grocery"
// will not match, and two genuinely different venues sharing a name in one
// city will match falsely. That is why nothing here acts automatically.

const LEADING_ARTICLE = /^(the|le|la|les|el|los|il|de|het|das|der|die)\s+/;

/** Lowercase, de-accent, drop punctuation, collapse spaces. */
function basicNormalise(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[‘’'`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normaliseName(name) {
  return basicNormalise(name).replace(LEADING_ARTICLE, '').trim();
}

export function normaliseCity(city) {
  return basicNormalise(city);
}

/**
 * Group the given places into likely-duplicate clusters.
 *
 * @param {Array} places rows from GET /api/places
 * @returns {Array} [{ key, label, city, countries, mixedCountry, confidence, places }]
 *          ordered by cluster size, then name.
 */
export function findDuplicateGroups(places) {
  const buckets = new Map();

  for (const place of Array.isArray(places) ? places : []) {
    if (!place || place.id == null) continue;
    const name = normaliseName(place.name);
    if (!name) continue; // nothing to compare on
    const city = normaliseCity(place.city);
    const key = `${name}||${city}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(place);
  }

  const groups = [];
  for (const [key, rows] of buckets) {
    if (rows.length < 2) continue;
    const countries = Array.from(
      new Set(rows.map((r) => String(r.country || '').trim().toUpperCase()).filter(Boolean))
    );
    const hasCity = !!normaliseCity(rows[0].city);
    groups.push({
      key,
      label: rows[0].name || '(unnamed)',
      city: rows[0].city || '',
      countries,
      // Same name, same city, different countries — the city string alone is
      // doing the work, so flag it instead of quietly asserting a match.
      mixedCountry: countries.length > 1,
      // A match with no city is a weaker signal: two "Rooftop Bar" rows with no
      // city set may be in different hemispheres.
      confidence: hasCity && countries.length <= 1 ? 'likely' : 'possible',
      places: rows.slice().sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),
    });
  }

  groups.sort((a, b) => b.places.length - a.places.length || String(a.label).localeCompare(String(b.label)));
  return groups;
}

/** A plain-text handover note for whoever performs the manual merge. */
export function duplicateNote(group) {
  if (!group) return '';
  const header = `Possible duplicate places: "${group.label}"${group.city ? ` in ${group.city}` : ' (no city set)'}`;
  const lines = group.places.map((p) => {
    const bits = [
      `id=${p.id}`,
      `name=${JSON.stringify(String(p.name ?? ''))}`,
      `city=${JSON.stringify(String(p.city ?? ''))}`,
      `country=${String(p.country || '—')}`,
      `visits=${Number(p.visit_count) || 0}`,
      `stories=${Number(p.story_count) || 0}`,
      `created_by=${p.created_by ?? '—'}`,
    ];
    return `  - ${bits.join(' ')}`;
  });
  return [header, ...lines, 'Merge is manual — there is no merge endpoint.'].join('\n');
}
