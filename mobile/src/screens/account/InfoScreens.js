// src/screens/account/InfoScreens.js
// Static content screens: help, responsible drinking, and legal.

import React from 'react';
import { View, Text, ScrollView, Linking, StyleSheet } from 'react-native';
import { ORIGIN } from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Icon } from '../../components/ui';
import { SettingsGroup, SettingsRow } from '../../components/SettingsRow';

const FAQ = [
  { q: 'What counts as a “pour”?', a: 'Anything you’re drinking — a dram, a pint, a natural wine, or a very serious coffee. Share it with a note and a photo.' },
  { q: 'Why do I need to verify my email?', a: 'It keeps the bar free of bots and lets us send you a password reset if you ever need one.' },
  { q: 'How do streaks work?', a: 'A streak counts consecutive days you take part in the community — posting, cheering, commenting. It never counts how much you drink.' },
  { q: 'Can I use DrinkedInn without drinking?', a: 'Absolutely. Mocktails, coffee, and kombucha are all welcome. Nobody is checking your glass.' },
];

export function HelpScreen({ navigation }) {
  const { t } = useTheme();
  return (
    <Screen>
      <Header title="Help & FAQ" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {FAQ.map((f) => (
          <View key={f.q} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[type.h3, { color: t.text, marginBottom: 6 }]}>{f.q}</Text>
            <Text style={[type.body, { color: t.textSecondary, lineHeight: 21 }]}>{f.a}</Text>
          </View>
        ))}
        <SettingsGroup title="Still stuck?">
          <SettingsRow
            icon="mail-outline"
            label="Email support"
            onPress={() => Linking.openURL('mailto:hello@drinkedinn.app?subject=DrinkedInn%20support').catch(() => {})}
            last
          />
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}

export function ResponsibleScreen({ navigation }) {
  const { t } = useTheme();
  const points = [
    { icon: 'moon-outline', title: 'Quiet hours', body: 'We never send you a push between 10pm and 8am your local time.' },
    { icon: 'notifications-off-outline', title: 'Capped nudges', body: 'A hard limit of a few notifications a day — no endless pinging.' },
    { icon: 'flame-outline', title: 'Streaks reward company, not volume', body: 'Streaks count days you took part in the community. They never count drinks.' },
    { icon: 'shield-checkmark-outline', title: '18+ only', body: 'Date of birth is checked at sign-up and the age gate is enforced server-side.' },
  ];
  return (
    <Screen>
      <Header title="Drink responsibly" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={[type.body, { color: t.textSecondary, lineHeight: 22, marginBottom: 20 }]}>
          DrinkedInn is about enjoying good drinks with good people — never about drinking more.
          These limits are built into the product, not just the policy.
        </Text>
        {points.map((p) => (
          <View key={p.title} style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={[styles.rowIcon, { backgroundColor: t.accentSoft }]}>
              <Icon name={p.icon} size={17} color={t.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.h3, { color: t.text }]}>{p.title}</Text>
              <Text style={[type.caption, { color: t.textSecondary, marginTop: 3, lineHeight: 18 }]}>{p.body}</Text>
            </View>
          </View>
        ))}
        <View style={[styles.card, { backgroundColor: t.accentSoft, borderColor: t.accentBorder, marginTop: 8 }]}>
          <Text style={[type.label, { color: t.text, marginBottom: 4 }]}>Need support?</Text>
          <Text style={[type.caption, { color: t.textSecondary, lineHeight: 18 }]}>
            If drinking stops being fun, talk to someone. Drinkaware and similar services offer free, confidential help.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

export function LegalScreen({ navigation }) {
  return (
    <Screen>
      <Header title="Terms & policies" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingVertical: 8, paddingBottom: 60 }}>
        <SettingsGroup title="Documents">
          <SettingsRow icon="document-text-outline" label="Terms of service" onPress={() => Linking.openURL(`${ORIGIN}/terms`).catch(() => {})} />
          <SettingsRow icon="shield-outline" label="Privacy policy" onPress={() => Linking.openURL(`${ORIGIN}/privacy`).catch(() => {})} />
          <SettingsRow icon="people-outline" label="Community guidelines" onPress={() => Linking.openURL(`${ORIGIN}/guidelines`).catch(() => {})} last />
        </SettingsGroup>
        <SettingsGroup title="About">
          <SettingsRow icon="information-circle-outline" label="Version" value="1.0.0" last />
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderRadius: radius.md, borderWidth: 1, padding: 14, marginBottom: 10 },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
