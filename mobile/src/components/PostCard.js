// src/components/PostCard.js
import React, { useRef, useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Share } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import api, { mediaUrl, ORIGIN } from '../api';
import { useTheme } from '../theme/ThemeContext';
import { radius, type } from '../theme/tokens';
import { Icon, Avatar, Bounce } from './ui';

function timeAgo(ts) {
  if (!ts) return '';
  const raw = String(ts);
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (isNaN(s) || s < 0) return '';
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

function ActionButton({ icon, activeIcon, label, active, activeColor, onPress, scale }) {
  const { t } = useTheme();
  const color = active ? activeColor : t.textMuted;
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.action} accessibilityRole="button" accessibilityLabel={`${label ?? ''} ${icon}`}>
      <Animated.View style={scale ? { transform: [{ scale }] } : undefined}>
        <Icon name={active ? activeIcon : icon} size={21} color={color} />
      </Animated.View>
      {label !== undefined && <Text style={[type.caption, { color }]}>{label}</Text>}
    </Pressable>
  );
}

function PostCard({ post, onOpen, onProfile, onReport }) {
  const { t, elevation } = useTheme();
  const [cheered, setCheered] = useState(!!post.user_cheered);
  const [count, setCount] = useState(post.cheer_count || 0);
  const [repoured, setRepoured] = useState(!!post.user_repoured);
  const [repourCount, setRepourCount] = useState(post.repour_count || 0);
  const [saved, setSaved] = useState(false);

  const lastTap = useRef(0);
  const heart = useRef(new Animated.Value(0)).current;
  const likeScale = useRef(new Animated.Value(1)).current;

  const img = mediaUrl(post.image_url);

  const burst = useCallback(() => {
    heart.setValue(0);
    Animated.sequence([
      Animated.spring(heart, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }),
      Animated.timing(heart, { toValue: 0, duration: 300, delay: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, [heart]);

  const cheer = useCallback(
    async (force) => {
      const next = force ? true : !cheered;
      if (force && cheered) { burst(); return; }

      setCheered(next);
      setCount((c) => Math.max(0, c + (next ? 1 : -1)));
      try {
        next
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      Animated.sequence([
        Animated.spring(likeScale, { toValue: 1.3, useNativeDriver: true, speed: 50, bounciness: 14 }),
        Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 8 }),
      ]).start();
      if (force) burst();

      try {
        await api.post(`/posts/${post.id}/cheer`);
      } catch {
        setCheered(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      }
    },
    [cheered, post.id, burst, likeScale]
  );

  const repour = useCallback(async () => {
    const next = !repoured;
    setRepoured(next);
    setRepourCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    try {
      await api.post(`/posts/${post.id}/repour`);
    } catch {
      setRepoured(!next);
      setRepourCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
  }, [repoured, post.id]);

  const share = useCallback(async () => {
    try {
      await Share.share({
        message: `${post.name} on DrinkedInn: ${String(post.content || '').slice(0, 120)}`,
        url: `${ORIGIN}/post/${post.id}`,
      });
    } catch {}
  }, [post]);

  const onMediaTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 270) {
      lastTap.current = 0;
      cheer(true);
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current && Date.now() - lastTap.current >= 270) onOpen?.(post);
      }, 280);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
      <View style={styles.header}>
        <Bounce onPress={() => onProfile?.(post.user_id)} haptic={null} scaleTo={0.98} style={styles.headRow}>
          <Avatar uri={post.avatar} name={post.name} size={42} />
          <View style={{ marginLeft: 11, flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[type.h3, { color: t.text }]} numberOfLines={1}>{post.name}</Text>
              {!!post.verified && <Icon name="checkmark-circle" size={15} color={t.blue} />}
              {!!post.premium && <Icon name="star" size={13} color={t.accent} />}
            </View>
            <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={1}>
              {post.title || 'DrinkedInn Member'} · {timeAgo(post.created_at)}
            </Text>
          </View>
        </Bounce>
        <Pressable onPress={() => onReport?.(post)} hitSlop={10} style={{ padding: 4 }} accessibilityLabel="Post options">
          <Icon name="ellipsis-horizontal" size={18} color={t.textMuted} />
        </Pressable>
      </View>

      <Pressable onPress={onMediaTap}>
        {!!post.content && (
          <Text style={[type.body, { color: t.text, lineHeight: 22, paddingHorizontal: 16, paddingBottom: 12 }]}>
            {post.content}
          </Text>
        )}

        {!!img && (
          <View>
            <Image source={{ uri: img }} style={[styles.image, { backgroundColor: t.surfaceAlt }]} contentFit="cover" transition={220} cachePolicy="memory-disk" />
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, { opacity: heart, transform: [{ scale: heart }] }]}>
              <Icon name="heart" size={92} color="#FF4D6D" />
            </Animated.View>
            {!!post.drink && (
              <View style={[styles.drinkPill, { backgroundColor: t.scrim }]}>
                <Text style={{ fontSize: 15 }}>{post.drink}</Text>
              </View>
            )}
          </View>
        )}

        {!!post.location && (
          <View style={styles.locationRow}>
            <Icon name="location-outline" size={13} color={t.textMuted} />
            <Text style={[type.caption, { color: t.textMuted }]}>{post.location}</Text>
          </View>
        )}
      </Pressable>

      <View style={[styles.actions, { borderTopColor: t.divider }]}>
        <ActionButton icon="beer-outline" activeIcon="beer" label={count} active={cheered} activeColor={t.accent} onPress={() => cheer(false)} scale={likeScale} />
        <ActionButton icon="chatbubble-outline" activeIcon="chatbubble" label={post.comment_count || 0} activeColor={t.text} onPress={() => onOpen?.(post)} />
        <ActionButton icon="repeat-outline" activeIcon="repeat" label={repourCount} active={repoured} activeColor={t.success} onPress={repour} />
        <View style={{ flex: 1 }} />
        <ActionButton icon="bookmark-outline" activeIcon="bookmark" active={saved} activeColor={t.accent} onPress={() => setSaved((s) => !s)} />
        <ActionButton icon="share-outline" activeIcon="share" activeColor={t.text} onPress={share} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, marginHorizontal: 16, marginBottom: 14, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  image: { width: '100%', aspectRatio: 1.2 },
  center: { alignItems: 'center', justifyContent: 'center' },
  drinkPill: { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingTop: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 16, paddingVertical: 12, marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

export default memo(PostCard);
