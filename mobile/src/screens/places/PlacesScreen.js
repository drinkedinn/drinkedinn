// src/screens/places/PlacesScreen.js — the Places pillar.
//
// Five segments over one list: Nearby, Trending, Saved, Visited and Trips.
// Each segment keeps its own rows and status (usePlaceSegments), so switching
// back to one you have already opened is instant. A pinned search field filters
// across all of them via GET /places?q= — searching is a mode that sits on top
// of whichever segment you are in, not a sixth segment.
//
// Nearby needs coordinates. `expo-location` is not in this build (see
// useNearbyLocation.js for the one-step switch), so the segment is disabled and
// the reason is stated in place rather than left as a dead tab.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Animated } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Icon, Bounce, EmptyState, FadeIn } from '../../components/ui';
import {
  PlaceRow,
  TripRow,
  PlaceSearchBar,
  PlaceSegmented,
  LocationNotice,
  Chip,
  PlaceRowSkeleton,
  TripRowSkeleton,
} from '../../components/places';
import {
  distanceLabel,
  shortDate,
  plural,
  countryFlag,
  countryName,
} from '../../components/places/placeUtils';
import usePlaceSegments, { SEGMENTS } from './usePlaceSegments';
import usePlaceSearch from './usePlaceSearch';
import useNearbyLocation, { LOCATION_STATUS } from './useNearbyLocation';
import { track } from '../../lib/track';

const SKELETON_ROWS = [0, 1, 2, 3, 4];

export default function PlacesScreen({ navigation }) {
  const { t, elevation } = useTheme();
  const insets = useSafeAreaInsets();

  const location = useNearbyLocation();
  const segments = usePlaceSegments();
  const search = usePlaceSearch({ minChars: 1 });

  const [tab, setTab] = useState(location.supported ? 'nearby' : 'trending');
  const [noticeOpen, setNoticeOpen] = useState(!location.supported);

  const listRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const firstFocus = useRef(true);
  useScrollToTop(listRef);

  useEffect(() => {
    track('places_open');
  }, []);

  const active = segments.state[tab] || { items: [], status: 'idle' };
  const searching = search.active;

  // ── Loading ───────────────────────────────────────────────────────────────
  // One effect owns "is the visible segment populated?". It re-runs whenever
  // the segment's own status changes, which is why load() clears `stale`
  // immediately — otherwise this would loop while a request is in flight.
  useEffect(() => {
    if (searching) return;
    // Rows already on screen refetch quietly; a cold segment shows skeletons.
    const silent = active.status === 'ready';
    if (tab === 'nearby') {
      if (!location.supported) return;
      if (location.coords) {
        if (active.status === 'idle' || active.stale) {
          segments.load('nearby', { coords: location.coords, silent });
        }
      } else if (location.status === LOCATION_STATUS.IDLE) {
        location.request().then((coords) => {
          if (coords) segments.load('nearby', { coords });
        });
      }
      return;
    }
    if (active.status === 'idle' || active.stale) {
      segments.load(tab, { silent });
    }
  }, [
    tab,
    searching,
    active.status,
    active.stale,
    location.supported,
    location.status,
    location.coords,
    segments,
    location,
  ]);

  // Saves and visits happen on the profile, so anything cached here is suspect
  // the moment we come back. Mark it stale and let the effect above refetch
  // only what is on screen.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      segments.invalidate();
    });
    return unsub;
  }, [navigation, segments]);

  const onRefresh = useCallback(async () => {
    if (searching) {
      search.reload();
      return;
    }
    if (tab === 'nearby') {
      const coords = location.coords || (await location.request());
      if (!coords) return;
      await segments.load('nearby', { coords, refresh: true });
      return;
    }
    await segments.load(tab, { refresh: true });
  }, [searching, search, tab, location, segments]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const openPlace = useCallback(
    (place) => {
      if (!place?.id) return;
      track('place_open', { id: place.id, from: searching ? 'search' : tab });
      navigation.navigate('PlaceProfile', { id: place.id, place });
    },
    [navigation, searching, tab]
  );

  const openAddPlace = useCallback(
    (initialQuery) => {
      track('place_add_open', { from: tab });
      navigation.navigate('AddPlace', {
        initialQuery: initialQuery || '',
        onPicked: (place) => {
          segments.invalidate();
          if (place?.id) navigation.navigate('PlaceProfile', { id: place.id, place });
        },
      });
    },
    [navigation, segments, tab]
  );

  const openCountry = useCallback(
    (trip) => {
      if (!trip?.country) return;
      track('places_country_filter', { country: trip.country });
      search.setCountry(trip.country);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
    [search]
  );

  const changeTab = useCallback(
    (key) => {
      setTab(key);
      track('places_segment', { segment: key });
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    []
  );

  // ── Rows ──────────────────────────────────────────────────────────────────
  const options = useMemo(
    () =>
      SEGMENTS.map((s) =>
        s.key === 'nearby' && !location.supported
          ? { ...s, disabled: true, disabledHint: 'Location is not available in this build' }
          : s
      ),
    [location.supported]
  );

  const chipsFor = useCallback(
    (place) => {
      if (searching || search.country) {
        return place.saved ? [{ icon: 'bookmark', label: 'Saved', tone: 'accent' }] : [];
      }
      if (tab === 'nearby') {
        const d = distanceLabel(place.distance_km);
        return [
          d ? { icon: 'navigate', label: d, tone: 'accent' } : null,
          place.saved ? { icon: 'bookmark', label: 'Saved' } : null,
        ].filter(Boolean);
      }
      if (tab === 'trending') {
        const visits = Number(place.recent_visits) || 0;
        const stories = Number(place.recent_stories) || 0;
        return [
          { icon: 'flame', label: `${visits} recent visit${visits === 1 ? '' : 's'}`, tone: 'accent' },
          stories > 0 ? { icon: 'book-outline', label: plural(stories, 'story', 'stories') } : null,
        ].filter(Boolean);
      }
      if (tab === 'visited') {
        const when = shortDate(place.last_visit);
        const mine = Number(place.my_visits) || 0;
        return [
          when ? { icon: 'time-outline', label: when } : null,
          mine > 1 ? { icon: 'repeat-outline', label: `${mine} visits` } : null,
        ].filter(Boolean);
      }
      return [];
    },
    [tab, searching, search.country]
  );

  const data = searching ? search.results : active.items;
  const isTrips = !searching && tab === 'trips';

  const loading = searching
    ? search.loading && search.results.length === 0
    : active.status === 'loading' && active.items.length === 0;

  const error = searching ? search.error : active.error;

  const keyExtractor = useCallback(
    (item, index) =>
      isTrips ? `trip-${item?.country ?? index}` : `place-${item?.id ?? index}`,
    [isTrips]
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <FadeIn index={index}>
        {isTrips ? (
          <TripRow trip={item} onPress={openCountry} />
        ) : (
          <PlaceRow
            place={item}
            onPress={openPlace}
            chips={chipsFor(item)}
            trailing={!searching && tab === 'saved' ? 'bookmark' : 'chevron'}
            accessibilityHint="Opens this place"
          />
        )}
      </FadeIn>
    ),
    [isTrips, openCountry, openPlace, chipsFor, searching, tab]
  );

  // ── Empty states ──────────────────────────────────────────────────────────
  const emptyState = () => {
    if (loading) return null;

    if (error) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          title="Can't reach the bar"
          body={error}
          actionLabel="Try again"
          onAction={onRefresh}
        />
      );
    }

    if (searching) {
      const label = search.country
        ? countryName(search.country) || search.country
        : `“${search.term}”`;
      return (
        <EmptyState
          icon="search-outline"
          title={`Nothing matches ${label}`}
          body="It might not be on DrinkedInn yet. Add it and it's there for everyone."
          actionLabel="Add a new place"
          onAction={() => openAddPlace(search.query)}
        />
      );
    }

    if (tab === 'nearby') {
      if (!location.supported || location.status === LOCATION_STATUS.DENIED) {
        return (
          <EmptyState
            icon="location-outline"
            title="Turn on location to see what’s nearby"
            body="We only use it to find the rooms around you right now. Your location is never shared with anyone."
            actionLabel="Settings"
            onAction={location.openSettings}
          />
        );
      }
      if (location.status === LOCATION_STATUS.ERROR) {
        return (
          <EmptyState
            icon="navigate-outline"
            title="Couldn’t find you"
            body={location.error || 'We couldn’t get a location fix. Try again in a moment.'}
            actionLabel="Try again"
            onAction={onRefresh}
          />
        );
      }
      return (
        <EmptyState
          icon="navigate-outline"
          title="Nothing within 50 km"
          body="No one has added a place around here yet. Be the first — it takes a few seconds."
          actionLabel="Add a place"
          onAction={() => openAddPlace()}
        />
      );
    }

    if (tab === 'trending') {
      return (
        <EmptyState
          icon="flame-outline"
          title="Nothing’s warming up yet"
          body="When people start sharing moments, the rooms they keep going back to show up here."
          actionLabel="Add a place"
          onAction={() => openAddPlace()}
        />
      );
    }

    if (tab === 'saved') {
      return (
        <EmptyState
          icon="bookmark-outline"
          title="Nowhere saved yet"
          body="Save the rooms you want to walk into one day. They’ll be waiting right here."
          actionLabel="Find a place"
          onAction={() => openAddPlace()}
        />
      );
    }

    if (tab === 'visited') {
      return (
        <EmptyState
          icon="checkmark-circle-outline"
          title="No history yet"
          body="Tap Been here on a place and it joins the list of rooms you’ve actually stood in."
          actionLabel="Find a place"
          onAction={() => openAddPlace()}
        />
      );
    }

    return (
      <EmptyState
        icon="earth-outline"
        title="No countries on the board"
        body="Every place you mark as visited puts another pin on your map."
        actionLabel="Add a place"
        onAction={() => openAddPlace()}
      />
    );
  };

  const headerElevation = scrollY.interpolate({
    inputRange: [0, 24],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const resultCount = data.length;
  const countryLabel = search.country
    ? [countryFlag(search.country), countryName(search.country)].filter(Boolean).join(' ')
    : '';

  return (
    <Screen>
      <Animated.View style={[styles.chrome, { backgroundColor: t.bg, borderBottomColor: t.divider, borderBottomWidth: headerElevation }]}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[type.h1, { color: t.text }]}>Places</Text>
            <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>
              The rooms your moments happen in
            </Text>
          </View>
        </View>

        <PlaceSearchBar
          value={search.query}
          onChangeText={search.setQuery}
          loading={search.loading && search.active}
          placeholder="Search places"
          style={{ marginTop: 12 }}
        />

        <View style={{ marginTop: 12 }}>
          <PlaceSegmented
            options={options}
            value={tab}
            onChange={changeTab}
            onDisabledPress={() => setNoticeOpen(true)}
          />
        </View>

        {noticeOpen && !location.supported && (
          <LocationNotice
            title="Turn on location to see what’s nearby"
            body="Nearby needs your device location. It isn’t available in this build."
            actionLabel="Settings"
            onAction={location.openSettings}
            onDismiss={() => setNoticeOpen(false)}
          />
        )}
      </Animated.View>

      {loading ? (
        <View style={{ paddingTop: 14 }}>
          {SKELETON_ROWS.map((i) => (isTrips ? <TripRowSkeleton key={i} /> : <PlaceRowSkeleton key={i} />))}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <View style={styles.listHead}>
              {!!countryLabel && (
                <Chip
                  icon="earth-outline"
                  label={countryLabel}
                  tone="accent"
                  onDismiss={() => search.setCountry('')}
                  dismissLabel="Clear country filter"
                />
              )}
              {searching && resultCount > 0 && (
                <Text style={[type.caption, { color: t.textMuted }]}>
                  {plural(resultCount, 'place', 'places')}
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={emptyState()}
          ListFooterComponent={
            resultCount > 0 && !searching && !isTrips ? (
              <Bounce
                onPress={() => openAddPlace()}
                haptic="light"
                scaleTo={0.99}
                accessibilityLabel="Add a place that is missing"
              >
                <View style={[styles.addRow, { borderColor: t.border }]}>
                  <Icon name="add-circle-outline" size={18} color={t.accent} />
                  <Text style={[type.label, { color: t.accent }]}>Somewhere missing? Add it</Text>
                </View>
              </Bounce>
            ) : null
          }
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 150, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={!!active.refreshing || (searching && search.loading && resultCount > 0)}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
              progressBackgroundColor={t.surface}
            />
          }
        />
      )}

      {/* Floating add — clears the tab bar, which is absolutely positioned.
          The absolute style sits on a wrapper, not on Bounce: Bounce forwards
          `style` to its inner Animated.View, so positioning it there would
          leave the Pressable in normal flow with the visible button drawn
          outside its bounds — where Android drops the touch entirely. */}
      <View style={[styles.fabSlot, { bottom: Math.max(insets.bottom, 8) + 78 }]}>
        <Bounce
          onPress={() => openAddPlace()}
          haptic="medium"
          style={[styles.fab, { backgroundColor: t.accent }, elevation(t, 3)]}
          accessibilityLabel="Add a place"
        >
          <Icon name="add" size={27} color={t.textOnAccent} />
        </Bounce>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chrome: { paddingTop: 2, paddingBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  listHead: { paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: radius.md,
    // Dashed borders need a full pixel on Android — a hairline renders solid.
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  fabSlot: { position: 'absolute', right: 18 },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
