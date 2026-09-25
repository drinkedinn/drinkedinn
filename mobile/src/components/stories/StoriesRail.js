// src/components/stories/StoriesRail.js
// The "moments" rail that sits at the top of the feed.
//
// Behaviour:
//   • Your story is the first cell (a "+" over the user's avatar) — tapping it
//     opens the Create Story composer.
//   • Every other user with a fresh story appears as a ring-wrapped avatar; the
//     ring is warm when there's something you haven't watched, muted once you
//     have. Ring state is driven from local AsyncStorage because the server has
//     no "seen" concept for stories.
//   • The rail owns its fetch (GET /stories) and exposes an imperative
//     .refresh() via ref so a parent's pull-to-refresh can trigger a re-fetch.
//   • Failure is silent: the rail is decorative — never surface an error toast
//     that would step on the feed's own error state.
//
// Server contract: server/routes/stories.js. Anything more the server adds
// (image_url, caption) is preserved on each story and forwarded to the viewer.

import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import { View, Text, ScrollView, StyleSheet, InteractionManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import { Avatar, Icon, Bounce } from '../ui';
import { Shimmer } from '../ui/Skeleton';
import { getSeen } from './seenStore';
import { groupStoriesByUser } from './groupStories';

const CELL = 66;
const AV = 58;

const StoriesRail = forwardRef(function StoriesRail(
  { onCompose, onOpenViewer, style },
  ref,
) {
  const { t } = useTheme();
  const { user } = useAuth();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ownStory, setOwnStory] = useState(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const [res, seenSet] = await Promise.all([
        api.get('/stories'),
        getSeen(),
      ]);
      if (!mounted.current) return;
      const list = Array.isArray(res.data) ? res.data : [];

      const mine = user?.id != null
        ? list.filter((s) => s.user_id === user.id)
        : [];
      const others = user?.id != null
        ? list.filter((s) => s.user_id !== user.id)
        : list;

      const grouped = groupStoriesByUser(others, {
        currentUserId: user?.id,
        seenSet,
      });

      // Own story is pinned into the first cell rather than being sorted
      // in with everyone else, so the composer entry point never moves.
      const myGroup = mine.length
        ? groupStoriesByUser(mine, { currentUserId: user?.id, seenSet })[0]
        : null;

      setGroups(grouped);
      setOwnStory(myGroup);
    } catch {
      // Silent — see file header.
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    mounted.current = true;
    // Defer initial fetch a beat so it never competes with the feed's own load.
    const task = InteractionManager.runAfterInteractions(() => { load(); });
    return () => { mounted.current = false; task.cancel?.(); };
  }, [load]);

  // Refetch when the enclosing screen regains focus so the rings recompute
  // against the latest seen-state after the viewer closes. Skip the first
  // focus (mount already loaded).
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) { focusedOnce.current = true; return; }
      load();
    }, [load]),
  );

  useImperativeHandle(ref, () => ({
    refresh: load,
  }), [load]);

  const openMine = useCallback(() => {
    if (ownStory) {
      onOpenViewer?.({ userId: user.id, isMine: true });
    } else {
      onCompose?.();
    }
  }, [ownStory, onCompose, onOpenViewer, user?.id]);

  const addAnother = useCallback(() => { onCompose?.(); }, [onCompose]);

  if (loading && !groups.length && !ownStory) {
    return (
      <View style={style}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.cell}>
              <Shimmer style={{ width: AV, height: AV, borderRadius: AV / 2 }} />
              <Shimmer style={{ width: 40, height: 8, borderRadius: 4, marginTop: 8 }} />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={style}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {/* Your story — either the composer entry point or a preview of what you shared. */}
        <Bounce
          onPress={openMine}
          onLongPress={ownStory ? addAnother : undefined}
          haptic="medium"
          scaleTo={0.92}
          style={styles.cell}
          accessibilityLabel={ownStory ? 'View your moment' : 'Share a moment'}
        >
          <View>
            {ownStory ? (
              <Ring active={ownStory.hasUnseen} t={t} size={AV}>
                <Avatar uri={user?.avatar} name={user?.name} size={AV - 6} />
              </Ring>
            ) : (
              <Avatar uri={user?.avatar} name={user?.name} size={AV} />
            )}
            <View style={[styles.plus, { backgroundColor: t.accent, borderColor: t.bg }]}>
              <Icon name="add" size={15} color={t.textOnAccent} />
            </View>
          </View>
          <Text
            style={[type.caption, { color: t.textSecondary, marginTop: 7, maxWidth: CELL }]}
            numberOfLines={1}
          >
            {ownStory ? 'Your moment' : 'Add moment'}
          </Text>
        </Bounce>

        {groups.map((g) => (
          <Bounce
            key={g.userId}
            onPress={() => onOpenViewer?.({ userId: g.userId })}
            haptic="light"
            scaleTo={0.92}
            style={styles.cell}
            accessibilityLabel={`Open ${g.name}'s moment`}
          >
            <Ring active={g.hasUnseen} t={t} size={AV}>
              <Avatar uri={g.avatar} name={g.name} size={AV - 6} />
            </Ring>
            <Text
              style={[
                type.caption,
                { color: t.textSecondary, marginTop: 7, maxWidth: CELL, textAlign: 'center' },
              ]}
              numberOfLines={1}
            >
              {String(g.name || '').split(' ')[0]}
            </Text>
          </Bounce>
        ))}
      </ScrollView>
    </View>
  );
});

function Ring({ active, t, size, children }) {
  // Warm gradient when unseen, muted border when everything's been watched.
  const outer = size + 6;
  const inner = size + 2;

  if (!active) {
    return (
      <View
        style={{
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: t.borderStrong,
        }}
      >
        <View
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.bg,
          }}
        >
          {children}
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[t.accent, '#D9698A', '#7B61C9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: outer, height: outer, borderRadius: outer / 2,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: inner, height: inner, borderRadius: inner / 2,
          backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 14, gap: 15 },
  cell: { alignItems: 'center', width: CELL },
  plus: {
    position: 'absolute', right: -2, bottom: -2, width: 23, height: 23, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2.5,
  },
});

export default StoriesRail;
