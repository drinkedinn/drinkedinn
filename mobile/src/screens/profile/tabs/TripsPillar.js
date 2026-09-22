// src/screens/profile/tabs/TripsPillar.js
// Pillar 4 — Trips. Where the nights happened, grouped by country.
//
// Server: GET /users/:id/trips (server/routes/users.js) →
//   [{ country, place_count, visit_count, last_visit }]
// `country` is an ISO-3166 alpha-2 code (server/lib/clientCountry.js), so it
// is mapped to a readable name before it reaches the eye.
//
// Tapping a country filters this member's moments to it. There is no country
// column on posts, so the link is made client-side through the places the
// member visited: posts.place_id → places.id → places.country. That is exactly
// the same join the server uses for its own trips summary, and it means a
// moment only lands under a country if it was genuinely pinned to a place
// there — never guessed from free-text location.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { radius, type } from '../../../theme/tokens';
import { Icon, Bounce } from '../../../components/ui';
import {
  GAP, GUTTER, MomentRow, PillarEmpty, PillarError, PillarSkeleton,
  SectionHeading, ShowAll, countryLabel, monthLabel, navigateByName, plural,
} from '../pillarKit';

const CAP = 6;

function CountryCard({ trip, active, onPress }) {
  const { t, elevation } = useTheme();
  const name = countryLabel(trip?.country);
  const places = Number(trip?.place_count) || 0;
  const visits = Number(trip?.visit_count) || 0;

  return (
    <Bounce
      onPress={onPress}
      haptic="light"
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${plural(places, 'place')}${active ? ', selected' : ''}`}
      accessibilityState={{ selected: !!active }}
      style={[
        styles.card,
        {
          backgroundColor: active ? t.accentSoft : t.surface,
          borderColor: active ? t.accentBorder : t.border,
        },
        elevation(t, 1),
      ]}
    >
      <View style={[styles.flag, { backgroundColor: active ? t.accent : t.surfaceAlt }]}>
        <Icon name="earth" size={18} color={active ? t.textOnAccent : t.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{name}</Text>
        <Text style={[type.caption, { color: t.textMuted, marginTop: 3 }]} numberOfLines={1}>
          {plural(places, 'place')} · {plural(visits, 'visit')}
          {trip?.last_visit ? ` · ${monthLabel(trip.last_visit)}` : ''}
        </Text>
      </View>
      <Icon name={active ? 'chevron-up' : 'chevron-down'} size={16} color={t.textMuted} />
    </Bounce>
  );
}

export default function TripsPillar({
  isMe, navigation, ugc, trips, places, posts,
}) {
  const { t } = useTheme();
  const [selected, setSelected] = useState(null); // country code
  const [showAll, setShowAll] = useState(false);

  const list = Array.isArray(trips?.data) ? trips.data : [];
  const visible = showAll ? list : list.slice(0, CAP);

  // place id → country, from the member's own visited places.
  const placeCountry = useMemo(() => {
    const map = new Map();
    for (const p of Array.isArray(places?.data) ? places.data : []) {
      if (p?.id == null) continue;
      const c = String(p.country || '').trim().toUpperCase();
      if (c) map.set(String(p.id), c);
    }
    return map;
  }, [places?.data]);

  const moments = useMemo(() => {
    if (!selected) return [];
    const all = Array.isArray(posts?.data) ? posts.data : [];
    return all.filter(
      (p) => p?.place_id != null && placeCountry.get(String(p.place_id)) === selected,
    );
  }, [selected, posts?.data, placeCountry]);

  const openPost = (post) => navigateByName(navigation, 'PostDetail', { post });
  const linkedLoading =
    (places?.loading && places?.data == null) || (posts?.loading && posts?.data == null);

  if (trips?.loading && trips?.data == null) return <PillarSkeleton variant="rows" />;

  if (trips?.error && !list.length) {
    return <PillarError message={trips.error} onRetry={() => trips.reload?.()} />;
  }

  if (!list.length) {
    return (
      <PillarEmpty
        icon="earth-outline"
        title={isMe ? 'No trips yet' : 'Nowhere logged yet'}
        body={
          isMe
            ? 'Mark yourself as been-there at a place and the country shows up here — a quiet map of the people you met along the way.'
            : 'The countries they’ve raised a glass in will show up here.'
        }
        actionLabel={isMe ? 'Find a place' : undefined}
        onAction={isMe ? () => navigateByName(navigation, 'Discover') : undefined}
      />
    );
  }

  const totalPlaces = list.reduce((sum, r) => sum + (Number(r?.place_count) || 0), 0);

  return (
    <View>
      {!!trips?.error && (
        <View style={{ marginBottom: 14 }}>
          <PillarError message={trips.error} onRetry={() => trips.reload?.()} />
        </View>
      )}

      <SectionHeading
        title="Trips"
        caption={`${plural(list.length, 'country', 'countries')} · ${plural(totalPlaces, 'place')}`}
      />

      <View style={{ paddingHorizontal: GUTTER, gap: GAP }}>
        {visible.map((trip, i) => {
          const code = String(trip?.country || '').trim().toUpperCase();
          const active = !!code && selected === code;
          return (
            <View key={code || `trip-${i}`}>
              <CountryCard
                trip={trip}
                active={active}
                onPress={() => setSelected((cur) => (cur === code ? null : code))}
              />

              {active && (
                <View style={styles.drawer}>
                  {linkedLoading ? (
                    <View style={{ marginHorizontal: -GUTTER }}>
                      <PillarSkeleton variant="rows" />
                    </View>
                  ) : moments.length ? (
                    <View style={{ marginHorizontal: -GUTTER }}>
                      {moments.map((p) => (
                        <MomentRow
                          key={String(p.id)}
                          post={p}
                          onPress={() => openPost(p)}
                          onOptions={
                            isMe
                              ? undefined
                              : () =>
                                  ugc?.openMenu?.({
                                    targetType: 'post',
                                    targetId: p.id,
                                    authorId: p.user_id,
                                    authorName: p.name,
                                    noun: 'moment',
                                  })
                          }
                        />
                      ))}
                    </View>
                  ) : (
                    <Text style={[type.caption, { color: t.textMuted, lineHeight: 19 }]}>
                      {isMe
                        ? 'No moments pinned to a place here yet — add one next time and this fills in.'
                        : 'No moments pinned to a place here yet.'}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={{ marginTop: GAP }}>
        <ShowAll hidden={showAll ? 0 : list.length - visible.length} onPress={() => setShowAll(true)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: radius.md, borderWidth: 1,
  },
  flag: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  drawer: { paddingTop: 12 },
});
