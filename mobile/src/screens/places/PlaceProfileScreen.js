// src/screens/places/PlaceProfileScreen.js
// A single venue: who has been, what happened there, and the three things you
// can do about it (save it, say you've been, send it to someone).
//
// Route params: { id, place? }. The optional `place` is whatever row the caller
// already had, so the header paints instantly and GET /places/:id only fills in
// the parts a list row never carries (friends, top_stories, recent_stories).
//
// Server shape (server/routes/places.js → GET /places/:id):
//   { ...place, saved, visit_count, story_count,
//     friends: [{ id, name, avatar }],
//     top_stories:    [{ id, content, image_url, created_at, user_id, name,
//                        avatar, cheer_count }],
//     recent_stories: [{ id, content, image_url, created_at, user_id, name,
//                        avatar }] }

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Share,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import api, { ORIGIN } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Icon, Bounce, EmptyState, FadeIn, useToast } from '../../components/ui';
import { navigateByName } from '../../lib/nav';
import {
  PlaceCover,
  FriendsRail,
  PlaceStoryCard,
  SectionHeader,
  QuietCard,
  Chip,
  PlaceProfileSkeleton,
} from '../../components/places';
import {
  categoryIcon,
  countryName,
  hasCoords,
  normaliseCountry,
  openDirections,
  plural,
} from '../../components/places/placeUtils';
import usePlaceUgcActions from './usePlaceUgcActions';
import { track } from '../../lib/track';
import { tap, pop } from '../../ui/haptics';

const COVER_HEIGHT = 230;

// Bounce forwards `style` to its inner Animated.View rather than to the
// Pressable it renders, so sizing (flex, absolute position) has to live on a
// wrapper — otherwise the Pressable shrinks to its content and the three
// actions stop sharing the row evenly.
function ActionButton({ icon, label, active, onPress, disabled, accessibilityLabel }) {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Bounce
        onPress={onPress}
        haptic={null}
        scaleTo={0.95}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel || label}
      >
        <View
          style={[
            styles.action,
            {
              backgroundColor: active ? t.accentSoft : t.surface,
              borderColor: active ? t.accentBorder : t.border,
            },
          ]}
        >
          <Icon name={icon} size={19} color={active ? t.accent : t.textSecondary} />
          <Text
            style={[type.caption, { color: active ? t.accentText : t.textSecondary, fontWeight: '700' }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </Bounce>
    </View>
  );
}

function Stat({ value, label }) {
  const { t } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[type.h3, { color: t.text, fontVariant: ['tabular-nums'] }]}>{Number(value) || 0}</Text>
      <Text style={[type.caption, { color: t.textMuted, marginTop: 1 }]}>{label}</Text>
    </View>
  );
}

function FloatingButton({ icon, onPress, accessibilityLabel, style }) {
  const { t } = useTheme();
  return (
    <View style={style}>
      <Bounce onPress={onPress} haptic="light" hitSlop={8} accessibilityLabel={accessibilityLabel}>
        <View style={[styles.floating, { backgroundColor: t.scrim }]}>
          <Icon name={icon} size={20} color="#FFFFFF" />
        </View>
      </Bounce>
    </View>
  );
}

export default function PlaceProfileScreen({ navigation, route }) {
  const { t, elevation } = useTheme();
  const { user: me } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const seed = route?.params?.place || null;
  const placeId = route?.params?.id ?? seed?.id ?? null;

  const [place, setPlace] = useState(seed);
  const [friends, setFriends] = useState([]);
  const [topStories, setTopStories] = useState([]);
  const [recentStories, setRecentStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [justVisited, setJustVisited] = useState(false);

  const savingRef = useRef(false);
  const visitingRef = useRef(false);
  const alive = useRef(true);

  // useToast() hands back a fresh { show } on every ToastProvider render, so it
  // must never sit in an effect's dependency list — showing a toast would
  // re-run the effect that showed it.
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (placeId == null) {
      setError('That place could not be found.');
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/places/${placeId}`);
      if (!alive.current) return;
      const data = res.data || {};
      setPlace((prev) => ({ ...(prev || {}), ...data }));
      setFriends(Array.isArray(data.friends) ? data.friends.filter(Boolean) : []);
      setTopStories(Array.isArray(data.top_stories) ? data.top_stories.filter(Boolean) : []);
      setRecentStories(Array.isArray(data.recent_stories) ? data.recent_stories.filter(Boolean) : []);
      setError(null);
    } catch (e) {
      if (!alive.current) return;
      setError(e?.safeMessage || 'Could not load that place.');
      throw e;
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    track('place_profile_open', { id: placeId });
    load().catch((e) => {
      // With a seed row we still render a usable page, so the failure has to be
      // said out loud rather than silently leaving half a profile on screen.
      if (seed) toastRef.current?.show(e?.safeMessage || 'Could not load that place.', 'error');
    });
  }, [load, placeId, seed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      toast?.show(e?.safeMessage || 'Could not refresh.', 'error');
    } finally {
      if (alive.current) setRefreshing(false);
    }
  }, [load, toast]);

  // ── UGC actions ───────────────────────────────────────────────────────────
  const dropStory = useCallback((story) => {
    setTopStories((list) => list.filter((s) => String(s.id) !== String(story?.id)));
    setRecentStories((list) => list.filter((s) => String(s.id) !== String(story?.id)));
  }, []);

  const dropAuthor = useCallback((authorId) => {
    const gone = (s) => String(s?.user_id) !== String(authorId);
    setTopStories((list) => list.filter(gone));
    setRecentStories((list) => list.filter(gone));
    setFriends((list) => list.filter((f) => String(f?.id) !== String(authorId)));
  }, []);

  const { openStoryMenu, openPlaceMenu } = usePlaceUgcActions({
    onStoryRemoved: dropStory,
    onAuthorBlocked: dropAuthor,
  });

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggleSave = useCallback(async () => {
    if (savingRef.current || placeId == null) return;
    savingRef.current = true;
    const next = !place?.saved;
    tap();
    setPlace((p) => ({ ...(p || {}), saved: next })); // optimistic

    try {
      const res = await api.post(`/places/${placeId}/save`);
      const saved = typeof res.data?.saved === 'boolean' ? res.data.saved : next;
      if (alive.current) setPlace((p) => ({ ...(p || {}), saved }));
      toast?.show(saved ? 'Saved to your list.' : 'Removed from your list.', 'success');
      track('place_save', { id: placeId, saved });
    } catch (e) {
      if (alive.current) setPlace((p) => ({ ...(p || {}), saved: !next }));
      toast?.show(e?.safeMessage || 'Could not update that.', 'error');
    } finally {
      savingRef.current = false;
    }
  }, [place?.saved, placeId, toast]);

  const markVisited = useCallback(async () => {
    if (visitingRef.current || placeId == null) return;
    visitingRef.current = true;
    try {
      await api.post(`/places/${placeId}/visit`);
      pop();
      if (alive.current) {
        setJustVisited(true);
        setPlace((p) => ({ ...(p || {}), visit_count: (Number(p?.visit_count) || 0) + 1 }));
      }
      toast?.show('Marked as visited', 'success');
      track('place_visit', { id: placeId });
    } catch (e) {
      toast?.show(e?.safeMessage || 'Could not record that visit.', 'error');
    } finally {
      visitingRef.current = false;
    }
  }, [placeId, toast]);

  const sharePlace = useCallback(async () => {
    if (placeId == null) return;
    const url = `${ORIGIN}/places/${placeId}`;
    const name = place?.name || 'This place';
    try {
      // iOS uses `url`; Android ignores it, so the link rides in `message` too.
      await Share.share({
        title: name,
        message: `${name} on DrinkedInn\n${url}`,
        url,
      });
      track('place_share', { id: placeId });
    } catch {
      /* the user dismissed the share sheet */
    }
  }, [placeId, place?.name]);

  const directions = useCallback(async () => {
    const ok = await openDirections(place);
    if (!ok) toast?.show('Could not open maps.', 'error');
    else track('place_directions', { id: placeId });
  }, [place, placeId, toast]);

  const openStory = useCallback(
    (story) => {
      if (!story?.id) return;
      // PostDetailScreen reads route.params.post and hydrates only when the
      // object has no `content`, so passing the whole row paints immediately.
      // Pass ONLY the id. The place-profile row has no cheer_count /
      // user_cheered / comment_count, and PostDetailScreen skips its own
      // hydration whenever the seed object already has `content` — so the
      // full row painted a cheered post as un-cheered, and tapping the
      // button removed the existing cheer.
      navigation.navigate('PostDetail', { post: { id: story.id } });
    },
    [navigation]
  );

  // A friend row is keyed by `id`; a story row's `id` is the POST id and its
  // author is `user_id`. Keeping these apart avoids opening a profile by post id.
  const openUser = useCallback(
    (userId) => {
      if (userId == null) return;
      if (String(userId) === String(me?.id)) navigateByName(navigation, 'Profile');
      else navigation.navigate('User', { userId });
    },
    [navigation, me?.id]
  );
  const openFriend = useCallback((friend) => openUser(friend?.id), [openUser]);
  const openStoryAuthor = useCallback((story) => openUser(story?.user_id), [openUser]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const country = normaliseCountry(place?.country);
  const where = [place?.city, countryName(country)].filter(Boolean).join(', ');
  const tileWidth = useMemo(() => Math.floor((width - 32 - 12) / 2), [width]);
  const showSkeleton = loading && !place;
  const fatal = !!error && !place;

  if (fatal) {
    return (
      <Screen edges={['top']}>
        <View style={styles.plainHeader}>
          <Bounce
            onPress={() => navigation.goBack()}
            haptic="light"
            hitSlop={12}
            accessibilityLabel="Go back"
            style={styles.plainBack}
          >
            <Icon name="chevron-back" size={26} color={t.text} />
          </Bounce>
        </View>
        <EmptyState
          icon="cloud-offline-outline"
          title={error === 'Not found.' ? 'This place is gone' : "Can't reach the bar"}
          body={
            error === 'Not found.'
              ? 'It may have been removed. Try searching for it again.'
              : error
          }
          actionLabel="Try again"
          onAction={onRefresh}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
            colors={[t.accent]}
            progressBackgroundColor={t.surface}
          />
        }
      >
        {showSkeleton ? (
          <PlaceProfileSkeleton />
        ) : (
          <>
            {/* Cover */}
            <View>
              <PlaceCover place={place} height={COVER_HEIGHT} rounded={0} />
              {/* Scrim under the floating controls so they stay legible on any
                  cover image. */}
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
                style={styles.coverScrim}
              />
            </View>

            {/* Identity */}
            <View style={styles.identity}>
              <Text style={[type.h1, { color: t.text }]}>
                {String(place?.name || '').trim() || 'Unnamed place'}
              </Text>

              <View style={styles.metaRow}>
                {!!String(place?.category || '').trim() && (
                  <Chip icon={categoryIcon(place.category)} label={place.category} />
                )}
                {!!where && (
                  <View style={styles.whereRow}>
                    <Icon name="location-outline" size={13} color={t.textMuted} />
                    <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={1}>
                      {where}
                    </Text>
                  </View>
                )}
              </View>

              <View style={[styles.stats, { backgroundColor: t.surfaceAlt }]}>
                <Stat value={place?.visit_count} label="visits" />
                <View style={[styles.rule, { backgroundColor: t.border }]} />
                <Stat value={place?.story_count} label="stories" />
                <View style={[styles.rule, { backgroundColor: t.border }]} />
                <Stat value={friends.length} label="you know" />
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <ActionButton
                  icon={place?.saved ? 'bookmark' : 'bookmark-outline'}
                  label={place?.saved ? 'Saved' : 'Save'}
                  active={!!place?.saved}
                  onPress={toggleSave}
                  accessibilityLabel={place?.saved ? 'Remove from saved places' : 'Save this place'}
                />
                <ActionButton
                  icon={justVisited ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  label={justVisited ? 'Visited' : 'Been here'}
                  active={justVisited}
                  onPress={markVisited}
                  accessibilityLabel="Mark this place as visited"
                />
                <ActionButton
                  icon="share-outline"
                  label="Share"
                  onPress={sharePlace}
                  accessibilityLabel="Share this place"
                />
              </View>

              {hasCoords(place) && (
                <Bounce
                  onPress={directions}
                  haptic="light"
                  scaleTo={0.98}
                  accessibilityLabel="Open directions in maps"
                >
                  <View
                    style={[
                      styles.directions,
                      { backgroundColor: t.surface, borderColor: t.border },
                      elevation(t, 1),
                    ]}
                  >
                    <Icon name="navigate-outline" size={18} color={t.accent} />
                    <Text style={[type.bodyStrong, { color: t.text, flex: 1 }]}>Directions</Text>
                    <Icon name="open-outline" size={16} color={t.textMuted} />
                  </View>
                </Bounce>
              )}
            </View>

            {/* People first */}
            <SectionHeader
              title="Friends who’ve been"
              caption={
                friends.length
                  ? plural(friends.length, 'person you know', 'people you know')
                  : undefined
              }
            />
            {friends.length > 0 ? (
              <FriendsRail friends={friends} onPress={openFriend} />
            ) : (
              <QuietCard
                icon="people-outline"
                title="No one you know yet"
                body="When someone you’re connected to marks this place, they’ll show up here."
              />
            )}

            {/* Moments */}
            <SectionHeader title="Top stories" />
            {topStories.length > 0 ? (
              <View style={styles.grid}>
                {topStories.map((story, i) => (
                  <FadeIn key={String(story.id)} index={i}>
                    <PlaceStoryCard
                      story={story}
                      variant="grid"
                      width={tileWidth}
                      onOpen={openStory}
                      onMenu={openStoryMenu}
                      onProfile={openStoryAuthor}
                    />
                  </FadeIn>
                ))}
              </View>
            ) : (
              <QuietCard
                icon="book-outline"
                title="No stories from here yet"
                body="Share a moment from this place and it’ll be the first one."
              />
            )}

            <SectionHeader title="Recent stories" />
            {recentStories.length > 0 ? (
              recentStories.map((story, i) => (
                <FadeIn key={String(story.id)} index={i}>
                  <PlaceStoryCard
                    story={story}
                    variant="list"
                    onOpen={openStory}
                    onMenu={openStoryMenu}
                    onProfile={openStoryAuthor}
                  />
                </FadeIn>
              ))
            ) : (
              <QuietCard
                icon="time-outline"
                title="Nothing recent"
                body="The next moment shared here lands at the top of this list."
              />
            )}

            {/* Not wired yet — no server route returns these for a place. */}
            <SectionHeader title="Ratings" />
            <QuietCard
              icon="star-outline"
              title="Ratings for this place"
              body="What people thought, once ratings can be pinned to a venue."
              pill="Coming soon"
            />

            <SectionHeader title="Events here" />
            <QuietCard
              icon="calendar-outline"
              title="Gatherings at this place"
              body="Events you can join at this address will show up here."
              pill="Coming soon"
            />
          </>
        )}
      </ScrollView>

      {/* Floating chrome — outside the ScrollView so it never scrolls away. */}
      <FloatingButton
        icon="chevron-back"
        onPress={() => navigation.goBack()}
        accessibilityLabel="Go back"
        style={styles.backSlot}
      />
      {!!place?.id && (
        <FloatingButton
          icon="ellipsis-horizontal"
          onPress={() => openPlaceMenu(place)}
          accessibilityLabel="Place options"
          style={styles.menuSlot}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  coverScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 64 },
  identity: { paddingHorizontal: 16, paddingTop: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 9 },
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 13,
    borderRadius: radius.md,
  },
  rule: { width: StyleSheet.hairlineWidth, height: 26 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  directions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 14, paddingHorizontal: 16 },
  floating: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backSlot: { position: 'absolute', left: 14, top: 8 },
  menuSlot: { position: 'absolute', right: 14, top: 8 },
  plainHeader: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6, minHeight: 40, justifyContent: 'center' },
  plainBack: { alignSelf: 'flex-start', marginLeft: -8, padding: 4 },
});
