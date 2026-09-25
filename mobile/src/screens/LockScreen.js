// src/screens/LockScreen.js
// Shown when biometric app lock is enabled and the app resumes from background.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { radius, type } from '../theme/tokens';
import { Icon, Button } from '../components/ui';
import { biometricLabel } from '../lib/appLock';

export default function LockScreen() {
  const { t } = useTheme();
  const { unlock, logout } = useAuth();
  const [label, setLabel] = useState('Biometrics');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      setLabel(await biometricLabel());
      const ok = await unlock();
      if (!ok) setFailed(true);
    })();
  }, []);

  const retry = async () => {
    setFailed(false);
    const ok = await unlock();
    if (!ok) setFailed(true);
  };

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={[styles.badge, { backgroundColor: t.accentSoft }]}>
        <Icon name="lock-closed" size={34} color={t.accent} />
      </View>
      <Text style={[type.h1, { color: t.text, marginTop: 22 }]}>DrinkedInn is locked</Text>
      <Text style={[type.body, { color: t.textSecondary, marginTop: 8, textAlign: 'center' }]}>
        {failed ? `Unlock with ${label} to continue.` : `Waiting for ${label}…`}
      </Text>

      <View style={{ marginTop: 28, width: '100%', maxWidth: 260, gap: 10 }}>
        <Button label={`Unlock with ${label}`} icon="finger-print-outline" onPress={retry} full />
        <Button label="Log out instead" variant="secondary" onPress={logout} full />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  badge: { width: 78, height: 78, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
});
