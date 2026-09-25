// src/components/ui/Header.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Bounce from './Pressable';
import Icon from './Icon';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';

export default function Header({ title, subtitle, onBack, right, large, border = true }) {
  const { t } = useTheme();
  return (
    <View style={[styles.wrap, border && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.divider }]}>
      <View style={styles.row}>
        {onBack && (
          <Bounce onPress={onBack} hitSlop={12} style={styles.back} accessibilityLabel="Go back">
            <Icon name="chevron-back" size={26} color={t.text} />
          </Bounce>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[large ? type.h1 : type.h2, { color: t.text }]} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>{subtitle}</Text>}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 },
  back: { marginLeft: -8, marginRight: 2, padding: 4 },
});
