// src/components/SettingsRow.js
import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { radius, type } from '../theme/tokens';
import { Icon, Bounce } from './ui';

export function SettingsGroup({ title, children, footer }) {
  const { t } = useTheme();
  return (
    <View style={{ marginBottom: 26 }}>
      {!!title && (
        <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginBottom: 8, marginLeft: 20 }]}>
          {title}
        </Text>
      )}
      <View style={[styles.group, { backgroundColor: t.surface, borderColor: t.border }]}>{children}</View>
      {!!footer && (
        <Text style={[type.caption, { color: t.textMuted, marginTop: 8, marginHorizontal: 20, lineHeight: 17 }]}>
          {footer}
        </Text>
      )}
    </View>
  );
}

export function SettingsRow({
  icon, label, value, onPress, toggle, toggleValue, onToggle,
  destructive, last, disabled, badge,
}) {
  const { t } = useTheme();
  const tint = destructive ? t.danger : t.text;

  const content = (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.divider }]}>
      {!!icon && (
        <View style={[styles.iconWrap, { backgroundColor: destructive ? t.dangerSoft : t.surfaceAlt }]}>
          <Icon name={icon} size={17} color={destructive ? t.danger : t.textSecondary} />
        </View>
      )}
      <Text style={[type.body, { color: tint, flex: 1 }]}>{label}</Text>

      {!!badge && (
        <View style={[styles.badge, { backgroundColor: t.accent }]}>
          <Text style={{ color: t.textOnAccent, fontSize: 11, fontWeight: '700' }}>{badge}</Text>
        </View>
      )}
      {!!value && <Text style={[type.caption, { color: t.textMuted, marginRight: 4 }]}>{value}</Text>}

      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={{ false: t.borderStrong, true: t.accent }}
          thumbColor="#fff"
          ios_backgroundColor={t.borderStrong}
        />
      ) : onPress ? (
        <Icon name="chevron-forward" size={17} color={t.textMuted} />
      ) : null}
    </View>
  );

  if (toggle || !onPress) return content;
  return <Bounce onPress={onPress} haptic="light" scaleTo={0.99} disabled={disabled}>{content}</Bounce>;
}

const styles = StyleSheet.create({
  group: { marginHorizontal: 16, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, minHeight: 52 },
  iconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginRight: 4 },
});

export default SettingsRow;
