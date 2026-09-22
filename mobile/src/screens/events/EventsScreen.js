// src/screens/events/EventsScreen.js
// Upcoming gatherings from GET /events. The server only returns events with
// `date >= date('now')`, so this screen shows Upcoming and a "Going" cut of the
// same set — a "Past" tab isn't wired because the server doesn't return past
// events. "Create" opens the composer.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Animated } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Icon, Bounce, EmptyState, FadeIn, useToast } from '../../components/ui';
import Segmented from '../../components/home/Segmented';
import EventCard from '../../components/events/EventCard';
import EventCardSkeleton from '../../components/events/EventCardSkeleton';
import { track } from '../../lib/track';

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'going', label: 'Going' },
];

export default function EventsScreen({ navigation }) {
  const { t } = useTheme();
  const toast = useToast();

  const [tab, setTab] = useState('upcoming');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const listRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  useScrollToTop(listRef);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/events');
      setEvents(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } catch (e) {
      setError(e.safeMessage || 'Could not load events.');
      throw e;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try { await load(); } catch (e) { toast?.show(e.safeMessage || 'Could not load events.', 'error'); }
      finally { setLoading(false); }
    })();
  }, [load]);

  // Refresh on focus so RSVPs / new events made elsewhere land here.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      load().catch(() => {});
    });
    return unsub;
  }, [navigation, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); }
    catch (e) { toast?.show(e.safeMessage || 'Could not refresh.', 'error'); }
    finally { setRefreshing(false); }
  }, [load, toast]);

  const data = useMemo(() => {
    if (tab === 'going') return events.filter((e) => !!e?.user_rsvped);
    return events;
  }, [events, tab]);

  const openEvent = useCallback((event) => {
    if (!event?.id) return;
    track('event_open', { id: event.id });
    navigation.navigate('EventDetail', { id: event.id, event });
  }, [navigation]);

  const openCompose = useCallback(() => {
    track('event_compose_open');
    navigation.navigate('CreateEvent');
  }, [navigation]);

  const headerElevation = scrollY.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <Screen>
      <Animated.View
        style={[
          styles.header,
          { backgroundColor: t.bg, borderBottomColor: t.divider, borderBottomWidth: headerElevation },
        ]}
      >
        <Bounce
          onPress={() => navigation.goBack()}
          haptic="light"
          hitSlop={12}
          style={styles.back}
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-back" size={26} color={t.text} />
        </Bounce>
        <View style={{ flex: 1 }}>
          <Text style={[type.h1, { color: t.text }]}>Events</Text>
          <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>
            Nights out, tastings, meetups
          </Text>
        </View>
        <Bounce
          onPress={openCompose}
          haptic="medium"
          style={[styles.createBtn, { backgroundColor: t.accent }]}
          accessibilityLabel="Create event"
        >
          <Icon name="add" size={20} color={t.textOnAccent} />
          <Text style={{ color: t.textOnAccent, fontWeight: '700', fontSize: 14 }}>Create</Text>
        </Bounce>
      </Animated.View>

      {loading ? (
        <View style={{ paddingTop: 12 }}>
          {[0, 1, 2, 3].map((i) => <EventCardSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <View style={{ paddingTop: 8, paddingBottom: 12 }}>
              <Segmented options={TABS} value={tab} onChange={setTab} />
            </View>
          }
          renderItem={({ item, index }) => (
            <FadeIn index={index}>
              <EventCard event={item} onPress={openEvent} />
            </FadeIn>
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
              progressBackgroundColor={t.surface}
            />
          }
          ListEmptyComponent={
            error ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Can't reach the bar"
                body={error}
                actionLabel="Try again"
                onAction={onRefresh}
              />
            ) : tab === 'going' ? (
              <EmptyState
                icon="calendar-outline"
                title="No plans yet"
                body="RSVP to a gathering and it'll show up here so you don't lose track."
                actionLabel="See what's on"
                onAction={() => setTab('upcoming')}
              />
            ) : (
              <EmptyState
                icon="calendar-outline"
                title="Nothing on the calendar"
                body="Start something small — an after-work catch-up counts."
                actionLabel="Create an event"
                onAction={openCompose}
              />
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
  },
  back: { marginLeft: -8, marginRight: 2, padding: 4 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
});
