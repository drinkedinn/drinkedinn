// src/components/Logo.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../theme';

export default function Logo({ size = 22 }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.word, { fontSize: size }]}>Drinked</Text>
      <LinearGradient colors={gradients.blue} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chip}>
        <Text style={[styles.chipText, { fontSize: size - 3 }]}>Inn 🍺</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  word: { color: colors.text, fontWeight: '900', letterSpacing: -0.5 },
  chip: { marginLeft: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 7 },
  chipText: { color: '#fff', fontWeight: '900', letterSpacing: -0.3 },
});
