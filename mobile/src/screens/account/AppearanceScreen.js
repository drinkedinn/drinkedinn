// src/screens/account/AppearanceScreen.js
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { light, dark, radius, type } from '../../theme/tokens';
import { Screen, Header, Icon, Bounce } from '../../components/ui';

function Swatch({ palette, label, selected, onPress }) {
  const { t } = useTheme();
  return (
    <Bounce onPress={onPress} haptic="light" scaleTo={0.97} style={{ flex: 1 }}>
      <View style={[styles.preview, { backgroundColor: palette.bg, borderColor: selected ? t.accent : t.border, borderWidth: selected ? 2 : 1 }]}>
        <View style={[styles.bar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={[styles.dot, { backgroundColor: palette.accent }]} />
          <View style={{ flex: 1 }}>
            <View style={[styles.line, { backgroundColor: palette.text, width: '55%' }]} />
            <View style={[styles.line, { backgroundColor: palette.textMuted, width: '35%', marginTop: 4 }]} />
          </View>
        </View>
        <View style={[styles.bar, { backgroundColor: palette.surface, borderColor: palette.border, marginTop: 6 }]}>
          <View style={[styles.dot, { backgroundColor: palette.blue }]} />
          <View style={{ flex: 1 }}>
            <View style={[styles.line, { backgroundColor: palette.text, width: '45%' }]} />
          </View>
        </View>
      </View>
      <View style={styles.labelRow}>
        {selected ? <Icon name="radio-button-on" size={17} color={t.accent} /> : <Icon name="radio-button-off" size={17} color={t.textMuted} />}
        <Text style={[type.label, { color: selected ? t.text : t.textSecondary }]}>{label}</Text>
      </View>
    </Bounce>
  );
}

export default function AppearanceScreen({ navigation }) {
  const { t, pref, setThemePref } = useTheme();

  return (
    <Screen>
      <Header title="Appearance" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={[type.body, { color: t.textSecondary, marginBottom: 20, lineHeight: 21 }]}>
          Pick how DrinkedInn looks. Light is the default — dark suits late pours.
        </Text>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Swatch palette={light} label="Light" selected={pref === 'light'} onPress={() => setThemePref('light')} />
          <Swatch palette={dark} label="Dark" selected={pref === 'dark'} onPress={() => setThemePref('dark')} />
        </View>

        <Bounce onPress={() => setThemePref('system')} haptic="light" scaleTo={0.99} style={{ marginTop: 18 }}>
          <View style={[styles.systemRow, { backgroundColor: t.surface, borderColor: pref === 'system' ? t.accent : t.border, borderWidth: pref === 'system' ? 2 : 1 }]}>
            <Icon name="phone-portrait-outline" size={19} color={t.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: t.text }]}>Match device</Text>
              <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>Follows your system setting automatically</Text>
            </View>
            <Icon name={pref === 'system' ? 'radio-button-on' : 'radio-button-off'} size={19} color={pref === 'system' ? t.accent : t.textMuted} />
          </View>
        </Bounce>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { borderRadius: radius.md, padding: 12, height: 130, justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, padding: 8 },
  dot: { width: 18, height: 18, borderRadius: 9 },
  line: { height: 5, borderRadius: 3, opacity: 0.75 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center', marginTop: 10 },
  systemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, padding: 16 },
});
