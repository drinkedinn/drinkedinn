// src/screens/profile/tabs/RatingsPillar.js
// Pillar — Ratings. What someone thought of the places they went to.
//
// This used to render drink_ratings: drink_name, distillery, and a tasting note
// split across nose / palate / finish. Those fields do not describe a rooftop or
// a dining room, so the server now returns place ratings and this renders them.
//
// Server: GET /ratings?user_id= (server/routes/ratings.js) →
//   { id, rating, note, created_at, place_id, place_name, city, country,
//     category, cover_url }
// The place is JOINED in deliberately, so a list of twenty ratings is one
// request rather than twenty — the N+1 that had GET /api/places costing 152
// subrequests against a cap of 50.
//
// Scores are 1–5. The old scale was 0–10 in half steps, so scoreText() from
// pillarKit is NOT used here: it formats for the old range and would render a
// 4.5 as if it were middling.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import api from '../../../api';
import { useTheme } from '../../../theme/ThemeContext';
import { radius, type } from '../../../theme/tokens';
import { Bounce, Icon } from '../../../components/ui';
import useProfileResource from '../useProfileResource';
import {
  GUTTER, OptionsButton, PillarEmpty, PillarError, PillarSkeleton,
  SectionHeading, ShowAll, Thumb, navigateByName, parseDate, plural,
} from '../pillarKit';

const CAP = 6;
const MAX_SCORE = 5;

/** Filled stars to the score, rounded to the nearest half. */
function Stars({ value, size = 13 }) {
  const { t } = useTheme();
  const score = Math.max(0, Math.min(MAX_SCORE, Number(value) || 0));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }} accessible accessibilityLabel={`${score} out of ${MAX_SCORE}`}>
      {Array.from({ length: MAX_SCORE }, (_, i) => {
        const filled = score >= i + 1;
        const half = !filled && score >= i + 0.5;
        return (
          <Icon
            key={i}
            name={filled ? 'star' : half ? 'star-half' : 'star-outline'}
            size={size}
            color={filled || half ? t.accent : t.textMuted}
          />
        );
      })}
    </View>
  );
}

function RatingRow({ item, onOpen, onOptions }) {
  const { t } = useTheme();
  const meta = [item?.category, item?.city].filter(Boolean).join(' · ');

  return (
    <View style={{ paddingHorizontal: GUTTER, marginBottom: 10 }}>
      <Bounce
        onPress={onOpen}
        haptic="light"
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityLabel={`${item?.place_name || 'Place'}, rated ${item?.rating} out of ${MAX_SCORE}`}
        style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}
      >
        <Thumb uri={item?.cover_url} width={54} height={54} round={radius.sm} icon="location-outline" />

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[type.label, { color: t.text }]} numberOfLines={1}>
            {item?.place_name || 'Unnamed place'}
          </Text>
          {!!meta && (
            <Text style={[type.caption, { color: t.textMuted, marginTop: 1 }]} numberOfLines={1}>
              {meta}
            </Text>
          )}
          <View style={{ marginTop: 5 }}>
            <Stars value={item?.rating} />
          </View>
          {/* One free-text note replaces nose/palate/finish — three labelled
              fields made sense for a dram and none for a room. */}
          {!!item?.note && (
            <Text style={[type.caption, { color: t.textSecondary, marginTop: 6, lineHeight: 18 }]} numberOfLines={3}>
              {item.note}
            </Text>
          )}
        </View>

        {!!onOptions && <OptionsButton onPress={onOptions} />}
      </Bounce>
    </View>
  );
}

export default function RatingsPillar({
  userId, token, isMe, navigation, onError, onOptions,
}) {
  const { t } = useTheme();
  const [showAll, setShowAll] = useState(false);

  const ratings = useProfileResource(
    async () => {
      // user_id — the query key the server reads. Without it the route falls
      // back to the signed-in user and quietly returns your own ratings on
      // someone else's profile.
      const res = await api.get(`/ratings?user_id=${encodeURIComponent(userId)}`);
      return Array.isArray(res?.data) ? res.data : [];
    },
    { token, key: `ratings:${userId}`, onError },
  );

  // Best first; ties to the more recent.
  const sorted = useMemo(() => {
    const list = Array.isArray(ratings.data) ? ratings.data : [];
    return [...list].sort((a, b) => {
      const diff = (Number(b?.rating) || 0) - (Number(a?.rating) || 0);
      if (diff !== 0) return diff;
      return (parseDate(b?.created_at)?.getTime() || 0) - (parseDate(a?.created_at)?.getTime() || 0);
    });
  }, [ratings.data]);

  const visible = showAll ? sorted : sorted.slice(0, CAP);

  if (ratings.loading && ratings.data == null) return <PillarSkeleton variant="rows" />;
  if (ratings.error && !sorted.length) return <PillarError message={ratings.error} onRetry={ratings.reload} />;

  if (!sorted.length) {
    return (
      <PillarEmpty
        icon="star-outline"
        title={isMe ? 'No places rated yet' : 'Nothing rated yet'}
        body={
          isMe
            ? 'Been somewhere worth remembering? Give it a score and a line about why.'
            : 'When they rate a place they have been, it shows up here.'
        }
        actionLabel={isMe ? 'Find a place' : undefined}
        onAction={isMe ? () => navigateByName(navigation, 'Places') : undefined}
      />
    );
  }

  const openPlace = (item) =>
    item?.place_id && navigateByName(navigation, 'PlaceProfile', { id: item.place_id });

  return (
    <View>
      {!!ratings.error && (
        <Text style={[type.caption, { color: t.danger, paddingHorizontal: GUTTER, marginBottom: 8 }]}>
          {ratings.error}
        </Text>
      )}

      <SectionHeading
        title={plural(sorted.length, 'place')}
        subtitle={isMe ? 'Rated by you' : 'Rated by them'}
      />

      {visible.map((item) => (
        <RatingRow
          key={item.id}
          item={item}
          onOpen={() => openPlace(item)}
          onOptions={onOptions ? () => onOptions(item) : undefined}
        />
      ))}

      {sorted.length > CAP && (
        <ShowAll expanded={showAll} count={sorted.length} onPress={() => setShowAll((v) => !v)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
});
