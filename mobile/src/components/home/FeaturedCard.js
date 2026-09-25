// src/components/home/FeaturedCard.js
// "Pour of the day" hero — the one editorial moment on an otherwise uniform feed.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { mediaUrl } from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Avatar, Icon, Bounce } from '../ui';

export default function FeaturedCard({ post, onPress }) {
  const { t, elevation } = useTheme();
  if (!post) return null;

  const img = mediaUrl(post.image_url);

  return (
    <View style={{ marginBottom: 18 }}>
      <View style={styles.labelRow}>
        <Icon name="trophy" size={14} color={t.accent} />
        <Text style={[type.overline, { color: t.accent, textTransform: 'uppercase' }]}>Pour of the day</Text>
      </View>

      <Bounce onPress={() => onPress?.(post)} haptic="light" scaleTo={0.98}>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.accentBorder }, elevation(t, 2)]}>
          {img ? (
            <View>
              <Image source={{ uri: img }} style={styles.image} contentFit="cover" transition={250} cachePolicy="memory-disk" />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.78)']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.overlay}>
                <View style={styles.author}>
                  <Avatar uri={post.avatar} name={post.name} size={30} />
                  <Text style={[type.bodyStrong, { color: '#fff' }]} numberOfLines={1}>{post.name}</Text>
                </View>
                <Text style={[type.body, { color: 'rgba(255,255,255,0.94)', lineHeight: 20 }]} numberOfLines={2}>
                  {post.content}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ padding: 16 }}>
              <View style={[styles.author, { marginBottom: 10 }]}>
                <Avatar uri={post.avatar} name={post.name} size={32} />
                <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{post.name}</Text>
              </View>
              <Text style={[type.body, { color: t.textSecondary, lineHeight: 21 }]} numberOfLines={3}>
                {post.content}
              </Text>
            </View>
          )}

          <View style={[styles.foot, { borderTopColor: t.divider }]}>
            <View style={styles.stat}>
              <Icon name="beer-outline" size={15} color={t.textMuted} />
              <Text style={[type.caption, { color: t.textMuted }]}>{post.cheer_count || 0}</Text>
            </View>
            <View style={styles.stat}>
              <Icon name="chatbubble-outline" size={14} color={t.textMuted} />
              <Text style={[type.caption, { color: t.textMuted }]}>{post.comment_count || 0}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={[type.caption, { color: t.accent, fontWeight: '600' }]}>Read pour</Text>
            <Icon name="arrow-forward" size={13} color={t.accent} />
          </View>
        </View>
      </Bounce>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 8 },
  card: { marginHorizontal: 16, borderRadius: radius.lg, borderWidth: 1.5, overflow: 'hidden' },
  image: { width: '100%', height: 220 },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 8 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
