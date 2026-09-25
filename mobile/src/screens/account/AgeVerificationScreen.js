// src/screens/account/AgeVerificationScreen.js
// Opens the provider's hosted age check in a secure browser session. The app
// never sees or stores an identity document — we poll our own API for the
// outcome, which only the provider's signed webhook can set.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, AppState } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Icon, Button, useToast } from '../../components/ui';

const LEVELS = {
  0: { label: 'Not verified', tone: 'muted', icon: 'help-circle-outline' },
  1: { label: 'Age verified', tone: 'ok', icon: 'checkmark-circle' },
  2: { label: 'Identity verified', tone: 'ok', icon: 'shield-checkmark' },
};

const PROMISES = [
  { icon: 'eye-off-outline', text: 'We never see or store your ID. Our verification partner handles it and tells us only whether you passed.' },
  { icon: 'time-outline', text: 'It takes under a minute and you only do it once.' },
  { icon: 'trash-outline', text: 'Delete your account and the verification record goes with it.' },
];

export default function AgeVerificationScreen({ navigation }) {
  const { t } = useTheme();
  const toast = useToast();

  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const polling = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/age/status');
      setStatus(res.data);
      return res.data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-check when the user comes back from the provider's page.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') load(); });
    return () => { sub.remove(); clearInterval(polling.current); };
  }, [load]);

  // The webhook can land a moment after the user returns, so poll briefly.
  const pollForResult = useCallback(() => {
    clearInterval(polling.current);
    let tries = 0;
    polling.current = setInterval(async () => {
      tries += 1;
      const s = await load();
      if ((s?.level || 0) > 0 || tries >= 10) {
        clearInterval(polling.current);
        setBusy(false);
        if ((s?.level || 0) > 0) toast?.show('Age verified. Thanks!', 'success');
      }
    }, 2000);
  }, [load, toast]);

  const start = async (method) => {
    setBusy(true);
    try {
      const res = await api.post('/age/session', { method });

      if (res.data.alreadyVerified) {
        toast?.show('You’re already verified.', 'info');
        await load();
        setBusy(false);
        return;
      }

      // Dev/stub provider resolves server-side with no hosted page.
      if (res.data.resolved) {
        await load();
        setBusy(false);
        toast?.show('Age verified.', 'success');
        return;
      }

      if (!res.data.url) throw new Error('No verification URL returned');
      await WebBrowser.openBrowserAsync(res.data.url, { dismissButtonStyle: 'cancel' });
      pollForResult();
    } catch (e) {
      setBusy(false);
      toast?.show(e.safeMessage || 'Could not start verification.', 'error');
    }
  };

  const level = status?.level || 0;
  const meta = LEVELS[level] || LEVELS[0];
  const toneColor = meta.tone === 'ok' ? t.success : t.textMuted;
  const toneBg = meta.tone === 'ok' ? t.successSoft : t.surfaceAlt;

  return (
    <Screen>
      <Header title="Age verification" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

        {/* Current state */}
        <View style={[styles.state, { backgroundColor: toneBg, borderColor: meta.tone === 'ok' ? t.success : t.border }]}>
          <Icon name={meta.icon} size={26} color={toneColor} />
          <View style={{ flex: 1 }}>
            <Text style={[type.h3, { color: t.text }]}>{meta.label}</Text>
            <Text style={[type.caption, { color: t.textSecondary, marginTop: 3 }]}>
              {level > 0
                ? 'You have full access to age-restricted content.'
                : status?.required
                  ? `Your country requires a verified age check.`
                  : 'Optional — unlocks brand content and early access.'}
            </Text>
          </View>
        </View>

        {status && !status.available && (
          <View style={[styles.notice, { backgroundColor: t.dangerSoft, borderColor: t.danger }]}>
            <Icon name="alert-circle-outline" size={17} color={t.danger} />
            <Text style={[type.caption, { color: t.textSecondary, flex: 1 }]}>
              Verification isn’t available right now. Try again later.
            </Text>
          </View>
        )}

        {level === 0 && (
          <>
            <Text style={[type.body, { color: t.textSecondary, lineHeight: 22, marginTop: 22, marginBottom: 18 }]}>
              {status?.minAge
                ? `You told us you're over ${status.minAge}. A quick check confirms it, so we can show you age-restricted content responsibly.`
                : 'A quick check confirms your age so we can show age-restricted content responsibly.'}
            </Text>

            {PROMISES.map((p) => (
              <View key={p.text} style={styles.promise}>
                <View style={[styles.promiseIcon, { backgroundColor: t.accentSoft }]}>
                  <Icon name={p.icon} size={15} color={t.accent} />
                </View>
                <Text style={[type.caption, { color: t.textSecondary, flex: 1, lineHeight: 18 }]}>{p.text}</Text>
              </View>
            ))}

            <View style={{ gap: 10, marginTop: 26 }}>
              <Button
                label="Verify with a selfie"
                icon="scan-outline"
                onPress={() => start('estimation')}
                loading={busy}
                disabled={!status?.available}
                full
              />
              <Text style={[type.caption, { color: t.textMuted, textAlign: 'center' }]}>
                No document needed — estimates your age band from a photo.
              </Text>

              <Button
                label="Verify with photo ID"
                icon="card-outline"
                variant="secondary"
                onPress={() => start('document')}
                disabled={busy || !status?.available}
                full
                style={{ marginTop: 10 }}
              />
              <Text style={[type.caption, { color: t.textMuted, textAlign: 'center' }]}>
                Use this if the selfie check can’t confirm your age.
              </Text>
            </View>
          </>
        )}

        {level > 0 && (
          <View style={[styles.done, { borderColor: t.border }]}>
            <Text style={[type.caption, { color: t.textMuted, lineHeight: 18 }]}>
              Verified {status?.verifiedAt ? new Date(status.verifiedAt).toLocaleDateString() : 'recently'}.
              We hold only the result of this check — no photo, no document, no ID number.
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.md, borderWidth: 1.5, padding: 16 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, borderWidth: 1, padding: 13, marginTop: 12 },
  promise: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', marginBottom: 12 },
  promiseIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  done: { borderRadius: radius.md, borderWidth: 1, padding: 14, marginTop: 22 },
});
