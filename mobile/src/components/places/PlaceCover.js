// src/components/places/PlaceCover.js
// The cover art for a place. Uses place.cover_url when there is one, and
// otherwise paints a deterministic token-gradient with the venue's monogram —
// so a place added thirty seconds ago still looks designed, not broken.

import React, { memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { mediaUrl } from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';
import { Icon } from '../ui';
import { categoryIcon, monogram } from './placeUtils';

// Stable per-place gradient so the same venue always looks the same.
function gradientFor(t, seed) {
  const pairs = [
    [t.accent, t.accentHover],
    [t.blue, t.accent],
    [t.accentHover, t.blue],
    [t.accent, t.blue],
    [t.blue, t.accentHover],
  ];
  const n = Math.abs(Number(seed) || 0) % pairs.length;
  return pairs[n];
}

function PlaceCover({
  place,
  height,
  size,
  rounded = radius.md,
  showMonogram = true,
  iconSize,
}) {
  const { t } = useTheme();
  const [failed, setFailed] = useState(false);

  // A refetch can hand us a different cover; don't hold a previous URL's
  // failure against it.
  useEffect(() => {
    setFailed(false);
  }, [place?.cover_url]);

  const box = size
    ? { width: size, height: size }
    : { width: '100%', height: height || 180 };

  const uri = !failed ? mediaUrl(place?.cover_url) : null;
  const glyph = iconSize || (size ? Math.round(size * 0.42) : 34);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[box, { borderRadius: rounded, backgroundColor: t.surfaceAlt }]}
        contentFit="cover"
        transition={220}
        cachePolicy="memory-disk"
        onError={() => setFailed(true)}
        accessible={false}
      />
    );
  }

  const [from, to] = gradientFor(t, place?.id);
  const letter = monogram(place?.name);

  return (
    <LinearGradient
      colors={[from, to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[box, styles.center, { borderRadius: rounded, overflow: 'hidden' }]}
    >
      {/* A soft scrim keeps the monogram legible against either gradient end. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.14)' }]} />
      {showMonogram ? (
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: size ? Math.round(size * 0.44) : 44,
            fontWeight: '800',
            letterSpacing: -1,
          }}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {letter}
        </Text>
      ) : (
        <Icon name={categoryIcon(place?.category)} size={glyph} color="#FFFFFF" />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});

export default memo(PlaceCover);
