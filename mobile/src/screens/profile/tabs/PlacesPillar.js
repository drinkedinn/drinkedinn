// src/screens/profile/tabs/PlacesPillar.js
// Pillar 2 — Places. The rooms this member has actually stood in.
//
// Server: GET /users/:id/places (server/routes/users.js) returns the places
// table joined to place_visits, one row per place, newest visit first:
//   { id, name, category, city, country, lat, lng, cover_url, created_by,
//     created_at, last_visit, visit_count }
// Note it is NOT the decorated shape /places returns — there is no `saved` and
// no `story_count` here, so neither is rendered.
//
// Tapping a place is handled in-module by default — it filters this member's
// moments down to that place — so the pillar never depends on a route it can't
// be sure is registered. The `onOpenPlace` prop hands the tap to a real place
// screen instead; if the Places module is wired, that is one line:
//     onOpenPlace={(place) => navigation.navigate('PlaceProfile', { id: place.id, place })}

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { radius, type } from '../../../theme/tokens';
import { Icon, Bounce } from '../../../components/ui';
import {
  GAP, GUTTER, MomentRow, OptionsButton, PillarEmpty, PillarError, PillarSkeleton,
  SectionHeading, ShowAll, Thumb, chunk, columnWidth, navigateByName, plural, timeAgo,
  useMeasuredWidth,
} from '../pillarKit';

const CAP = 8;
const COLUMNS = 2;

function PlaceCard({ place, width, active, onPress, onOptions }) {
  const { t, elevation } = useTheme();
  const visits = Number(place?.visit_count) || 0;
  const meta = [place?.category, place?.city].filter(Boolean).join(' · ');

  return (
    <View style={{ width }}>
      <Bounce
        onPress={onPress}
        haptic="light"
        scaleTo={0.97}
        accessibilityLabel={`Open ${place?.name || 'this place'}`}
        accessibilityState={{ selected: !!active }}
        style={[
          styles.card,
          // Border colour only — changing borderWidth would reflow the cover
          // image inside an overflow:hidden card.
          { backgroundColor: active ? t.accentSoft : t.surface, borderColor: active ? t.accent : t.border },
          elevation(t, 1),
        ]}
      >
        <Thumb
          uri={place?.cover_url}
          width={width}
          height={96}
          round={0}
          icon="business-outline"
          iconSize={22}
        />
        <View style={styles.cardBody}>
          <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
            {place?.name || 'A place'}
          </Text>
          <Text style={[type.caption, { color: t.textMuted, marginTop: 3 }]} numberOfLines={1}>
            {meta || 'Somewhere worth going back to'}
          </Text>
          <View style={styles.cardFoot}>
            <Icon name="footsteps-outline" size={12} color={t.accent} />
            <Text style={[type.caption, { color: t.textSecondary }]} numberOfLines={1}>
              {visits > 0 ? plural(visits, 'visit') : 'Been here'}
              {place?.last_visit ? ` · ${timeAgo(place.last_visit)}` : ''}
            </Text>
          </View>
        </View>
      </Bounce>
      {onOptions ? <OptionsButton onPress={onOptions} label="Place options" overlay /> : null}
    </View>
  );
}

export default function PlacesPillar({
  isMe, navigation, ugc, places, posts, onOpenPlace,
}) {
  const { t } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [width, onLayout] = useMeasuredWidth(0);

  const list = Array.isArray(places?.data) ? places.data : [];
  const cardWidth = columnWidth(Math.max(0, width - GUTTER * 2), COLUMNS);

  const visible = expanded ? list : list.slice(0, CAP);
  const rows = chunk(visible, COLUMNS);

  // Resolved from the live list rather than held as a snapshot, so a refresh
  // that drops the place also drops the filter instead of stranding it.
  const selected = useMemo(
    () => list.find((p) => String(p?.id) === String(selectedId)) || null,
    [list, selectedId],
  );

  // Moments this member anchored to the selected place. posts.place_id is the
  // canonical link (posts.place_id → places.id); location is free text and is
  // only used as a fallback label, never as the match.
  const placeMoments = useMemo(() => {
    if (!selected) return [];
    const all = Array.isArray(posts?.data) ? posts.data : [];
    return all.filter((p) => p?.place_id != null && String(p.place_id) === String(selected.id));
  }, [selected, posts?.data]);

  const openPost = (post) => navigateByName(navigation, 'PostDetail', { post });

  const tapPlace = (place) => {
    if (onOpenPlace) { onOpenPlace(place); return; }
    setSelectedId((cur) => (String(cur) === String(place?.id) ? null : place?.id));
  };

  if (places?.loading && places?.data == null) {
    return (
      <View onLayout={onLayout}>
        <PillarSkeleton variant="grid2" width={Math.max(0, width - GUTTER * 2)} />
      </View>
    );
  }

  if (places?.error && !list.length) {
    return <PillarError message={places.error} onRetry={() => places.reload?.()} />;
  }

  if (!list.length) {
    return (
      <PillarEmpty
        icon="location-outline"
        title={isMe ? 'No places pinned yet' : 'No places yet'}
        body={
          isMe
            ? 'Add your first place from the map — the corner table, the harbour bar, the one you keep going back to.'
            : 'The places they’ve been will show up here.'
        }
        actionLabel={isMe ? 'Find a place' : undefined}
        onAction={isMe ? () => navigateByName(navigation, 'Explore') : undefined}
      />
    );
  }

  return (
    <View onLayout={onLayout}>
      {!!places?.error && (
        <View style={{ marginBottom: 14 }}>
          <PillarError message={places.error} onRetry={() => places.reload?.()} />
        </View>
      )}

      <SectionHeading
        title="Been there"
        caption={`${plural(list.length, 'place')} · most recent first`}
      />

      {width > 0 && rows.map((row, i) => (
        <View key={`row-${i}`} style={styles.gridRow}>
          {row.map((place) => (
            <PlaceCard
              key={String(place.id)}
              place={place}
              width={cardWidth}
              active={!!selected && String(selected.id) === String(place.id)}
              onPress={() => tapPlace(place)}
              onOptions={
                isMe
                  ? undefined
                  : () =>
                      ugc?.openMenu?.({
                        targetType: 'place',
                        targetId: place.id,
                        authorId: place.created_by,
                        authorName: place.name,
                        noun: 'place',
                      })
              }
            />
          ))}
          {/* Keeps the last odd card at one column instead of stretching it. */}
          {row.length < COLUMNS && <View style={{ width: cardWidth }} />}
        </View>
      ))}

      <ShowAll hidden={expanded ? 0 : list.length - visible.length} onPress={() => setExpanded(true)} />

      {!!selected && (
        <View style={{ marginTop: 22 }}>
          <View style={styles.filterRow}>
            <View style={[styles.filterChip, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
              <Icon name="location" size={13} color={t.accent} />
              <Text style={[type.label, { color: t.accentText, flex: 1 }]} numberOfLines={1}>
                {selected.name}
              </Text>
              <Bounce
                onPress={() => setSelectedId(null)}
                haptic="light"
                hitSlop={10}
                accessibilityLabel="Clear place filter"
              >
                <Icon name="close" size={15} color={t.accentText} />
              </Bounce>
            </View>
          </View>

          {posts?.loading && posts?.data == null ? (
            <PillarSkeleton variant="rows" />
          ) : placeMoments.length ? (
            placeMoments.map((p) => (
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
            ))
          ) : (
            <Text style={[type.body, styles.quiet, { color: t.textMuted }]}>
              {isMe
                ? 'No moments saved here yet — next round, pin one to this place.'
                : 'They haven’t shared a moment from here yet.'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gridRow: { flexDirection: 'row', gap: GAP, paddingHorizontal: GUTTER, marginBottom: GAP },
  card: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  cardBody: { padding: 11 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  filterRow: { paddingHorizontal: GUTTER, marginBottom: 12 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: radius.pill, borderWidth: 1,
  },
  quiet: { paddingHorizontal: GUTTER, lineHeight: 21 },
});
