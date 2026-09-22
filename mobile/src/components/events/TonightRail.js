// src/components/events/TonightRail.js
// Horizontal preview rail meant to sit inside the Discover screen as
// "Tonight & upcoming". Fetches on its own, degrades quietly on error, and
// stays out of the way when the calendar is empty.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Avatar, Bounce } from '../ui';
import DateChip from './DateChip';
import { Shimmer } from '../ui/Skeleton';
import { whenLabel } from './dateUtils';

const CARD_W = 240;

function MiniCard({ event, onPress }) {
  const { t, elevation } = useTheme();
  const rsvped = !!event.user_rsvped;
  const count = Number(event.rsvp_count) || 0;

  return (
    <Bounce
      onPress={() => onPress?.(event)}
      haptic="light"
      scaleTo={0.97}
      accessibilityLabel={`${event.title || 'Event'}, ${whenLabel(event.date)}`}
    >
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
        <View style={styles.head}>
          <DateChip date={event.date} />
          {rsvped && (
            <View style={[styles.pill, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
              <Icon name="checkmark" size={11} color={t.accentText} />
              <Text style={{ color: t.accentText, fontWeight: '700', fontSize: 10 }}>Going</Text>
            </View>
          )}
        </View>
        <Text style={[type.h3, { color: t.text, marginTop: 12 }]} numberOfLines={2}>
          {event.title || 'Untitled gathering'}
        </Text>
        <Text style={[type.caption, { color: t.textMuted, marginTop: 4 }]} numberOfLines={1}>
          {whenLabel(event.date)}
        </Text>
        <View style={styles.footer}>
          <Avatar uri={event.avatar} name={event.name} size={20} />
          <Text style={[type.caption, { color: t.textSecondary, flex: 1 }]} numberOfLines={1}>
            {event.name || 'A member'}
          </Text>
          <Icon name="people-outline" size={12} color={t.textMuted} />
          <Text style={[type.caption, { color: t.textMuted, fontWeight: '600' }]}>{count}</Text>
        </View>
      </View>
    </Bounce>
  );
}

function CardSkeleton() {
  const { t, elevation } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
      <Shimmer style={{ width: 46, height: 48, borderRadius: radius.sm }} />
      <Shimmer style={{ width: '85%', height: 14, borderRadius: 6, marginTop: 14 }} />
      <Shimmer style={{ width: '55%', height: 11, borderRadius: 5, marginTop: 10 }} />
      <Shimmer style={{ width: '70%', height: 11, borderRadius: 5, marginTop: 16 }} />
    </View>
  );
}

export default function TonightRail({ limit = 6, onSeeAll }) {
  const { t } = useTheme();
  const navigation = useNavigation();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/events');
        if (!alive) return;
        setEvents(Array.isArray(res.data) ? res.data.slice(0, limit) : []);
      } catch {
        if (alive) setEvents([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [limit]);

  const openEvent = useCallback((event) => {
    navigation.navigate('EventDetail', { id: event.id, event });
  }, [navigation]);

  const seeAll = useCallback(() => {
    if (onSeeAll) return onSeeAll();
    navigation.navigate('Events');
  }, [navigation, onSeeAll]);

  const items = useMemo(() => events, [events]);

  // If the calendar is empty and we're not loading, render nothing — Discover
  // shouldn't be padded out with an empty rail.
  if (!loading && items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[type.h2, { color: t.text }]}>Tonight & upcoming</Text>
          <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>
            Small rounds, big nights — whichever suits you
          </Text>
        </View>
        <Bounce onPress={seeAll} haptic="light" hitSlop={8} accessibilityLabel="See all events">
          <Text style={[type.label, { color: t.accent }]}>See all</Text>
        </Bounce>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        snapToInterval={CARD_W + 12}
        decelerationRate="fast"
      >
        {loading
          ? [0, 1, 2].map((i) => <CardSkeleton key={i} />)
          : items.map((e) => <MiniCard key={e.id} event={e} onPress={openEvent} />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  rail: { paddingHorizontal: 12, gap: 12, paddingVertical: 4 },
  card: {
    width: CARD_W,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 168,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
});
