// src/screens/profile/tabs/RatingsPillar.js
// Pillar 5 — Ratings. Someone's palate, in their own words.
//
// Server: GET /ratings (server/routes/ratings.js) → rows of drink_ratings:
//   { id, user_id, drink_name, distillery, drink_type, rating, nose, palate,
//     finish, image_url, created_at }
// The route reads `req.query.user_id` and falls back to the signed-in user, so
// another member's ratings must be requested with user_id — anything else
// quietly returns your own. The server orders by created_at; this pillar is a
// "best of", so it re-sorts by score.
//
// Scores are 0–10 in half steps (AddRatingScreen / ScoreControl). The notes,
// not the number, are the point — the number just sets the order.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import api from '../../../api';
import { useTheme } from '../../../theme/ThemeContext';
import { radius, type } from '../../../theme/tokens';
import { Bounce } from '../../../components/ui';
import useProfileResource from '../useProfileResource';
import {
  GUTTER, OptionsButton, PillarEmpty, PillarError, PillarSkeleton,
  SectionHeading, ShowAll, Thumb, monthLabel, navigateByName, parseDate, plural, scoreText,
} from '../pillarKit';

const CAP = 6;

function Note({ label, value, t }) {
  if (!value) return null;
  return (
    <View style={styles.noteRow}>
      <Text style={[type.overline, { color: t.textMuted, width: 50, textTransform: 'uppercase' }]}>
        {label}
      </Text>
      <Text style={[type.caption, { color: t.textSecondary, flex: 1, lineHeight: 18 }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function RatingRow({ item, expanded, onToggle, onOptions }) {
  const { t } = useTheme();
  const score = scoreText(item?.rating);
  const meta = [item?.drink_type, item?.distillery].filter(Boolean).join(' · ');
  const hasNotes = !!(item?.nose || item?.palate || item?.finish);

  return (
    <View style={{ paddingHorizontal: GUTTER, marginBottom: 10 }}>
      <Bounce
        onPress={hasNotes ? onToggle : undefined}
        haptic={hasNotes ? 'light' : null}
        scaleTo={0.99}
        accessibilityLabel={
          `${item?.drink_name || 'Unnamed'}${score ? `, ${score} out of 10` : ''}` +
          (hasNotes ? ', tap for notes' : '')
        }
        style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}
      >
        <View style={styles.head}>
          <Thumb uri={item?.image_url} width={46} height={46} round={radius.sm} icon="wine-outline" iconSize={18} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
              {item?.drink_name || 'Unnamed'}
            </Text>
            <Text style={[type.caption, { color: t.textMuted, marginTop: 3 }]} numberOfLines={1}>
              {[meta, monthLabel(item?.created_at)].filter(Boolean).join(' · ') || 'A note worth keeping'}
            </Text>
          </View>
          {!!score && (
            <View style={[styles.score, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
              <Text style={[type.h3, { color: t.accentText, fontVariant: ['tabular-nums'] }]}>{score}</Text>
              <Text style={[type.caption, { color: t.accentText, opacity: 0.7 }]}>/10</Text>
            </View>
          )}
          {onOptions ? <OptionsButton onPress={onOptions} label="Rating options" style={{ marginLeft: 4 }} /> : null}
        </View>

        {hasNotes && expanded && (
          <View style={[styles.notes, { borderTopColor: t.divider }]}>
            <Note label="Nose" value={item?.nose} t={t} />
            <Note label="Palate" value={item?.palate} t={t} />
            <Note label="Finish" value={item?.finish} t={t} />
          </View>
        )}
      </Bounce>
    </View>
  );
}

export default function RatingsPillar({
  userId, isMe, token, navigation, ugc, memberName, onError,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const ratings = useProfileResource(
    async () => {
      // user_id — the query key the server actually reads.
      const res = await api.get(`/ratings?user_id=${encodeURIComponent(userId)}`);
      return Array.isArray(res?.data) ? res.data : [];
    },
    { token, key: `ratings:${userId}`, onError },
  );

  // Highest score first; ties go to the more recent note.
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

  if (ratings.error && !sorted.length) {
    return <PillarError message={ratings.error} onRetry={ratings.reload} />;
  }

  if (!sorted.length) {
    return (
      <PillarEmpty
        icon="sparkles-outline"
        title={isMe ? 'No notes yet' : 'Nothing written down yet'}
        body={
          isMe
            ? 'What did it smell like? What stayed with you? Write it down while you still remember.'
            : 'When they write down what a pour was like, it shows up here.'
        }
        actionLabel={isMe ? 'Write a note' : undefined}
        onAction={isMe ? () => navigateByName(navigation, 'AddRating') : undefined}
      />
    );
  }

  const top = scoreText(sorted[0]?.rating);

  return (
    <View>
      {!!ratings.error && (
        <View style={{ marginBottom: 14 }}>
          <PillarError message={ratings.error} onRetry={ratings.reload} />
        </View>
      )}

      <SectionHeading
        title="Tasting notes"
        caption={`${plural(sorted.length, 'note')}${top ? ` · best so far ${top}/10` : ''}`}
        actionLabel={isMe ? 'Add' : undefined}
        onAction={isMe ? () => navigateByName(navigation, 'AddRating') : undefined}
      />

      {visible.map((item) => (
        <RatingRow
          key={String(item.id)}
          item={item}
          expanded={String(expandedId) === String(item.id)}
          onToggle={() =>
            setExpandedId((cur) => (String(cur) === String(item.id) ? null : item.id))
          }
          onOptions={
            isMe
              ? undefined
              : () =>
                  ugc?.openMenu?.({
                    targetType: 'user',
                    targetId: userId,
                    authorId: userId,
                    authorName: memberName,
                    noun: 'note',
                  })
          }
        />
      ))}

      <ShowAll hidden={showAll ? 0 : sorted.length - visible.length} onPress={() => setShowAll(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, padding: 12 },
  head: { flexDirection: 'row', alignItems: 'center' },
  score: {
    flexDirection: 'row', alignItems: 'baseline', gap: 1,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: radius.sm, borderWidth: 1, marginLeft: 8,
  },
  notes: { marginTop: 12, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, gap: 7 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
