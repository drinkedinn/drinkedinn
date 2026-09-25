// src/components/places/FriendsRail.js
// People first: the horizontal rail of connections who have been here. The
// server already excludes blocked accounts, and caps the list at 20.

import React, { memo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import { Avatar, Bounce } from '../ui';

function FriendsRail({ friends, onPress }) {
  const { t } = useTheme();
  const list = Array.isArray(friends) ? friends.filter((f) => f && f.id != null) : [];
  if (!list.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.track}
    >
      {list.map((f) => (
        <Bounce
          key={String(f.id)}
          onPress={() => onPress?.(f)}
          haptic="light"
          scaleTo={0.94}
          accessibilityLabel={`${f.name || 'Member'}, open profile`}
        >
          <View style={styles.person}>
            <Avatar uri={f.avatar} name={f.name || '?'} size={54} />
            <Text style={[type.caption, { color: t.textSecondary, marginTop: 7 }]} numberOfLines={1}>
              {String(f.name || 'Member').split(' ')[0]}
            </Text>
          </View>
        </Bounce>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: { paddingHorizontal: 16, gap: 14, paddingBottom: 2 },
  person: { width: 62, alignItems: 'center' },
});

export default memo(FriendsRail);
