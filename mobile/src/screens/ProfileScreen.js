// src/screens/ProfileScreen.js
// Used for both your own profile and other people's. Tabs across pours,
// the user's bar (collection), and earned badges.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, Share } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import api, { mediaUrl, ORIGIN } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { radius, type } from '../theme/tokens';
import { Screen, Icon, Avatar, Bounce, Button, EmptyState, FadeIn, useToast } from '../components/ui';
import { PostSkeleton } from '../components/ui/Skeleton';
import PostCard from '../components/PostCard';
import Segmented from '../components/home/Segmented';

const TABS = [
  { key: 'pours', label: 'Pours' },
  { key: 'bar', label: 'Bar' },
  { key: 'badges', label: 'Badges' },
];

function Stat({ value, label }) {
  const { t } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[type.h2, { color: t.text, fontVariant: ['tabular-nums'] }]}>{value ?? 0}</Text>
      <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen({ navigation, route }) {
  const { t, elevation } = useTheme();
  const { user: me } = useAuth();
  const toast = useToast();

  const targetId = route?.params?.userId ?? me?.id;
  const isMe = targetId === me?.id;

  const [profile, setProfile] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pours');
  const [bar, setBar] = useState(null);
  const [badges, setBadges] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/users/${targetId}`);
      setProfile(res.data);
      setConnected(!!res.data.isConnected);
    } catch (e) {
      toast?.show(e.safeMessage || 'Could not load that profile.', 'error');
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  // Lazy-load the secondary tabs only when opened.
  useEffect(() => {
    if (tab === 'bar' && bar === null) {
      api.get(isMe ? '/collection' : `/collection?userId=${targetId}`)
        .then((r) => setBar(Array.isArray(r.data) ? r.data : []))
        .catch(() => setBar([]));
    }
    if (tab === 'badges' && badges === null) {
      api.get('/badges')
        .then((r) => setBadges(r.data?.earned || []))
        .catch(() => setBadges([]));
    }
  }, [tab, bar, badges, isMe, targetId]);

  const toggleConnect = async () => {
    const next = !connected;
    setConnected(next);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    try {
      await api.post(`/users/${targetId}/connect`);
      setProfile((p) => (p ? { ...p, connections: (p.connections || 0) + (next ? 1 : -1) } : p));
    } catch {
      setConnected(!next);
    }
  };

  const shareProfile = async () => {
    try {
      await Share.share({
        message: `${profile?.name} on DrinkedInn`,
        url: `${ORIGIN}/profile/${targetId}`,
      });
    } catch {}
  };

  const data = useMemo(() => {
    if (tab === 'pours') return profile?.posts || [];
    if (tab === 'bar') return bar || [];
    return badges || [];
  }, [tab, profile, bar, badges]);

  if (loading && !profile) {
    return (
      <Screen>
        <ActivityIndicator color={t.accent} style={{ marginTop: 60 }} />
      </Screen>
    );
  }
  if (!profile) return <Screen><EmptyState icon="person-outline" title="Profile unavailable" /></Screen>;

  const header = (
    <View>
      {/* Cover */}
      <LinearGradient
        colors={[t.accentSoft, t.bg]}
        style={styles.cover}
      />

      {/* Top actions overlaying the cover */}
      <View style={styles.topActions} pointerEvents="box-none">
        {!isMe && (
          <Bounce onPress={() => navigation.goBack()} haptic="light" style={[styles.circleBtn, { backgroundColor: t.surface, borderColor: t.border }]} accessibilityLabel="Go back">
            <Icon name="chevron-back" size={20} color={t.text} />
          </Bounce>
        )}
        <View style={{ flex: 1 }} />
        <Bounce onPress={shareProfile} haptic="light" style={[styles.circleBtn, { backgroundColor: t.surface, borderColor: t.border }]} accessibilityLabel="Share profile">
          <Icon name="share-outline" size={18} color={t.text} />
        </Bounce>
        {isMe && (
          <Bounce onPress={() => navigation.navigate('Account')} haptic="light" style={[styles.circleBtn, { backgroundColor: t.surface, borderColor: t.border }]} accessibilityLabel="Settings">
            <Icon name="settings-outline" size={18} color={t.text} />
          </Bounce>
        )}
      </View>

      <View style={styles.body}>
        <View style={[styles.avatarRing, { borderColor: t.bg }]}>
          <Avatar uri={profile.avatar} name={profile.name} size={92} />
        </View>

        <View style={styles.nameRow}>
          <Text style={[type.h1, { color: t.text }]}>{profile.name}</Text>
          {!!profile.verified && <Icon name="checkmark-circle" size={19} color={t.blue} />}
          {!!profile.premium && <Icon name="star" size={16} color={t.accent} />}
        </View>
        <Text style={[type.body, { color: t.textSecondary, textAlign: 'center', marginTop: 4 }]}>
          {profile.title || 'DrinkedInn Member'}
        </Text>

        {profile.current_streak >= 2 && (
          <View style={[styles.streak, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
            <Icon name="flame" size={13} color={t.accent} />
            <Text style={[type.caption, { color: t.accentText, fontWeight: '700' }]}>
              {profile.current_streak}-day streak
            </Text>
          </View>
        )}

        {!!profile.bio && (
          <Text style={[type.body, { color: t.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 21 }]}>
            {profile.bio}
          </Text>
        )}

        <View style={[styles.stats, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
          <Stat value={profile.connections} label="Connections" />
          <View style={[styles.div, { backgroundColor: t.divider }]} />
          <Stat value={profile.posts?.length} label="Pours" />
          <View style={[styles.div, { backgroundColor: t.divider }]} />
          <Stat value={profile.longest_streak} label="Best streak" />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' }}>
          {isMe ? (
            <Button label="Edit profile" icon="create-outline" variant="secondary" full onPress={() => navigation.navigate('EditProfile')} />
          ) : (
            <>
              <View style={{ flex: 1 }}>
                <Button
                  label={connected ? 'Connected' : 'Connect'}
                  icon={connected ? 'checkmark' : 'person-add-outline'}
                  variant={connected ? 'secondary' : 'primary'}
                  full
                  onPress={toggleConnect}
                />
              </View>
              <Button label="Message" icon="chatbubble-outline" variant="subtle" onPress={() => toast?.show('Messages are coming soon.', 'info')} />
            </>
          )}
        </View>
      </View>

      <View style={{ marginTop: 22, marginBottom: 14 }}>
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </View>
    </View>
  );

  const renderItem = ({ item, index }) => {
    if (tab === 'pours') {
      return (
        <FadeIn index={index}>
          <PostCard
            post={{
              ...item,
              name: profile.name,
              avatar: profile.avatar,
              title: profile.title,
              verified: profile.verified,
              premium: profile.premium,
            }}
            onOpen={(p) => navigation.navigate('PostDetail', { post: p })}
            onProfile={() => {}}
          />
        </FadeIn>
      );
    }

    if (tab === 'bar') {
      const img = mediaUrl(item.image_url);
      return (
        <FadeIn index={index}>
          <View style={[styles.bottle, { backgroundColor: t.surface, borderColor: t.border }]}>
            {img ? (
              <Image source={{ uri: img }} style={styles.bottleImg} contentFit="cover" transition={200} />
            ) : (
              <View style={[styles.bottleImg, { backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}>
                <Icon name="wine-outline" size={22} color={t.textMuted} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
                {[item.distillery, item.vintage].filter(Boolean).join(' · ') || item.drink_type}
              </Text>
              {!!item.notes && (
                <Text style={[type.caption, { color: t.textSecondary, marginTop: 5 }]} numberOfLines={2}>{item.notes}</Text>
              )}
            </View>
            {item.rating > 0 && (
              <View style={[styles.rating, { backgroundColor: t.accentSoft }]}>
                <Text style={[type.label, { color: t.accentText }]}>{item.rating}</Text>
              </View>
            )}
          </View>
        </FadeIn>
      );
    }

    return (
      <FadeIn index={index}>
        <View style={[styles.badge, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={[styles.badgeIcon, { backgroundColor: t.accentSoft }]}>
            <Text style={{ fontSize: 22 }}>{item.icon || '🏅'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: t.text }]}>{item.name}</Text>
            <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>{item.desc}</Text>
          </View>
        </View>
      </FadeIn>
    );
  };

  const emptyFor = {
    pours: { icon: 'wine-outline', title: isMe ? 'No pours yet' : 'Nothing poured yet', body: isMe ? 'Share what’s in your glass to start your feed.' : 'This member hasn’t shared a pour yet.' },
    bar: { icon: 'library-outline', title: 'The shelf is empty', body: isMe ? 'Bottles you add to your collection show up here.' : 'Nothing on this shelf yet.' },
    badges: { icon: 'ribbon-outline', title: 'No badges yet', body: 'Badges arrive as you post, cheer and connect.' },
  }[tab];

  return (
    <Screen edges={['top']}>
      <FlatList
        data={data}
        keyExtractor={(item, i) => String(item.id ?? `${tab}-${i}`)}
        ListHeaderComponent={header}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
        ListEmptyComponent={
          (tab === 'bar' && bar === null) || (tab === 'badges' && badges === null) ? (
            <ActivityIndicator color={t.accent} style={{ marginTop: 30 }} />
          ) : (
            <EmptyState
              icon={emptyFor.icon}
              title={emptyFor.title}
              body={emptyFor.body}
              actionLabel={isMe && tab === 'pours' ? 'Share a pour' : undefined}
              onAction={() => navigation.navigate('Compose')}
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { height: 104 },
  topActions: { position: 'absolute', top: 10, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  circleBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  body: { alignItems: 'center', paddingHorizontal: 20, marginTop: -48 },
  avatarRing: { borderWidth: 4, borderRadius: 54, marginBottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 20, borderRadius: radius.lg, borderWidth: 1, paddingVertical: 15, width: '100%' },
  div: { width: StyleSheet.hairlineWidth, height: 28 },
  bottle: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: radius.md, borderWidth: 1 },
  bottleImg: { width: 52, height: 52, borderRadius: radius.sm },
  rating: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.sm, marginLeft: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 13, marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: radius.md, borderWidth: 1 },
  badgeIcon: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
