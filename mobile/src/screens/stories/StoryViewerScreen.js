// src/screens/stories/StoryViewerScreen.js
// Full-screen viewer for a 24-hour moment.
//
// Interaction model, matched to what people already know from other apps:
//   • Tap right half → next story    Tap left half → previous story
//   • Touch and hold        → pause the progress bar and the auto-advance
//   • Swipe down (or drag)  → dismiss
//   • Options (…) on others → Report, or Block the poster (App Store 1.2 / Play UGC)
//
// The viewer fetches its own list from GET /stories and plays every user's
// stories in chronological order starting from route.params.userId, so
// finishing one member rolls straight into the next like a natural round of
// pours. It marks each story as seen locally the moment it appears — the
// server has no read-receipt endpoint, so the "unseen" ring is a client
// concern only. A 404 on any per-story operation must never reveal that a
// block exists on the other side.

import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, PanResponder, Alert,
  ActivityIndicator, StatusBar, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { mediaUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Avatar, Icon, useToast } from '../../components/ui';
import { groupStoriesByUser, timeAgoShort } from '../../components/stories/groupStories';
import { markSeen } from '../../components/stories/seenStore';
import { tap as tapHaptic } from '../../ui/haptics';
import track from '../../lib/track';

const STORY_MS = 5000;

// A palette of warm gradients used when a story has no image (drink-only).
// Each pair is (top, bottom) chosen to feel like glassware under bar light.
const GRADIENTS = [
  ['#3B1F0E', '#8E4A1E'],
  ['#1F2A44', '#5B3F86'],
  ['#3A1A2A', '#B24E68'],
  ['#1E2B1F', '#4A6D3C'],
  ['#241826', '#7E4E9B'],
];

export default function StoryViewerScreen({ navigation, route }) {
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const targetUserId = route.params?.userId;
  const startIndex = route.params?.index;

  const [groups, setGroups] = useState([]);
  const [groupIndex, setGroupIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gone, setGone] = useState(false); // dismissed via swipe-down

  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef(null);
  const paused = useRef(false);
  const dragY = useRef(new Animated.Value(0)).current;

  // ---- data load ----
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/stories');
        if (!alive) return;
        const list = Array.isArray(res.data) ? res.data : [];
        const g = groupStoriesByUser(list, { currentUserId: user?.id });
        if (!g.length) {
          toast?.show("There's nothing to watch just yet.", 'info');
          navigation.goBack();
          return;
        }
        setGroups(g);
        const startG = Math.max(
          0,
          g.findIndex((x) => String(x.userId) === String(targetUserId)),
        );
        setGroupIndex(startG === -1 ? 0 : startG);
        setStoryIndex(Number.isInteger(startIndex) ? Math.max(0, startIndex) : 0);
      } catch (e) {
        toast?.show(e.safeMessage || 'Could not open moments.', 'error');
        navigation.goBack();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [targetUserId, startIndex]);

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.stories?.[storyIndex];
  const isMine = currentGroup && user?.id != null
    && String(currentGroup.userId) === String(user.id);

  // ---- seen tracking ----
  useEffect(() => {
    if (currentStory?.id != null) {
      markSeen(currentStory.id);
      track('story_view', {
        story_id: currentStory.id,
        author_id: currentStory.user_id,
      });
    }
  }, [currentStory?.id, currentStory?.user_id]);

  // ---- progress driver ----
  // We keep the driver behind refs so the tap-zone Pressables and the drag
  // PanResponder (both created once) can always reach the LATEST advance/
  // pause/resume without React re-registering them on every render.
  const advanceRef = useRef(() => {});
  const pauseRef   = useRef(() => {});
  const resumeRef  = useRef(() => {});
  const startTimerRef = useRef(() => {});

  const startTimer = useCallback((fromValue) => {
    if (!currentStory) return;
    if (anim.current) { anim.current.stop(); anim.current = null; }
    const start = typeof fromValue === 'number' ? fromValue : 0;
    progress.setValue(start);
    const remaining = STORY_MS * (1 - start);
    anim.current = Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(300, remaining),
      useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (finished && !paused.current) advanceRef.current(1);
    });
  }, [currentStory, progress]);

  const advance = useCallback((dir) => {
    if (!groups.length) return;
    const g = groups[groupIndex];
    if (!g) return;
    if (dir > 0) {
      if (storyIndex + 1 < g.stories.length) {
        setStoryIndex(storyIndex + 1);
      } else if (groupIndex + 1 < groups.length) {
        setGroupIndex(groupIndex + 1);
        setStoryIndex(0);
      } else {
        // End of everyone's stories.
        navigation.goBack();
      }
    } else {
      if (storyIndex - 1 >= 0) {
        setStoryIndex(storyIndex - 1);
      } else if (groupIndex - 1 >= 0) {
        const prev = groups[groupIndex - 1];
        setGroupIndex(groupIndex - 1);
        setStoryIndex(Math.max(0, prev.stories.length - 1));
      } else {
        // At the very first — restart the current story.
        startTimerRef.current(0);
      }
    }
  }, [groups, groupIndex, storyIndex, navigation]);

  const pause = useCallback(() => {
    if (paused.current) return;
    paused.current = true;
    if (anim.current) anim.current.stop();
  }, []);

  const resume = useCallback(() => {
    if (!paused.current) return;
    paused.current = false;
    // Resume from wherever the bar got to.
    progress.stopAnimation((val) => startTimerRef.current(val));
  }, [progress]);

  // Keep the refs pointed at the latest closures.
  useEffect(() => { advanceRef.current    = advance;    }, [advance]);
  useEffect(() => { pauseRef.current      = pause;      }, [pause]);
  useEffect(() => { resumeRef.current     = resume;     }, [resume]);
  useEffect(() => { startTimerRef.current = startTimer; }, [startTimer]);

  useEffect(() => {
    if (loading || !currentStory || gone) return;
    startTimer(0);
    return () => { if (anim.current) { anim.current.stop(); anim.current = null; } };
  }, [loading, currentStory?.id, gone, startTimer]);

  // ---- gestures: vertical drag to dismiss ----
  const panRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderGrant: () => { pauseRef.current(); },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) dragY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 90 || gs.vy > 1.3) {
          setGone(true);
          Animated.timing(dragY, {
            toValue: 600, duration: 220, useNativeDriver: true,
          }).start(() => navigation.goBack());
        } else {
          Animated.spring(dragY, {
            toValue: 0, useNativeDriver: true, speed: 22, bounciness: 6,
          }).start(() => resumeRef.current());
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0, useNativeDriver: true, speed: 22, bounciness: 6,
        }).start(() => resumeRef.current());
      },
    }),
  ).current;

  // ---- report / block ----
  const openOptions = useCallback(() => {
    if (!currentStory || isMine) return;
    pause();
    const name = currentStory.name || 'this member';
    Alert.alert(name, null, [
      {
        text: 'Report this moment',
        onPress: () => {
          Alert.alert("What's wrong with it?", null, [
            { text: 'Encourages unsafe drinking', onPress: () => submitReport('unsafe_drinking') },
            { text: 'Harassment or hate',         onPress: () => submitReport('harassment') },
            { text: 'Spam or scam',               onPress: () => submitReport('spam') },
            { text: 'Sexual or violent content',  onPress: () => submitReport('inappropriate') },
            { text: 'Something else',             onPress: () => submitReport('other') },
            { text: 'Cancel', style: 'cancel', onPress: () => resume() },
          ]);
        },
      },
      {
        text: `Block ${name}`,
        style: 'destructive',
        onPress: () => confirmBlock(),
      },
      { text: 'Cancel', style: 'cancel', onPress: () => resume() },
    ]);
  }, [currentStory, isMine]);

  const submitReport = useCallback(async (reason) => {
    if (!currentStory) return;
    try {
      // The server's /reports endpoint only accepts target_type of
      // 'post' | 'user' | 'comment' today (server/routes/reports.js). A story
      // report is really a report of the author's moment, so we submit it as
      // a user-level report with the reason attached — the moderation team
      // still gets the signal, without us guessing a target_type the API
      // would reject. If a 'story' type lands later, this call gains a
      // dedicated shape.
      await api.post('/reports', {
        target_type: 'user',
        target_id: currentStory.user_id,
        reason: `story:${currentStory.id}:${reason}`,
      });
      toast?.show('Reported. Our team will review it.', 'success');
    } catch (e) {
      // Do not surface the raw error — a 404 could otherwise leak that the
      // author already blocked this viewer.
      toast?.show(e.safeMessage || 'Could not send that report.', 'error');
    } finally {
      resume();
    }
  }, [currentStory, toast, resume]);

  const confirmBlock = useCallback(() => {
    if (!currentStory) return;
    const name = currentStory.name || 'this member';
    Alert.alert(
      `Block ${name}?`,
      `You won't see ${name}'s pours or moments, and they won't see yours.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resume() },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/blocks/${currentStory.user_id}`);
              toast?.show(`${name} is blocked.`, 'success');
              navigation.goBack();
            } catch (e) {
              toast?.show(e.safeMessage || 'Could not block that member.', 'error');
              resume();
            }
          },
        },
      ],
    );
  }, [currentStory, navigation, toast, resume]);

  // ---- render ----
  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: '#000' }]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (!currentGroup || !currentStory) return null;

  const image = mediaUrl(currentStory.image_url || currentStory.image || null);
  const drink = currentStory.drink || '🍹';
  const caption = currentStory.caption || null;

  // Deterministic gradient per story id so it stays put across advances.
  const gi = Math.abs(hashId(currentStory.id)) % GRADIENTS.length;
  const [g1, g2] = GRADIENTS[gi];

  const dragScale = dragY.interpolate({
    inputRange: [0, 300],
    outputRange: [1, 0.85],
    extrapolate: 'clamp',
  });
  const dragOpacity = dragY.interpolate({
    inputRange: [0, 300],
    outputRange: [1, 0.5],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.root,
        {
          backgroundColor: '#000',
          transform: [{ translateY: dragY }, { scale: dragScale }],
          opacity: dragOpacity,
        },
      ]}
      {...panRef.panHandlers}
    >
      <StatusBar barStyle="light-content" />

      {/* Background */}
      {image ? (
        <Image
          source={{ uri: image }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={220}
          cachePolicy="memory-disk"
        />
      ) : (
        <LinearGradient
          colors={[g1, g2]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          <View style={styles.glyphWrap}>
            <Text style={styles.glyph}>{drink}</Text>
          </View>
        </LinearGradient>
      )}

      {/* Top scrim so the progress + header stay legible over any photo. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent']}
        style={[styles.topScrim, { paddingTop: insets.top }]}
        pointerEvents="box-none"
      >
        {/* Progress row */}
        <View style={styles.progressRow}>
          {currentGroup.stories.map((s, i) => (
            <View key={s.id} style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width:
                      i < storyIndex ? '100%' :
                      i > storyIndex ? '0%' :
                      progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header row */}
        <View style={styles.headerRow}>
          <Avatar uri={currentGroup.avatar} name={currentGroup.name} size={34} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.name} numberOfLines={1}>
              {currentGroup.name}
            </Text>
            <Text style={styles.time}>{timeAgoShort(currentStory.created_at)}</Text>
          </View>
          {!isMine && (
            <Pressable
              onPress={openOptions}
              hitSlop={12}
              style={styles.headerBtn}
              accessibilityLabel="Story options"
            >
              <Icon name="ellipsis-horizontal" size={20} color="#fff" />
            </Pressable>
          )}
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.headerBtn}
            accessibilityLabel="Close moments"
          >
            <Icon name="close" size={22} color="#fff" />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Optional caption — non-interactive so taps fall through to the zones. */}
      {!!caption && (
        <View
          style={[styles.captionWrap, { paddingBottom: insets.bottom + 24 }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.caption} numberOfLines={3}>{caption}</Text>
        </View>
      )}

      {/* Tap zones — layered below the header so the header's buttons still work. */}
      <View style={styles.tapRow} pointerEvents="box-none">
        <Pressable
          style={styles.tapZone}
          onPress={() => { tapHaptic(); advance(-1); }}
          onLongPress={pause}
          onPressOut={resume}
          delayLongPress={220}
          accessibilityLabel="Previous moment"
        />
        <Pressable
          style={styles.tapZone}
          onPress={() => { tapHaptic(); advance(1); }}
          onLongPress={pause}
          onPressOut={resume}
          delayLongPress={220}
          accessibilityLabel="Next moment"
        />
      </View>
    </Animated.View>
  );
}

function hashId(id) {
  const s = String(id ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  topScrim: {
    position: 'absolute', left: 0, right: 0, top: 0,
    paddingHorizontal: 12, paddingBottom: 10, zIndex: 3,
  },
  progressRow: {
    flexDirection: 'row', gap: 4, marginTop: 6, marginBottom: 10,
  },
  progressTrack: {
    flex: 1, height: 2.5, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { color: '#fff', fontSize: 14, fontWeight: '700' },
  time: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '500', marginTop: 1 },
  headerBtn: { padding: 8 },

  captionWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 40, zIndex: 2,
  },
  caption: { color: '#fff', fontSize: 15, fontWeight: '500', lineHeight: 21 },

  tapRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row', zIndex: 1,
  },
  tapZone: { flex: 1 },

  glyphWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  glyph: {
    fontSize: 140,
    // Slight vertical lift so the glyph reads centred once the header scrim
    // lands on top.
    marginTop: -20,
    ...(Platform.OS === 'android' ? {} : { textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 20 }),
  },
});
