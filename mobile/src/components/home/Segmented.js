// src/components/home/Segmented.js
// Sliding segmented control for the feed tabs. The thumb animates between
// segments rather than snapping, which is what makes it read as native.

import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';

export default function Segmented({ options, value, onChange }) {
  const { t } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const x = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.spring(x, { toValue: index, useNativeDriver: true, speed: 22, bounciness: 5 }).start();
  }, [index]);

  const seg = width / options.length;

  return (
    <View
      style={[styles.track, { backgroundColor: t.surfaceAlt }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}
    >
      {width > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: seg,
              backgroundColor: t.surface,
              borderColor: t.border,
              transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, seg] }) }],
            },
          ]}
        />
      )}
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            style={styles.seg}
            onPress={() => {
              if (active) return;
              try { Haptics.selectionAsync(); } catch {}
              onChange(o.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[type.label, { color: active ? t.text : t.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, marginHorizontal: 16, position: 'relative' },
  thumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
});
