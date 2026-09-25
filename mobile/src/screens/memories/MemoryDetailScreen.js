// src/screens/memories/MemoryDetailScreen.js
// A memory, played back like a story.
//
// route.params: { key, title }
//   key   — the server's bucket key, e.g. "2024-05|Lisbon". It contains a pipe,
//           so it is percent-encoded into the path (see memoryLib).
//   title — what the card said, used for the header until the posts land.
//
// Interaction model, matched to the app's existing story viewer:
//   • Tap right half → next      Tap left half → previous
//   • Touch and hold  → pause the progress bar and the auto-advance
//   • Close (X) top-right, and running off the end closes too
//   • "See full post" drops into the real PostDetail with comments and cheers
//
// These are the viewer's own moments, so the options (…) button is hidden when
// the post belongs to them — which, given the server contract, is always. The
// branch stays because the viewer renders whatever the endpoint returns.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { mediaUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { type, radius } from '../../theme/tokens';
import { Avatar, Icon, useToast } from '../../components/ui';
import { tap as tapHaptic } from '../../ui/haptics';
import track from '../../lib/track';
import useMemoryPostActions from './useMemoryPostActions';
import {
  MEMORY_ICON, gradientFor, longDate, memoryPostsPath, normalizePosts, placeLine,
} from '../../components/memories/memoryLib';

const SLIDE_MS = 5200;

// A prolific month can return dozens of posts, and a row of 40 progress bars is
// a row of hairlines nobody can read. Play the first 20 and leave the rest to
// the profile grid — same call Photos and Instagram make.
const MAX_SLIDES = 20;

export default function MemoryDetailScreen({ navigation, route }) {
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();

  const memoryKey = route?.params?.key ?? null;
  const memoryTitle = route?.params?.title || 'A memory';

  const [posts, setPosts] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef(null);
  const paused = useRef(false);
  const postsRef = useRef([]);
  const indexRef = useRef(0);
  const advanceRef = useRef(() => {});
  const startTimerRef = useRef(() => {});

  useEffect(() => { postsRef.current = posts; }, [posts]);
  useEffect(() => { indexRef.current = index; }, [index]);

  const close = useCallback(() => { navigation.goBack(); }, [navigation]);

  // The toast context value is a fresh object every time a toast appears, so it
  // must NOT be a dependency of load() — the fetch effect keys off load(), and
  // an error toast would otherwise retrigger the fetch, which errors, which
  // toasts, forever. Hold it behind a ref instead.
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  // ── data ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!memoryKey) { setLoading(false); setFailed(true); return; }
    setFailed(false);
    try {
      const res = await api.get(memoryPostsPath(memoryKey));
      const list = normalizePosts(res?.data).slice(0, MAX_SLIDES);
      setPosts(list);
      postsRef.current = list;
      setIndex(0);
      indexRef.current = 0;
      track('memory_viewed', { key: String(memoryKey), count: list.length });
    } catch (e) {
      setPosts([]);
      postsRef.current = [];
      setFailed(true);
      toastRef.current?.show(e?.safeMessage || 'Could not open that memory.', 'error');
    } finally {
      setLoading(false);
    }
  }, [memoryKey]);

  useEffect(() => { load(); }, [load]);

  // ── progress driver ───────────────────────────────────────────────────────
  // Width is animated as a percentage, so this cannot use the native driver.
  const startTimer = useCallback((from) => {
    if (anim.current) { anim.current.stop(); anim.current = null; }
    const start = typeof from === 'number' && from > 0 && from < 1 ? from : 0;
    progress.setValue(start);
    anim.current = Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(400, SLIDE_MS * (1 - start)),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (finished && !paused.current) advanceRef.current(1);
    });
  }, [progress]);

  const advance = useCallback((dir) => {
    const list = postsRef.current;
    if (!list.length) return;
    const next = indexRef.current + dir;
    if (next < 0) { startTimerRef.current(0); return; }
    if (next >= list.length) { close(); return; }
    indexRef.current = next;
    setIndex(next);
  }, [close]);

  const pause = useCallback(() => {
    if (paused.current) return;
    paused.current = true;
    if (anim.current) anim.current.stop();
  }, []);

  const resume = useCallback(() => {
    if (!paused.current) return;
    paused.current = false;
    progress.stopAnimation((v) => startTimerRef.current(v));
  }, [progress]);

  // Keep the refs pointed at the latest closures — the tap zones are created
  // once and must always reach the current advance/startTimer.
  useEffect(() => { advanceRef.current = advance; }, [advance]);
  useEffect(() => { startTimerRef.current = startTimer; }, [startTimer]);

  // Restart the bar on every slide, and stop it whenever the screen loses focus
  // (e.g. while "See full post" is on top) so a memory never plays on unseen.
  useEffect(() => {
    if (loading || !posts.length || !focused) return undefined;
    paused.current = false;
    startTimer(0);
    return () => { if (anim.current) { anim.current.stop(); anim.current = null; } };
  }, [loading, index, posts.length, focused, startTimer]);

  // ── options ───────────────────────────────────────────────────────────────
  const { openMenu, isMine } = useMemoryPostActions({
    onRemoved: () => { close(); },
  });

  const post = posts[index] || null;
  // Defensive: if we can't establish who the viewer is, treat the moment as
  // theirs and hide the options rather than offer to report themselves.
  const mine = !post || user?.id == null || isMine(post);

  const openOptions = useCallback(async () => {
    const current = postsRef.current[indexRef.current];
    if (!current) return;
    pause();
    try {
      await openMenu(current);
    } finally {
      resume();
    }
  }, [openMenu, pause, resume]);

  const openFullPost = useCallback(() => {
    const current = postsRef.current[indexRef.current];
    if (!current?.id) return;
    pause();
    track('memory_post_opened', { post_id: current.id });
    // PostDetail hydrates from /posts/:id when it is handed a bare id, which
    // gives it the author, cheer state and comment count this endpoint omits.
    navigation.navigate('PostDetail', { post: { id: current.id } });
  }, [navigation, pause]);

  // ── derived ───────────────────────────────────────────────────────────────
  const image = mediaUrl(post?.image_url);
  const [g1, g2] = useMemo(
    () => gradientFor(post?.id ?? memoryKey),
    [post?.id, memoryKey],
  );

  const authorName = post?.name || (mine ? user?.name : null) || 'A member';
  const authorAvatar = post?.avatar || (mine ? user?.avatar : null);
  const when = longDate(post?.created_at);
  const place = placeLine(post);
  const content = typeof post?.content === 'string' ? post.content.trim() : '';

  // ── states ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.root, styles.center, { paddingHorizontal: 32 }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.fallbackGlyph}>
          <Icon name={MEMORY_ICON} size={26} color="#FFFFFF" />
        </View>
        <Text style={[type.h2, styles.fallbackTitle]}>
          {failed ? 'That memory won’t open' : 'This memory has moved on'}
        </Text>
        <Text style={[type.body, styles.fallbackBody]}>
          {failed
            ? 'Something went wrong on our side. Give it another go.'
            : 'The moments behind it are no longer here.'}
        </Text>
        {/* Deliberately not the themed <Button>: this screen is always black,
            and a light-mode secondary button would be dark text on dark. */}
        <View style={styles.fallbackActions}>
          {/* No key means the screen was pushed without params — retrying
              would fail identically, so only offer it when there's a key. */}
          {failed && !!memoryKey && (
            <Pressable
              onPress={() => { setLoading(true); load(); }}
              style={({ pressed }) => [
                styles.fallbackBtn,
                { backgroundColor: pressed ? '#E9E4D8' : '#FFFFFF' },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Try loading this memory again"
            >
              <Icon name="refresh-outline" size={17} color="#111111" />
              <Text style={[styles.fallbackBtnLabel, { color: '#111111' }]}>Try again</Text>
            </Pressable>
          )}
          <Pressable
            onPress={close}
            style={({ pressed }) => [
              styles.fallbackBtn,
              styles.fallbackBtnGhost,
              { backgroundColor: pressed ? 'rgba(255,255,255,0.18)' : 'transparent' },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={[styles.fallbackBtnLabel, { color: '#FFFFFF' }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Backdrop */}
      {image ? (
        <Image
          source={{ uri: image }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={240}
          cachePolicy="memory-disk"
          accessible={false}
        />
      ) : (
        <LinearGradient
          colors={[g1, g2]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Tap zones sit underneath everything interactive. */}
      <View style={styles.tapRow} pointerEvents="box-none">
        <Pressable
          style={styles.tapZone}
          onPress={() => { tapHaptic(); advance(-1); }}
          onLongPress={pause}
          onPressOut={resume}
          delayLongPress={220}
          accessibilityRole="button"
          accessibilityLabel="Previous moment"
        />
        <Pressable
          style={styles.tapZone}
          onPress={() => { tapHaptic(); advance(1); }}
          onLongPress={pause}
          onPressOut={resume}
          delayLongPress={220}
          accessibilityRole="button"
          accessibilityLabel="Next moment"
        />
      </View>

      {/* Text-only moments get the words, big and centred. Clamped rather than
          scrollable — a scroll view here would eat the tap zones, and the whole
          thing is one tap away in "See full post". */}
      {!image && !!content && (
        <View style={styles.proseWrap} pointerEvents="none">
          <Text style={styles.prose} numberOfLines={9}>{content}</Text>
        </View>
      )}

      {/* Top scrim: progress + who and when */}
      <LinearGradient
        colors={['rgba(0,0,0,0.62)', 'transparent']}
        style={[styles.topScrim, { paddingTop: insets.top + 4 }]}
        pointerEvents="box-none"
      >
        <View style={styles.progressRow}>
          {posts.map((p, i) => (
            <View key={p.id != null ? String(p.id) : `slot-${i}`} style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width:
                      i < index ? '100%'
                        : i > index ? '0%'
                          : progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.headerRow}>
          <Avatar uri={authorAvatar} name={authorName} size={34} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.name} numberOfLines={1}>{authorName}</Text>
            {!!when && <Text style={styles.when} numberOfLines={1}>{when}</Text>}
          </View>
          {!mine && (
            <Pressable
              onPress={openOptions}
              hitSlop={12}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Moment options"
            >
              <Icon name="ellipsis-horizontal" size={20} color="#FFFFFF" />
            </Pressable>
          )}
          <Pressable
            onPress={close}
            hitSlop={12}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Close this memory"
          >
            <Icon name="close" size={23} color="#FFFFFF" />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Bottom scrim: which memory, the words (when there's a photo), the way in */}
      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.82)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View pointerEvents="none">
          <Text style={[type.overline, styles.memoryTitle]} numberOfLines={1}>
            {String(memoryTitle).toUpperCase()}
          </Text>
          {!!image && !!content && (
            <Text style={styles.caption} numberOfLines={4}>{content}</Text>
          )}
          {!!place && (
            <View style={styles.placeRow}>
              <Icon name="location-outline" size={13} color="rgba(255,255,255,0.78)" />
              <Text style={styles.place} numberOfLines={1}>{place}</Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={openFullPost}
          style={({ pressed }) => [
            styles.fullPost,
            { backgroundColor: pressed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.16)' },
          ]}
          accessibilityRole="button"
          accessibilityLabel="See the full post"
        >
          <Text style={styles.fullPostLabel}>See full post</Text>
          <Icon name="chevron-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },

  topScrim: {
    position: 'absolute', left: 0, right: 0, top: 0,
    paddingHorizontal: 12, paddingBottom: 14, zIndex: 3,
  },
  progressRow: { flexDirection: 'row', gap: 4, marginTop: 6, marginBottom: 10 },
  progressTrack: {
    flex: 1, height: 2.5, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  when: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '500', marginTop: 1 },
  headerBtn: { padding: 8 },

  proseWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 30, zIndex: 1,
  },
  prose: {
    color: '#FFFFFF', fontSize: 23, fontWeight: '600',
    lineHeight: 33, letterSpacing: -0.3, textAlign: 'center',
  },

  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 56, zIndex: 3,
  },
  memoryTitle: { color: 'rgba(255,255,255,0.72)' },
  caption: { color: '#FFFFFF', fontSize: 15, fontWeight: '500', lineHeight: 22, marginTop: 8 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  place: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '500', flexShrink: 1 },

  fullPost: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingLeft: 14, paddingRight: 10, paddingVertical: 9,
    borderRadius: radius.pill, marginTop: 14,
  },
  fullPostLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  fallbackGlyph: {
    width: 62, height: 62, borderRadius: radius.xl,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 18,
  },
  fallbackTitle: { color: '#FFFFFF', textAlign: 'center' },
  fallbackBody: {
    color: 'rgba(255,255,255,0.72)', textAlign: 'center',
    marginTop: 8, lineHeight: 22,
  },
  fallbackActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  fallbackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingHorizontal: 20, paddingVertical: 13, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  fallbackBtnGhost: { borderColor: 'rgba(255,255,255,0.4)' },
  fallbackBtnLabel: { fontSize: 15, fontWeight: '600' },

  tapRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 2 },
  tapZone: { flex: 1 },
});
