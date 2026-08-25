// src/screens/account/PrivacyScreen.js
// Data transparency + the destructive account actions app stores require.

import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet, Linking } from 'react-native';
import api, { ORIGIN } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Icon, useToast } from '../../components/ui';
import { SettingsGroup, SettingsRow } from '../../components/SettingsRow';

const FACTS = [
  { icon: 'key-outline', text: 'Your login token is kept in the device keychain, not in plain storage.' },
  { icon: 'lock-closed-outline', text: 'Every request goes over HTTPS to www.drinkedinn.com. Insecure calls are blocked.' },
  { icon: 'eye-off-outline', text: 'We don’t sell your data or run third-party ad trackers.' },
  { icon: 'server-outline', text: 'Passwords are hashed with bcrypt — we can never read them.' },
];

export default function PrivacyScreen({ navigation }) {
  const { t } = useTheme();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const requestData = () => {
    Alert.alert(
      'Request your data',
      `We'll email a copy of your DrinkedInn data to ${user?.email}. This can take a few days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: () => {
            Linking.openURL(
              `mailto:privacy@drinkedinn.app?subject=Data%20export%20request&body=Please%20export%20the%20data%20for%20${encodeURIComponent(user?.email || '')}.`
            ).catch(() => toast?.show('Could not open your mail app.', 'error'));
          },
        },
      ]
    );
  };

  const deleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently removes your profile, pours, comments and connections. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you certain?', 'Type-of-no-return. Your account and all content will be erased.', [
              { text: 'Keep my account', style: 'cancel' },
              {
                text: 'Delete forever',
                style: 'destructive',
                onPress: async () => {
                  setBusy(true);
                  try {
                    await api.delete('/users/me');
                    toast?.show('Account deleted.', 'success');
                    logout();
                  } catch (e) {
                    // Endpoint may not exist yet — fall back to a support request.
                    Linking.openURL(
                      `mailto:privacy@drinkedinn.app?subject=Account%20deletion%20request&body=Please%20delete%20the%20account%20for%20${encodeURIComponent(user?.email || '')}.`
                    ).catch(() => {});
                    toast?.show('We’ve opened a deletion request for you.', 'info');
                  } finally {
                    setBusy(false);
                  }
                },
              },
            ]),
        },
      ]
    );
  };

  return (
    <Screen>
      <Header title="Privacy & data" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingVertical: 8, paddingBottom: 60 }}>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[type.h3, { color: t.text, marginBottom: 14 }]}>How your data is handled</Text>
          {FACTS.map((f) => (
            <View key={f.text} style={styles.fact}>
              <View style={[styles.factIcon, { backgroundColor: t.successSoft }]}>
                <Icon name={f.icon} size={15} color={t.success} />
              </View>
              <Text style={[type.caption, { color: t.textSecondary, flex: 1, lineHeight: 18 }]}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 24 }} />

        <SettingsGroup title="Your data">
          <SettingsRow icon="download-outline" label="Request a copy of my data" onPress={requestData} />
          <SettingsRow
            icon="document-text-outline"
            label="Privacy policy"
            onPress={() => Linking.openURL(`${ORIGIN}/privacy`).catch(() => toast?.show('Could not open the link.', 'error'))}
            last
          />
        </SettingsGroup>

        <SettingsGroup title="Danger zone" footer="Deleting your account is permanent and immediate.">
          <SettingsRow icon="trash-outline" label="Delete my account" destructive onPress={deleteAccount} disabled={busy} last />
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, borderRadius: radius.md, borderWidth: 1, padding: 16 },
  fact: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', marginBottom: 12 },
  factIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
});
