// src/screens/explore/ExploreScreen.js — Explore (second tab).
//
// Editorial when the search box is empty, a search screen the moment it isn't.
// The two states share one list so the keyboard, scroll position and pull-to-
// refresh behave like a single screen rather than two stacked ones.
//
// Section order is deliberate and is the brand triad in order — people the
// viewer already knows, then moments, then the rooms those moments happened
// in. Any section with nothing in it hides rather than showing a stub.
//
// Everything here reads; nothing is written except a cheer, a connect, a
// report or a block, each of which the user initiates.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, Pressable,
  ActivityIndicator, RefreshControl, Keyboard,
} from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Icon, Bounce, EmptyState, FadeIn, useToast } from '../../components/ui';
import PostCard from '../../components/PostCard';
import Segmented from '../../components/home/Segmented';
import TonightRail from '../../components/events/TonightRail';
import ChallengesRail from '../../components/challenges/ChallengesRail';
import Rail from '../../components/explore/Rail';
import SectionHeader from '../../components/explore/SectionHeader';
import StoryRailCard, { STORY_CARD_WIDTH } from '../../components/explore/StoryRailCard';
import PlaceRailCard, { PLACE_CARD_WIDTH } from '../../components/explore/PlaceRailCard';
import PersonRowWithActions from '../../components/explore/PersonRowWithActions';
import InnkeeperCard from '../../components/explore/InnkeeperCard';
import LinkRow from '../../components/explore/LinkRow';
import ExploreSkeleton from '../../components/explore/ExploreSkeleton';
import useExploreData from './useExploreData';
import useExploreSearch from './useExploreSearch';
import useExplorePostActions from './useExplorePostActions';
import useExploreUserActions from './useExploreUserActions';
import { resolveRouteName } from './exploreLib';
import { tap } from '../../ui/haptics';
import track from '../../lib/track';

const TABS = [
  { key: 'people', label: 'People' },
  { key: 'pours', label: 'Pours' },
];

// Routes Explore links out to. Several are owned by other modules, so each is
// a candidate list: the first one actually registered wins, and if none is
// registered the affordance quietly does nothing instead of logging an
// unhandled navigation action.
const ROUTES = {
  profile: ['User'],
  self: ['Account'],
  post: ['PostDetail'],
  place: ['Place', 'PlaceDetail', 'PlaceProfile', 'Trips'],
  groups: ['Groups'],
  events: ['Events'],
  challenges: ['Challenges'],
  challenge: ['ChallengeLeaderboard'],
  innkeeper: ['AskInnkeeper'],
  compose: ['Compose'],
};

export default function ExploreScreen({ navigation }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [q, setQ] = useState('');
  const [tab, setTab] = useState('people');

  const inputRef = useRef(null);
  const listRef = useRef(null);
  useScrollToTop(listRef);

  const {
    loading, refreshing, error, isEmpty,
    cityLabel, cityPosts, weekendPosts, trendingPlaces, nearbyPlaces,
    followingPosts, people,
    refresh, retry, removeAuthor, removePerson, refreshPeople,
  } = useExploreData();

  const { results, searching, dropAuthor } = useExploreSearch(q);

  // A delete only takes that one moment away. A block has to take the member
  // with it — /users/discover does not filter blocked accounts server-side, so
  // without removePerson they'd still be sitting in the people rail.
  const handleRemoved = useCallback((post, action) => {
    removeAuthor(post);
    dropAuthor(post);
    if (action === 'block' && post?.user_id != null) removePerson(post.user_id);
  }, [removeAuthor, dropAuthor, removePerson]);

  // Blocking from a person row has to clear the rails and the search results
  // together.
  const handleBlockedPerson = useCallback((person) => {
    if (!person?.id) return;
    removePerson(person.id);
    dropAuthor({ id: null, user_id: person.id });
  }, [removePerson, dropAuthor]);

  const { openMenu: openPostMenu } = useExplorePostActions({ onRemoved: handleRemoved });
  const { openMenu: openPersonMenu } = useExploreUserActions({ onBlocked: handleBlockedPerson });

  useEffect(() => { track('explore_viewed'); }, []);

  // The moments call is the only one that can fail loudly. Surface it once per
  // distinct failure — the sections that can still render, still render.
  const lastError = useRef(null);
  useEffect(() => {
    if (!error) { lastError.current = null; return; }
    if (error === lastError.current) return;
    lastError.current = error;
    toastRef.current?.show(error, 'error');
  }, [error]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const go = useCallback((candidates, params, section) => {
    const name = resolveRouteName(navigation, candidates);
    if (!name) return;
    if (section) track('explore_section_tap', { section });
    navigation.navigate(name, params);
  }, [navigation]);

  const openProfile = useCallback((id) => {
    if (id == null) return;
    if (id === user?.id) return go(ROUTES.self);
    // Both keys are sent: the profile screen in this app reads `userId`, and
    // the newer route contract names it `id`.
    go(ROUTES.profile, { userId: id, id });
  }, [go, user?.id]);

  const openPost = useCallback((post) => {
    if (!post?.id) return;
    go(ROUTES.post, { post, id: post.id });
  }, [go]);

  const openPlace = useCallback((place) => {
    if (!place?.id) return;
    track('explore_place_opened');
    go(ROUTES.place, { id: place.id, place });
  }, [go]);

  // ── Search ────────────────────────────────────────────────────────────────

  const term = q.trim();
  const isSearch = !!term;

  const clearSearch = useCallback(() => {
    tap();
    setQ('');
    inputRef.current?.focus();
  }, []);

  // Crossing between editorial and results is a change of screen as far as the
  // reader is concerned — start it at the top rather than halfway down.
  const wasSearch = useRef(isSearch);
  useEffect(() => {
    if (wasSearch.current === isSearch) return;
    wasSearch.current = isSearch;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [isSearch]);

  const searchRows = useMemo(() => {
    if (!isSearch) return [];
    return (tab === 'people' ? results?.users : results?.posts) || [];
  }, [isSearch, tab, results]);

  // ── Editorial sections ────────────────────────────────────────────────────

  const sections = useMemo(() => {
    if (loading) return [{ key: 'loading', kind: 'loading' }];

    const out = [];
    if (isEmpty && !error) out.push({ key: 'quiet', kind: 'quiet' });

    if (cityPosts.length) {
      out.push({
        key: 'city',
        kind: 'storyRail',
        title: `Popular in ${cityLabel}`,
        subtitle: 'What people around you are sharing',
        items: cityPosts,
      });
    }
    if (weekendPosts.length) {
      out.push({
        key: 'weekend',
        kind: 'storyRail',
        title: 'Weekend stories',
        subtitle: 'Fridays, Saturdays and slow Sundays',
        items: weekendPosts,
      });
    }
    if (trendingPlaces.length) {
      out.push({
        key: 'loving',
        kind: 'placeRail',
        title: 'Places people are loving',
        subtitle: 'Rooms worth walking into',
        items: trendingPlaces,
      });
    }
    if (nearbyPlaces.length) {
      out.push({
        key: 'nearby',
        kind: 'placeRail',
        title: 'Trending around you',
        subtitle: 'Close enough to get to this week',
        items: nearbyPlaces,
        showDistance: true,
      });
    }
    if (followingPosts.length) {
      out.push({
        key: 'following',
        kind: 'followingList',
        title: 'From people you follow',
        subtitle: 'The ones you keep up with',
        items: followingPosts,
      });
    }

    out.push({ key: 'innkeeper', kind: 'innkeeper' });
    out.push({ key: 'tonight', kind: 'tonight' });
    out.push({ key: 'challenges', kind: 'challenges' });

    if (people.length) {
      out.push({ key: 'people', kind: 'people', items: people });
    }
    out.push({ key: 'communities', kind: 'communities' });
    return out;
  }, [
    loading, isEmpty, error, cityLabel, cityPosts, weekendPosts,
    trendingPlaces, nearbyPlaces, followingPosts, people,
  ]);

  const renderSection = useCallback(({ item }) => {
    switch (item.kind) {
      case 'loading':
        return <ExploreSkeleton />;

      case 'quiet':
        return (
          <Bounce
            onPress={() => go(ROUTES.compose, undefined, 'compose')}
            haptic="medium"
            scaleTo={0.98}
            style={styles.quietWrap}
            accessibilityLabel="It's quiet in here. Share a moment."
          >
            <View style={[styles.quiet, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Icon name="sparkles-outline" size={20} color={t.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: t.text }]}>It's quiet in here</Text>
                <Text style={[type.caption, { color: t.textMuted, marginTop: 3, lineHeight: 17 }]}>
                  Share a moment and it'll be the first thing anyone finds.
                </Text>
              </View>
              <Icon name="chevron-forward" size={17} color={t.textMuted} />
            </View>
          </Bounce>
        );

      case 'storyRail':
        return (
          <Rail
            title={item.title}
            subtitle={item.subtitle}
            data={item.items}
            itemWidth={STORY_CARD_WIDTH}
            keyExtractor={(post) => String(post.id)}
            renderItem={({ item: post }) => (
              <StoryRailCard
                post={post}
                onOpen={openPost}
                onProfile={openProfile}
                onOptions={openPostMenu}
              />
            )}
          />
        );

      case 'placeRail':
        return (
          <Rail
            title={item.title}
            subtitle={item.subtitle}
            data={item.items}
            itemWidth={PLACE_CARD_WIDTH}
            keyExtractor={(place) => String(place.id)}
            renderItem={({ item: place }) => (
              <PlaceRailCard place={place} onOpen={openPlace} showDistance={item.showDistance} />
            )}
          />
        );

      case 'followingList':
        return (
          <View style={{ marginBottom: 8 }}>
            <SectionHeader title={item.title} subtitle={item.subtitle} />
            {item.items.map((post) => (
              <PostCard
                key={String(post.id)}
                post={post}
                onOpen={openPost}
                onProfile={openProfile}
                onReport={openPostMenu}
              />
            ))}
          </View>
        );

      case 'innkeeper':
        return <InnkeeperCard onPress={() => go(ROUTES.innkeeper, undefined, 'innkeeper')} />;

      case 'tonight':
        return <TonightRail onSeeAll={() => go(ROUTES.events, undefined, 'events')} />;

      case 'challenges':
        return (
          <ChallengesRail
            onOpen={(c) => go(ROUTES.challenge, { id: c?.id, title: c?.title }, 'challenge')}
            onSeeAll={() => go(ROUTES.challenges, undefined, 'challenges')}
          />
        );

      case 'people':
        return (
          <View style={{ marginBottom: 22 }}>
            <SectionHeader title="People to pour with" subtitle="Faces worth a first round" />
            {item.items.map((person) => (
              <PersonRowWithActions
                key={String(person.id)}
                person={person}
                onOpen={openProfile}
                onChanged={refreshPeople}
                onOptions={openPersonMenu}
                isSelf={person.id === user?.id}
              />
            ))}
          </View>
        );

      case 'communities':
        return (
          <LinkRow
            icon="people-circle-outline"
            label="Communities"
            description="Small rooms for the things you're into."
            onPress={() => go(ROUTES.groups, undefined, 'groups')}
          />
        );

      default:
        return null;
    }
  }, [t, openPost, openProfile, openPlace, openPostMenu, openPersonMenu, refreshPeople, go, user?.id]);

  const renderSearchRow = useCallback(({ item, index }) => (
    <FadeIn index={index}>
      {tab === 'pours' ? (
        <PostCard post={item} onOpen={openPost} onProfile={openProfile} onReport={openPostMenu} />
      ) : (
        <PersonRowWithActions
          person={item}
          onOpen={openProfile}
          onOptions={openPersonMenu}
          isSelf={item.id === user?.id}
        />
      )}
    </FadeIn>
  ), [tab, openPost, openProfile, openPostMenu, openPersonMenu, user?.id]);

  // The editorial list collapses to nothing only when the one load-bearing
  // call failed — otherwise there is always something to show.
  const editorialFailed = !loading && !!error && isEmpty;
  const data = isSearch ? searchRows : editorialFailed ? [] : sections;

  return (
    <Screen>
      <View style={styles.head}>
        <Text style={[type.h1, { color: t.text, marginBottom: 14 }]}>Explore</Text>
        <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Icon name="search-outline" size={18} color={t.textMuted} />
          <TextInput
            ref={inputRef}
            value={q}
            onChangeText={setQ}
            placeholder="Search people and pours"
            placeholderTextColor={t.textMuted}
            style={{ flex: 1, color: t.text, fontSize: 15.5, paddingVertical: 12 }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            accessibilityLabel="Search people and pours"
          />
          {searching ? (
            <ActivityIndicator size="small" color={t.textMuted} />
          ) : isSearch ? (
            <Pressable
              onPress={clearSearch}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Icon name="close-circle" size={17} color={t.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {isSearch && (
        <View style={{ marginBottom: 14 }}>
          <Segmented options={TABS} value={tab} onChange={setTab} />
        </View>
      )}

      <FlatList
        ref={listRef}
        data={data}
        extraData={tab}
        // The tab is part of the search key: a person and a pour can share a
        // numeric id, and a recycled cell would briefly render the wrong shape.
        keyExtractor={(item) => (isSearch ? `r-${tab}-${item.id}` : `s-${item.key}`)}
        renderItem={isSearch ? renderSearchRow : renderSection}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130, paddingTop: 2 }}
        refreshControl={
          isSearch ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={t.accent}
              colors={[t.accent]}
              progressBackgroundColor={t.surface}
            />
          )
        }
        ListEmptyComponent={
          isSearch ? (
            // Nothing until a response has actually landed, so the first
            // keystroke doesn't flash "no results" before the request fires.
            searching || results === null ? null : (
              <EmptyState
                icon="search-outline"
                title={`No ${tab === 'people' ? 'people' : 'pours'} for “${term}”`}
                body="Try another name, a place, or a tag."
              />
            )
          ) : (
            <EmptyState
              icon="cloud-offline-outline"
              title="Explore didn't load"
              body={error || 'Something went wrong on the way to the bar.'}
              actionLabel="Try again"
              onAction={retry}
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderRadius: radius.pill, borderWidth: 1.2, paddingHorizontal: 15,
  },
  quietWrap: { marginHorizontal: 16, marginBottom: 22 },
  quiet: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: radius.md, borderWidth: 1,
  },
});
