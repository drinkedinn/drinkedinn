// src/components/onboarding-v2/PersonRow.js
// One suggested person: identity, a one-tap Follow, and the report / block
// affordance that has to sit on every surface showing user content.
//
// Names, avatars and titles here are user-generated, so App Store 1.2 and
// Play's UGC policy both apply from the very first screen a new account sees.
// The reason picker is showReportSheet (never Alert.alert — Android silently
// drops everything past the third button).

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Avatar, Bounce, Shimmer } from '../ui';

/** Placeholder with the same metrics as a real row, so nothing shifts on load. */
export function PersonRowSkeleton() {
  const { t } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Shimmer style={{ width: 46, height: 46, borderRadius: 23 }} />
      <View style={{ flex: 1 }}>
        <Shimmer style={{ width: '52%', height: 12, borderRadius: 6 }} />
        <Shimmer style={{ width: '34%', height: 10, borderRadius: 5, marginTop: 8 }} />
      </View>
      <Shimmer style={{ width: 104, height: 36, borderRadius: radius.pill }} />
      <View style={styles.more} />
    </View>
  );
}

function subtitleFor(person) {
  const bits = [];
  if (person?.title) bits.push(String(person.title));
  const followers = Number(person?.followers);
  if (Number.isFinite(followers) && followers > 0) {
    bits.push(`${followers} follower${followers === 1 ? '' : 's'}`);
  }
  return bits.join(' · ');
}

export default function PersonRow({ person, following, busy, onToggleFollow, onOpenMenu }) {
  const { t } = useTheme();
  if (!person || person.id == null) return null;

  const name = person.name || 'DrinkedInn member';
  const subtitle = subtitleFor(person);

  return (
    <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Avatar uri={person.avatar} name={name} size={46} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.nameRow}>
          <Text style={[type.bodyStrong, { color: t.text, flexShrink: 1 }]} numberOfLines={1}>
            {name}
          </Text>
          {!!person.verified && <Icon name="checkmark-circle" size={14} color={t.blue} />}
        </View>
        {!!subtitle && (
          <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        {Number(person.overlap) > 0 && (
          <View style={[styles.tag, { backgroundColor: t.accentSoft }]}>
            <Icon name="sparkles-outline" size={11} color={t.accent} />
            <Text style={[type.caption, { color: t.accentText }]}>Shares your interests</Text>
          </View>
        )}
      </View>

      <Bounce
        onPress={() => onToggleFollow?.(person)}
        disabled={busy}
        haptic="medium"
        scaleTo={0.93}
        accessibilityLabel={following ? `Following ${name}. Tap to unfollow.` : `Follow ${name}`}
        style={[
          styles.follow,
          {
            backgroundColor: following ? t.surfaceAlt : t.accent,
            borderColor: following ? t.borderStrong : 'transparent',
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={following ? t.text : t.textOnAccent} />
        ) : (
          <>
            <Icon
              name={following ? 'checkmark' : 'add'}
              size={15}
              color={following ? t.text : t.textOnAccent}
            />
            <Text style={[type.label, { color: following ? t.text : t.textOnAccent }]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </>
        )}
      </Bounce>

      <Bounce
        onPress={() => onOpenMenu?.(person)}
        haptic="light"
        hitSlop={10}
        scaleTo={0.9}
        accessibilityLabel={`Report or block ${name}`}
        style={styles.more}
      >
        <Icon name="ellipsis-horizontal" size={18} color={t.textMuted} />
      </Bounce>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  follow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 104,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  more: { padding: 8 },
});
