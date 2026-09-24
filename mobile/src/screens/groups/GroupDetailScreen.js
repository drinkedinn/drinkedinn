// src/screens/groups/GroupDetailScreen.js
// One group's page — cover, description, join / joined action, a preview
// strip of members, an inline composer for members, then the group's posts.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { showReportSheet } from '../../lib/reportSheet';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import {
  Screen, Header, Icon, Avatar, Bounce, EmptyState, FadeIn, Button, useToast,
} from '../../components/ui';
import { PostSkeleton, Shimmer } from '../../components/ui/Skeleton';
import GroupPostCard from '../../components/groups/GroupPostCard';
import GroupComposer from '../../components/groups/GroupComposer';
import useGroupPostActions from '../../components/groups/useGroupPostActions';
import track from '../../lib/track';
import { navigateByName } from '../../lib/nav';

function memberLabel(n) {
  const c = Number(n) || 0;
  if (c === 0) return '0 members';
  if (c === 1) return '1 member';
  if (c < 1000) return `${c} members`;
  return `${(c / 1000).toFixed(c < 10000 ? 1 : 0)}k members`;
}

function GroupHero({ group, onToggleJoin, joining, isOwner }) {
  const { t } = useTheme();
  const joined = Number(group?.is_member) > 0;

  return (
    <View style={styles.hero}>
      <View style={[styles.cover, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
        <Text style={{ fontSize: 60 }}>{group?.drink_type || '🥃'}</Text>
      </View>

      <Text style={[type.h1, { color: t.text, marginTop: 16 }]} numberOfLines={2}>
        {group?.name}
      </Text>

      {!!group?.description && (
        <Text
          style={[type.body, { color: t.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }]}
        >
          {group.description}
        </Text>
      )}

      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <Icon name="people-outline" size={13} color={t.textMuted} />
          <Text style={[type.caption, { color: t.textMuted }]}>{memberLabel(group?.member_count)}</Text>
        </View>
        {!!group?.creator_name && (
          <View style={styles.metaChip}>
            <Icon name="ribbon-outline" size={13} color={t.textMuted} />
            <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={1}>
              Started by {group.creator_name}
            </Text>
          </View>
        )}
      </View>

      <View style={{ marginTop: 16, width: '100%', alignItems: 'center' }}>
        {isOwner ? (
          <View style={[styles.ownerPill, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
            <Icon name="star" size={13} color={t.accent} />
            <Text style={[type.label, { color: t.accentText }]}>You're the host</Text>
          </View>
        ) : (
          <Button
            label={joined ? 'Joined' : 'Join group'}
            icon={joined ? 'checkmark' : 'add'}
            variant={joined ? 'secondary' : 'primary'}
            size="md"
            loading={joining}
            onPress={onToggleJoin}
          />
        )}
      </View>
    </View>
  );
}

function MembersStrip({ members }) {
  const { t } = useTheme();
  if (!members?.length) return null;
  const shown = members.slice(0, 8);

  return (
    <View style={styles.membersStrip}>
      <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>
        Members
      </Text>
      <View style={styles.avatarRow}>
        {shown.map((m, i) => (
          <View key={m.id ?? i} style={[styles.avatarSlot, { marginLeft: i === 0 ? 0 : -10, borderColor: t.bg }]}>
            <Avatar uri={m.avatar} name={m.name} size={30} />
          </View>
        ))}
        {members.length > shown.length && (
          <View style={[styles.more, { backgroundColor: t.surfaceAlt, borderColor: t.bg }]}>
            <Text style={[type.caption, { color: t.textSecondary, fontWeight: '700' }]}>
              +{members.length - shown.length}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function GroupDetailScreen({ navigation, route }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const routeId = route?.params?.id;
  const initialName = route?.params?.name;

  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [errored, setErrored] = useState(false);

  const load = useCallback(async () => {
    if (!routeId) return;
    try {
      const res = await api.get(`/groups/${routeId}`);
      const data = res.data || {};
      const { posts: p, members: m, ...rest } = data;
      setGroup(rest);
      setPosts(Array.isArray(p) ? p : []);
      setMembers(Array.isArray(m) ? m : []);
      setErrored(false);
    } catch (e) {
      // A 404 could mean the group was removed, or the author is blocked and
      // the row is hidden for us. Do not reveal the difference.
      setErrored(true);
      if (e?.response?.status !== 404) {
        toast?.show(e?.safeMessage || 'Could not load that group.', 'error');
      }
    }
  }, [routeId, toast]);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const isOwner = !!(group && user && group.created_by === user.id);
  const isMember = isOwner || Number(group?.is_member) > 0;

  const toggleJoin = useCallback(async () => {
    if (!group?.id || joining) return;
    if (isOwner) return; // server refuses; guard the UI too.
    setJoining(true);
    const wasJoined = Number(group.is_member) > 0;

    // Optimistic — the visible member count and pill flip immediately.
    setGroup((g) => ({
      ...g,
      is_member: wasJoined ? 0 : 1,
      member_count: Math.max(0, (Number(g.member_count) || 0) + (wasJoined ? -1 : 1)),
    }));

    try {
      const res = await api.post(`/groups/${group.id}/join`);
      const joined = !!res.data?.joined;
      // Reconcile in case optimistic direction was wrong.
      setGroup((g) => ({ ...g, is_member: joined ? 1 : 0 }));
      try {
        joined
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      track(joined ? 'group_joined' : 'group_left', { id: group.id });
      toast?.show(joined ? `Welcome to ${group.name}.` : `Left ${group.name}.`, 'success');
    } catch (e) {
      // Roll back.
      setGroup((g) => ({
        ...g,
        is_member: wasJoined ? 1 : 0,
        member_count: Math.max(0, (Number(g.member_count) || 0) + (wasJoined ? 1 : -1)),
      }));
      toast?.show(e?.safeMessage || 'Could not update membership.', 'error');
    } finally {
      setJoining(false);
    }
  }, [group, joining, isOwner, toast]);

  const onPosted = useCallback((newPost) => {
    if (!newPost) return;
    setPosts((list) => [newPost, ...list]);
  }, []);

  const openProfile = useCallback(
    (id) => {
      if (!id) return;
      if (id === user?.id) navigateByName(navigation, 'Profile');
      else navigation.navigate('User', { userId: id });
    },
    [navigation, user?.id]
  );

  const { openMenu } = useGroupPostActions({
    onRemoved: (post) => {
      // When a post is reported or the author is blocked, drop that post and
      // any other posts by the same author from view immediately.
      setPosts((list) =>
        list.filter((p) => (p.id === post.id ? false : p.user_id !== post.user_id || p.user_id === user?.id))
      );
    },
  });

  // Report / block the host — required because the group name and description
  // are user-generated content too. Reports go against the host's user record
  // (target_type: 'user'); blocking uses the same /blocks/:id endpoint.
  const openGroupMenu = useCallback(() => {
    if (!group) return;
    const hostName = group.creator_name || 'the host';
    const hostId = group.created_by;
    const reasons = [
      { key: 'unsafe_drinking', label: 'Encourages unsafe drinking' },
      { key: 'harassment', label: 'Harassment or hate' },
      { key: 'spam', label: 'Spam or scam' },
      { key: 'inappropriate', label: 'Sexual or violent content' },
      { key: 'other', label: 'Something else' },
    ];

    const sendReport = async (reason) => {
      try {
        await api.post('/reports', { target_type: 'user', target_id: hostId, reason });
        toast?.show('Reported. Our team will review it.', 'success');
      } catch (e) {
        toast?.show(e?.safeMessage || 'Could not send that report.', 'error');
      }
    };

    const chooseReason = async () => {
      const key = await showReportSheet({ title: "Report this group — what's wrong with it?", reasons });
      if (key) sendReport(key);
    };

    const blockHost = () => {
      Alert.alert(
        `Block ${hostName}?`,
        `You won't see ${hostName}'s pours or the rooms they host, and they won't see yours.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.post(`/blocks/${hostId}`);
                toast?.show(`${hostName} is blocked.`, 'success');
                navigation.goBack();
              } catch (e) {
                toast?.show(e?.safeMessage || 'Could not block that member.', 'error');
              }
            },
          },
        ]
      );
    };

    const options = [{ text: 'Report this group', onPress: chooseReason }];
    if (hostId && hostId !== user?.id) {
      options.push({ text: `Block ${hostName}`, style: 'destructive', onPress: blockHost });
    }
    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(group.name || 'Group', null, options);
  }, [group, user?.id, navigation, toast]);

  const headerBlock = useMemo(() => {
    if (loading || !group) return null;
    return (
      <View>
        <GroupHero
          group={group}
          isOwner={isOwner}
          joining={joining}
          onToggleJoin={toggleJoin}
        />
        <MembersStrip members={members} />
        {isMember ? (
          <GroupComposer
            groupId={group.id}
            groupDrink={group.drink_type || '🥃'}
            onPosted={onPosted}
          />
        ) : (
          <View style={[styles.joinNudge, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
            <Icon name="lock-closed-outline" size={16} color={t.textSecondary} />
            <Text style={[type.body, { color: t.textSecondary, flex: 1 }]}>
              Join to share a moment with this group.
            </Text>
          </View>
        )}
        {posts.length > 0 && (
          <Text
            style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginLeft: 16, marginBottom: 8 }]}
          >
            Recent pours
          </Text>
        )}
      </View>
    );
  }, [group, isOwner, isMember, joining, toggleJoin, members, onPosted, posts.length, loading, t]);

  // Not-found / errored state — we render as "unavailable" to avoid revealing
  // whether the group was deleted or the author blocked us.
  if (!loading && (!group || errored)) {
    return (
      <Screen edges={['top']}>
        <Header title={initialName || 'Group'} onBack={() => navigation.goBack()} />
        <EmptyState
          icon="prism-outline"
          title="This group isn't available"
          body="It may have been closed. Try a different one from the Groups list."
          actionLabel="Back to groups"
          onAction={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Header
        title={group?.name || initialName || 'Group'}
        onBack={() => navigation.goBack()}
        right={
          group && !isOwner ? (
            <Bounce
              onPress={openGroupMenu}
              haptic="light"
              hitSlop={10}
              style={styles.headerBtn}
              accessibilityLabel="Group options"
            >
              <Icon name="ellipsis-horizontal" size={20} color={t.text} />
            </Bounce>
          ) : null
        }
      />

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Shimmer style={{ width: 120, height: 120, borderRadius: 60 }} />
            <Shimmer style={{ width: 180, height: 18, borderRadius: 9, marginTop: 18 }} />
            <Shimmer style={{ width: '80%', height: 12, borderRadius: 6, marginTop: 14 }} />
            <Shimmer style={{ width: '60%', height: 12, borderRadius: 6, marginTop: 8 }} />
          </View>
          <PostSkeleton />
          <PostSkeleton />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => `gp-${item.id}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 130 }}
          ListHeaderComponent={headerBlock}
          renderItem={({ item, index }) => (
            <FadeIn index={index}>
              <GroupPostCard
                post={item}
                onProfile={openProfile}
                onReport={openMenu}
              />
            </FadeIn>
          )}
          ListEmptyComponent={
            posts.length === 0 && group ? (
              <EmptyState
                icon="wine-outline"
                title="Nothing poured yet"
                body={
                  isMember
                    ? 'Be the first to share a moment with this group.'
                    : 'Join the group to see what everyone is sharing.'
                }
              />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
              progressBackgroundColor={t.surface}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 6,
  },
  cover: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ownerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  membersStrip: {
    marginHorizontal: 16,
    marginTop: 22,
    marginBottom: 14,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  avatarSlot: {
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
  },
  more: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginLeft: -10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  joinNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  headerBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
