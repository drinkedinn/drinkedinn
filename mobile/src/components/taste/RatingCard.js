// src/components/taste/RatingCard.js
// A rating row in the Ratings tab. Collapsed by default; tap to reveal the
// full nose / palate / finish notes. A trailing overflow button opens a menu
// with Delete (this is the user's own shelf — the menu is delete-only for now).

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, Animated } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce } from '../ui';

function NoteRow({ label, value, t }) {
  if (!value) return null;
  return (
    <View style={styles.noteRow}>
      <Text style={[type.overline, { color: t.textMuted, width: 54, textTransform: 'uppercase' }]}>
        {label}
      </Text>
      <Text style={[type.body, { color: t.textSecondary, flex: 1, lineHeight: 21 }]}>
        {value}
      </Text>
    </View>
  );
}

export default function RatingCard({ item, onDelete }) {
  const { t, elevation } = useTheme();
  const [open, setOpen] = useState(false);
  const chev = useRef(new Animated.Value(0)).current;

  const hasNotes = !!(item?.nose || item?.palate || item?.finish);
  const name = item?.drink_name || 'Unnamed pour';
  const meta = [item?.drink_type, item?.distillery].filter(Boolean).join(' · ');
  const score = Number(item?.rating) || 0;

  const toggle = () => {
    if (!hasNotes) return;
    Animated.spring(chev, { toValue: open ? 0 : 1, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
    setOpen((o) => !o);
  };

  const openMenu = () => {
    Alert.alert(
      name,
      'Manage this rating',
      [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Delete this rating?', 'You can always add it back later.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(item) },
            ]),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <Bounce
      haptic={hasNotes ? 'light' : null}
      scaleTo={0.995}
      onPress={toggle}
      accessibilityLabel={`${name}, ${score.toFixed(1)} out of 10`}
      style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}
    >
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{name}</Text>
          {!!meta && (
            <Text style={[type.caption, { color: t.textMuted, marginTop: 3 }]} numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>

        <View style={[styles.score, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
          <Text style={[type.h3, { color: t.accentText, fontVariant: ['tabular-nums'] }]}>
            {score.toFixed(1)}
          </Text>
          <Text style={[type.caption, { color: t.accentText, opacity: 0.7 }]}>/10</Text>
        </View>

        <Bounce
          onPress={openMenu}
          haptic="light"
          hitSlop={10}
          scaleTo={0.85}
          accessibilityLabel="More options"
          style={styles.menuBtn}
        >
          <Icon name="ellipsis-horizontal" size={18} color={t.textMuted} />
        </Bounce>
      </View>

      {hasNotes && (
        <View style={styles.footer}>
          <Animated.View style={{ transform: [{ rotate: chev.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
            <Icon name="chevron-down" size={15} color={t.textMuted} />
          </Animated.View>
          <Text style={[type.caption, { color: t.textMuted, marginLeft: 4 }]}>
            {open ? 'Hide notes' : 'Tasting notes'}
          </Text>
        </View>
      )}

      {open && hasNotes && (
        <View style={[styles.notes, { borderTopColor: t.divider }]}>
          <NoteRow label="Nose" value={item.nose} t={t} />
          <NoteRow label="Palate" value={item.palate} t={t} />
          <NoteRow label="Finish" value={item.finish} t={t} />
        </View>
      )}
    </Bounce>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  score: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 2,
  },
  menuBtn: {
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
    marginRight: -4,
  },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  notes: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
