// src/components/feedmodes/PourOfTheDay.js
// Editorial spotlight card. Renders one hand-picked moment sourced from
// GET /featured/potd. Editorial voice — "Today's spotlight", never "drink this".
// Renders null when the server has nothing for today, so it can be dropped into
// any list header without a placeholder or a layout gap.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import api, { mediaUrl } from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Avatar, Icon, Bounce } from '../ui';
import track from '../../lib/track';

export default function PourOfTheDay({ onOpen, navigation }) {
  const { t, elevation } = useTheme();
  const [post, setPost] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const res = await api.get('/featured/potd');
      // Server returns the featured post OR null — treat both as valid.
      setPost(res.data && res.data.id ? res.data : null);
    } catch {
      // A quiet failure is fine here — this is a discretionary discovery card,
      // not a required surface. We simply render nothing.
      setPost(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (post) {
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [post, fade]);

  if (!loaded || !post) return null;

  const open = () => {
    try { track('potd_opened', { post_id: post.id }); } catch {}
    if (onOpen) return onOpen(post);
    // Hydrated via PostDetailScreen's own fetch if only id is present.
    navigation?.navigate('PostDetail', { post });
  };

  const img = mediaUrl(post.image_url);
  const author = post.name || 'A member';

  return (
    <Animated.View
      style={{
        opacity: fade,
        transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        marginBottom: 18,
      }}
    >
      <View style={styles.labelRow}>
        <View style={[styles.dot, { backgroundColor: t.accent }]} />
        <Text style={[type.overline, { color: t.accent, textTransform: 'uppercase' }]}>Today's spotlight</Text>
      </View>

      <Bounce
        onPress={open}
        haptic="light"
        scaleTo={0.985}
        accessibilityLabel={`Today's spotlight, a moment from ${author}`}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: t.surface, borderColor: t.accentBorder },
            elevation(t, 2),
          ]}
        >
          {img ? (
            <View style={styles.media}>
              <Image
                source={{ uri: img }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={260}
                cachePolicy="memory-disk"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.82)']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.overlay}>
                <View style={styles.author}>
                  <Avatar uri={post.avatar} name={author} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.bodyStrong, { color: '#fff' }]} numberOfLines={1}>
                      {author}
                    </Text>
                    {!!post.title && (
                      <Text style={[type.caption, { color: 'rgba(255,255,255,0.78)' }]} numberOfLines={1}>
                        {post.title}
                      </Text>
                    )}
                  </View>
                </View>
                {!!post.content && (
                  <Text style={[type.body, { color: 'rgba(255,255,255,0.95)', lineHeight: 21 }]} numberOfLines={2}>
                    {post.content}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View style={{ padding: 18 }}>
              <View style={[styles.author, { marginBottom: 12 }]}>
                <Avatar uri={post.avatar} name={author} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{author}</Text>
                  {!!post.title && (
                    <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={1}>{post.title}</Text>
                  )}
                </View>
              </View>
              {!!post.content && (
                <Text style={[type.body, { color: t.textSecondary, lineHeight: 22 }]} numberOfLines={3}>
                  {post.content}
                </Text>
              )}
            </View>
          )}

          <View style={[styles.foot, { borderTopColor: t.divider }]}>
            <View style={styles.stat}>
              <Icon name="beer-outline" size={14} color={t.textMuted} />
              <Text style={[type.caption, { color: t.textMuted }]}>{post.cheer_count || 0}</Text>
            </View>
            <View style={styles.stat}>
              <Icon name="chatbubble-outline" size={13} color={t.textMuted} />
              <Text style={[type.caption, { color: t.textMuted }]}>{post.comment_count || 0}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={[type.caption, { color: t.accent, fontWeight: '700' }]}>Read the moment</Text>
            <Icon name="arrow-forward" size={13} color={t.accent} />
          </View>
        </View>
      </Bounce>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 16, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  card: { marginHorizontal: 16, borderRadius: radius.lg, borderWidth: 1.5, overflow: 'hidden' },
  media: { width: '100%', height: 220 },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 8 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  foot: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
