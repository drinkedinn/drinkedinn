// src/components/taste/CollectionRow.js
// A shelf row in the Collection tab. Name + secondary line + optional notes;
// trailing overflow menu opens Delete confirmation.

import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import { mediaUrl } from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

export default function CollectionRow({ item, onDelete }) {
  const { t, elevation } = useTheme();
  const img = mediaUrl(item?.image_url);
  const name = item?.name || 'Unnamed bottle';
  const secondary =
    [item?.distillery, item?.vintage].filter(Boolean).join(' · ') || item?.drink_type || '';
  const score = Number(item?.rating) || 0;

  const openMenu = () => {
    Alert.alert(name, 'Manage this bottle', [
      {
        text: 'Remove from shelf',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Remove this bottle?', 'You can always add it back.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => onDelete?.(item) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
      {img ? (
        <Image source={{ uri: img }} style={styles.img} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.img, { backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}>
          <Icon name="wine-outline" size={22} color={t.textMuted} />
        </View>
      )}

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{name}</Text>
        {!!secondary && (
          <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {secondary}
          </Text>
        )}
        {!!item?.notes && (
          <Text style={[type.caption, { color: t.textSecondary, marginTop: 5, lineHeight: 17 }]} numberOfLines={2}>
            {item.notes}
          </Text>
        )}
      </View>

      {score > 0 && (
        <View style={[styles.score, { backgroundColor: t.accentSoft }]}>
          <Text style={[type.label, { color: t.accentText, fontVariant: ['tabular-nums'] }]}>
            {score.toFixed(1)}
          </Text>
        </View>
      )}

      <Bounce onPress={openMenu} haptic="light" hitSlop={10} scaleTo={0.85} accessibilityLabel="More options" style={styles.menuBtn}>
        <Icon name="ellipsis-horizontal" size={18} color={t.textMuted} />
      </Bounce>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  img: { width: 56, height: 56, borderRadius: radius.md },
  score: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.sm,
    marginLeft: 8,
  },
  menuBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
});
