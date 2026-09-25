// src/components/events/EventCard.js
// Row-style card for the events list: date chip, title, place, host, going count.

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Avatar, Bounce } from '../ui';
import DateChip from './DateChip';
import { whenLabel } from './dateUtils';

function goingLabel(count, rsvped) {
  const n = Number(count) || 0;
  if (n === 0) return rsvped ? 'You’re going' : 'Be the first to say you’re in';
  if (rsvped) return n === 1 ? 'You’re going' : `You and ${n - 1} other${n - 1 === 1 ? '' : 's'} going`;
  return `${n} going`;
}

function EventCard({ event, onPress }) {
  const { t, elevation } = useTheme();
  const rsvped = !!event?.user_rsvped;

  return (
    <Bounce
      onPress={() => onPress?.(event)}
      haptic="light"
      scaleTo={0.985}
      accessibilityLabel={`${event?.title || 'Event'}, ${whenLabel(event?.date)}`}
    >
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
        <DateChip date={event?.date} />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[type.h3, { color: t.text, flex: 1 }]} numberOfLines={2}>
              {event?.title || 'Untitled gathering'}
            </Text>
            {rsvped && (
              <View style={[styles.pill, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
                <Icon name="checkmark" size={12} color={t.accentText} />
                <Text style={{ color: t.accentText, fontWeight: '700', fontSize: 11 }}>Going</Text>
              </View>
            )}
          </View>

          <Text style={[type.caption, { color: t.textMuted, marginTop: 3 }]} numberOfLines={1}>
            {whenLabel(event?.date)}
          </Text>

          {!!event?.location && (
            <View style={styles.metaRow}>
              <Icon name="location-outline" size={13} color={t.textMuted} />
              <Text style={[type.caption, { color: t.textMuted, flex: 1 }]} numberOfLines={1}>
                {event.location}
              </Text>
            </View>
          )}

          <View style={styles.footer}>
            <Avatar uri={event?.avatar} name={event?.name} size={22} />
            <Text style={[type.caption, { color: t.textSecondary, flex: 1 }]} numberOfLines={1}>
              Hosted by {event?.name || 'a member'}
            </Text>
            <View style={styles.goingChip}>
              <Icon name="people-outline" size={13} color={t.textMuted} />
              <Text style={[type.caption, { color: t.textMuted, fontWeight: '600' }]}>
                {goingLabel(event?.rsvp_count, rsvped)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Bounce>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  goingChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});

export default memo(EventCard);
