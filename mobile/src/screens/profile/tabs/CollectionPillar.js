// src/screens/profile/tabs/CollectionPillar.js
// Pillar 3 — Collection. The shelf, laid out as a shelf.
//
// Server: GET /collection (server/routes/collection.js). The route reads
// `req.query.user_id` and falls back to the signed-in user, so viewing someone
// else's shelf MUST send user_id — `userId` is silently ignored and you get
// your own shelf back under their name. (ProfileScreen's existing Bar tab has
// that bug today; see the notes in the structured result.)
//
// Rows are drawn three-up on a plank so the grid reads as glassware on a shelf
// rather than a table of products. Bottles are detail, never the subject —
// the copy stays about the person who collected them.

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import api from '../../../api';
import { useTheme } from '../../../theme/ThemeContext';
import { radius, type } from '../../../theme/tokens';
import { Icon, Bounce } from '../../../components/ui';
import useProfileResource from '../useProfileResource';
import {
  GAP, GUTTER, OptionsButton, PillarEmpty, PillarError, PillarSkeleton,
  SectionHeading, ShowAll, Thumb, chunk, columnWidth, navigateByName, plural, scoreText,
  useMeasuredWidth,
} from '../pillarKit';

const CAP = 9;
const COLUMNS = 3;

function Bottle({ item, width, onPress, onOptions }) {
  const { t } = useTheme();
  const score = scoreText(item?.rating);
  const meta = [item?.distillery, item?.vintage].filter(Boolean).join(' · ') || item?.drink_type || '';

  return (
    <View style={{ width }}>
      <Bounce
        onPress={onPress}
        haptic="light"
        scaleTo={0.96}
        accessibilityLabel={
          `${item?.name || 'Bottle'}${score ? `, scored ${score} out of 10` : ''}`
        }
        style={[styles.bottle, { backgroundColor: t.surface, borderColor: t.border }]}
      >
        <View style={styles.bottleArt}>
          <Thumb
            uri={item?.image_url}
            width={width - 2}
            height={104}
            round={0}
            icon="wine-outline"
            iconSize={22}
          />
          {!!score && (
            <View style={[styles.score, { backgroundColor: t.accent }]}>
              <Text style={[type.caption, { color: t.textOnAccent, fontWeight: '700', fontVariant: ['tabular-nums'] }]}>
                {score}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.bottleBody}>
          <Text style={[type.caption, { color: t.text, fontWeight: '700' }]} numberOfLines={2}>
            {item?.name || 'Unnamed'}
          </Text>
          {!!meta && (
            <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>
      </Bounce>
      {onOptions ? <OptionsButton onPress={onOptions} label="Bottle options" overlay /> : null}
    </View>
  );
}

export default function CollectionPillar({
  userId, isMe, token, navigation, ugc, memberName, onError,
}) {
  const { t } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [width, onLayout] = useMeasuredWidth(0);

  const shelf = useProfileResource(
    async () => {
      // user_id — the query key the server actually reads.
      const res = await api.get(`/collection?user_id=${encodeURIComponent(userId)}`);
      return Array.isArray(res?.data) ? res.data : [];
    },
    { token, key: `collection:${userId}`, onError },
  );

  const list = Array.isArray(shelf.data) ? shelf.data : [];
  const visible = expanded ? list : list.slice(0, CAP);
  const rows = chunk(visible, COLUMNS);
  const cardWidth = columnWidth(Math.max(0, width - GUTTER * 2), COLUMNS);

  if (shelf.loading && shelf.data == null) {
    return (
      <View onLayout={onLayout}>
        <PillarSkeleton variant="grid3" width={Math.max(0, width - GUTTER * 2)} />
      </View>
    );
  }

  if (shelf.error && !list.length) {
    return <PillarError message={shelf.error} onRetry={shelf.reload} />;
  }

  if (!list.length) {
    return (
      <PillarEmpty
        icon="library-outline"
        title={isMe ? 'The shelf is empty' : 'Nothing on the shelf yet'}
        body={
          isMe
            ? 'Add the ones you’d pour for a friend — the shelf is really a list of stories you can hand someone.'
            : 'When they add to their shelf, it shows up here.'
        }
        actionLabel={isMe ? 'Add a bottle' : undefined}
        onAction={isMe ? () => navigateByName(navigation, 'AddBottle') : undefined}
      />
    );
  }

  return (
    <View onLayout={onLayout}>
      {!!shelf.error && (
        <View style={{ marginBottom: 14 }}>
          <PillarError message={shelf.error} onRetry={shelf.reload} />
        </View>
      )}

      <SectionHeading
        title="The shelf"
        caption={`${plural(list.length, 'bottle')} worth pouring for someone`}
        actionLabel={isMe ? 'Add' : undefined}
        onAction={isMe ? () => navigateByName(navigation, 'AddBottle') : undefined}
      />

      {width > 0 && rows.map((row, i) => (
        <View key={`shelf-${i}`} style={styles.shelfRow}>
          <View style={styles.grid}>
            {row.map((item) => (
              <Bottle
                key={String(item.id)}
                item={item}
                width={cardWidth}
                onPress={isMe ? () => navigateByName(navigation, 'Taste') : undefined}
                onOptions={
                  isMe
                    ? undefined
                    : () =>
                        ugc?.openMenu?.({
                          targetType: 'user',
                          targetId: userId,
                          authorId: userId,
                          authorName: memberName,
                          noun: 'shelf',
                        })
                }
              />
            ))}
            {row.length < COLUMNS &&
              Array.from({ length: COLUMNS - row.length }).map((_, k) => (
                <View key={`pad-${k}`} style={{ width: cardWidth }} />
              ))}
          </View>
          {/* The plank. A shelf without one is just a grid. */}
          <View style={[styles.plank, { backgroundColor: t.borderStrong }]} />
        </View>
      ))}

      <ShowAll hidden={expanded ? 0 : list.length - visible.length} onPress={() => setExpanded(true)} />

      {isMe && (
        <View style={styles.hintRow}>
          <Icon name="information-circle-outline" size={13} color={t.textMuted} />
          <Text style={[type.caption, { color: t.textMuted, flex: 1 }]}>
            Tap any bottle to open your shelf and edit it.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shelfRow: { marginBottom: 16 },
  grid: { flexDirection: 'row', gap: GAP, paddingHorizontal: GUTTER },
  plank: { height: 2, marginHorizontal: GUTTER, marginTop: 6, borderRadius: 1, opacity: 0.6 },
  bottle: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  bottleArt: { position: 'relative' },
  bottleBody: { paddingHorizontal: 8, paddingTop: 7, paddingBottom: 9, minHeight: 52 },
  score: {
    position: 'absolute', left: 6, bottom: 6,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.xs,
  },
  hintRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: GUTTER, marginTop: 6,
  },
});
