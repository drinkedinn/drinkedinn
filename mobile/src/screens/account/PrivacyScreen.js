// src/screens/account/PrivacyScreen.js
// Data transparency + the destructive account actions app stores require.

import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, StyleSheet, Linking } from 'react-native';
import api, { ORIGIN } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Icon, Button, useToast } from '../../components/ui';
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
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');

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

  const confirmDelete = async () => {
    if (!password) { toast?.show('Enter your password to confirm.', 'error'); return; }
    setBusy(true);
    try {
      // axios needs `data` for a DELETE body.
      await api.delete('/users/me', { data: { password } });
      toast?.show('Your account has been deleted.', 'success');
      logout();
    } catch (e) {
      toast?.show(e.safeMessage || 'Could not delete the account.', 'error');
      setBusy(false);
    }
  };

  const startDelete = () => {
    Alert.alert(
      'Delete account',
      'This permanently erases your profile, pours, comments, photos and connections. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: () => setConfirming(true) },
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

        {confirming ? (
          <View style={{ marginBottom: 26 }}>
            <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginBottom: 8, marginLeft: 20 }]}>
              Danger zone
            </Text>
            <View style={[styles.card, { borderColor: t.danger }]}>
              <Text style={[type.h3, { color: t.danger, marginBottom: 6 }]}>Confirm deletion</Text>
              <Text style={[type.caption, { color: t.textSecondary, lineHeight: 18, marginBottom: 14 }]}>
                Enter your password to permanently erase your account. Everything you've posted goes
                with it, and this can't be undone.
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={t.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                style={{
                  backgroundColor: t.surfaceAlt, borderColor: t.border, borderWidth: 1.4,
                  borderRadius: radius.sm, paddingHorizontal: 13, paddingVertical: 12,
                  color: t.text, fontSize: 15, marginBottom: 12,
                }}
              />
              <Button label="Delete my account forever" variant="danger" full loading={busy} onPress={confirmDelete} />
              <Button
                label="Keep my account"
                variant="secondary"
                full
                style={{ marginTop: 8 }}
                onPress={() => { setConfirming(false); setPassword(''); }}
              />
            </View>
          </View>
        ) : (
          <SettingsGroup title="Danger zone" footer="Deleting your account is permanent and immediate.">
            <SettingsRow icon="trash-outline" label="Delete my account" destructive onPress={startDelete} disabled={busy} last />
          </SettingsGroup>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, borderRadius: radius.md, borderWidth: 1, padding: 16 },
  fact: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', marginBottom: 12 },
  factIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
});
