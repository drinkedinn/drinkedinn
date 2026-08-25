// src/components/ui/Avatar.js
import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { mediaUrl } from '../../api';
import { useTheme } from '../../theme/ThemeContext';

export default function Avatar({ uri, name = '?', size = 44, ring = false }) {
  const { t } = useTheme();
  const src = uri
    ? mediaUrl(uri)
    : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=C8831F,A96A14`;

  const img = (
    <Image
      source={{ uri: src }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.surfaceAlt }}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
    />
  );

  if (!ring) return img;

  const outer = size + 7;
  return (
    <LinearGradient
      colors={[t.accent, '#D9698A', '#7B61C9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: outer, height: outer, borderRadius: outer / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: size + 3.5, height: size + 3.5, borderRadius: (size + 3.5) / 2,
          backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center',
        }}
      >
        {img}
      </View>
    </LinearGradient>
  );
}
