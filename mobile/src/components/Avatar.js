// src/components/Avatar.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { mediaUrl } from '../api';
import { colors, gradients } from '../theme';

export default function Avatar({ uri, name = '?', size = 44, ring = false, seed }) {
  const src = uri
    ? mediaUrl(uri)
    : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || name)}&backgroundColor=b45309,d97706`;

  const inner = (
    <Image
      source={{ uri: src }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.cardAlt }}
      contentFit="cover"
      transition={220}
    />
  );

  if (!ring) return inner;

  const pad = 2.5;
  return (
    <LinearGradient
      colors={gradients.story}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size + pad * 2 + 3, height: size + pad * 2 + 3, borderRadius: (size + pad * 2 + 3) / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={[styles.ringInner, { width: size + pad * 2, height: size + pad * 2, borderRadius: (size + pad * 2) / 2 }]}>
        {inner}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  ringInner: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
