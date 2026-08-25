// src/screens/account/SecurityScreen.js
// Password change, biometric app lock, and session revocation.

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Button, Icon, useToast } from '../../components/ui';
import { SettingsGroup, SettingsRow } from '../../components/SettingsRow';
import { isBiometricAvailable, isLockEnabled, setLockEnabled, authenticate, biometricLabel } from '../../lib/appLock';

function strength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

export default function SecurityScreen({ navigation }) {
  const { t } = useTheme();
  const { logout } = useAuth();
  const toast = useToast();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');
  const [lockOn, setLockOn] = useState(false);

  useEffect(() => {
    (async () => {
      setBioAvailable(await isBiometricAvailable());
      setBioLabel(await biometricLabel());
      setLockOn(await isLockEnabled());
    })();
  }, []);

  const toggleLock = async (value) => {
    if (value) {
      const ok = await authenticate(`Enable ${bioLabel} lock`);
      if (!ok) { toast?.show('Could not verify — lock not enabled.', 'error'); return; }
    }
    await setLockEnabled(value);
    setLockOn(value);
    toast?.show(value ? 'App lock enabled.' : 'App lock disabled.', 'success');
  };

  const score = strength(next);
  const bars = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const barColor = [t.danger, t.danger, t.warning, t.success, t.success][score];

  const changePassword = async () => {
    if (next.length < 8) { toast?.show('Use at least 8 characters.', 'error'); return; }
    if (next !== confirm) { toast?.show('New passwords don’t match.', 'error'); return; }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      toast?.show('Password changed. Other devices signed out.', 'success');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e) {
      toast?.show(e.safeMessage || 'Could not change password.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const signOutEverywhere = () => {
    Alert.alert(
      'Sign out everywhere',
      'This ends every active session, including this one. You’ll need to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out all',
          style: 'destructive',
          onPress: async () => {
            try { await api.post('/auth/logout-all'); } catch {}
            logout();
          },
        },
      ]
    );
  };

  const inputStyle = { backgroundColor: t.surface, borderColor: t.border, color: t.text };

  return (
    <Screen>
      <Header title="Security" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingVertical: 8, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

          <SettingsGroup
            title="App lock"
            footer={
              bioAvailable
                ? `Requires ${bioLabel} to reopen DrinkedInn after it’s been in the background.`
                : 'Set up a passcode or biometrics on your device to use app lock.'
            }
          >
            <SettingsRow
              icon="finger-print-outline"
              label={`Unlock with ${bioLabel}`}
              toggle
              toggleValue={lockOn}
              onToggle={toggleLock}
              disabled={!bioAvailable}
              last
            />
          </SettingsGroup>

          <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginLeft: 20, marginBottom: 8 }]}>
            Change password
          </Text>
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.inputRow}>
              <TextInput
                value={current}
                onChangeText={setCurrent}
                placeholder="Current password"
                placeholderTextColor={t.textMuted}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoComplete="current-password"
                style={[styles.input, inputStyle, { flex: 1 }]}
              />
            </View>
            <TextInput
              value={next}
              onChangeText={setNext}
              placeholder="New password"
              placeholderTextColor={t.textMuted}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete="new-password"
              style={[styles.input, inputStyle, { marginTop: 10 }]}
            />
            {!!next && (
              <View style={styles.meterRow}>
                <View style={[styles.meterTrack, { backgroundColor: t.surfaceAlt }]}>
                  <View style={{ width: `${(score / 4) * 100}%`, height: '100%', backgroundColor: barColor, borderRadius: 3 }} />
                </View>
                <Text style={[type.caption, { color: barColor }]}>{bars[score]}</Text>
              </View>
            )}
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm new password"
              placeholderTextColor={t.textMuted}
              secureTextEntry={!show}
              autoCapitalize="none"
              style={[styles.input, inputStyle, { marginTop: 10 }]}
            />
            <View style={styles.showRow}>
              <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={16} color={t.textMuted} />
              <Text onPress={() => setShow((s) => !s)} style={[type.caption, { color: t.textSecondary }]}>
                {show ? 'Hide passwords' : 'Show passwords'}
              </Text>
            </View>
            <Button
              label="Update password"
              onPress={changePassword}
              loading={busy}
              disabled={!current || !next || !confirm}
              full
              style={{ marginTop: 14 }}
            />
          </View>
          <Text style={[type.caption, { color: t.textMuted, marginTop: 8, marginHorizontal: 20, lineHeight: 17 }]}>
            Changing your password signs out every other device automatically.
          </Text>

          <View style={{ height: 26 }} />

          <SettingsGroup title="Sessions" footer="Use this if you've signed in on a device you no longer have.">
            <SettingsRow icon="log-out-outline" label="Sign out everywhere" destructive onPress={signOutEverywhere} last />
          </SettingsGroup>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, borderRadius: radius.md, borderWidth: 1, padding: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { borderRadius: radius.sm, borderWidth: 1.5, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  meterTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  showRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
});
