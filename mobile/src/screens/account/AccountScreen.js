// src/screens/account/AccountScreen.js
// The account hub: identity card, quick stats, and every settings entry point.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Avatar, Icon, Bounce, Button } from '../../components/ui';
import { SettingsGroup, SettingsRow } from '../../components/SettingsRow';
import { isBiometricAvailable, isLockEnabled } from '../../lib/appLock';
import api from '../../api';

function StatTile({ value, label, icon }) {
  const { t } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: t.surfaceAlt }]}>
      <Icon name={icon} size={16} color={t.accent} />
      <Text style={[type.h2, { color: t.text, marginTop: 6 }]}>{value ?? 0}</Text>
      <Text style={[type.caption, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

export default function AccountScreen({ navigation }) {
  const { t, mode, pref } = useTheme();
  const { user, logout, refresh } = useAuth();
  const [lockOn, setLockOn] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  const load = useCallback(async () => {
    setBioAvailable(await isBiometricAvailable());
    setLockOn(await isLockEnabled());
    try { await refresh(); } catch {}
  }, [refresh]);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation]);

  const confirmLogout = () => {
    Alert.alert('Log out', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  const themeLabel = pref === 'system' ? 'System' : pref === 'dark' ? 'Dark' : 'Light';

  return (
    <Screen>
      <Header title="Account" large border={false} />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Identity card */}
        <Bounce
          haptic={null}
          scaleTo={0.995}
          onPress={() => navigation.navigate('EditProfile')}
          style={[styles.identity, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <Avatar uri={user?.avatar} name={user?.name} size={62} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={styles.nameRow}>
              <Text style={[type.h2, { color: t.text }]} numberOfLines={1}>{user?.name}</Text>
              {!!user?.verified && <Icon name="checkmark-circle" size={16} color={t.blue} />}
              {!!user?.premium && <Icon name="star" size={14} color={t.accent} />}
            </View>
            <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
              {user?.title || 'DrinkedInn Member'}
            </Text>
            <Text style={[type.caption, { color: t.accent, marginTop: 6, fontWeight: '600' }]}>
              Edit profile
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={t.textMuted} />
        </Bounce>

        {/* Stats */}
        <View style={styles.stats}>
          <StatTile value={user?.connections} label="Connections" icon="people-outline" />
          <StatTile value={user?.postCount} label="Pours" icon="wine-outline" />
          <StatTile value={user?.current_streak} label="Day streak" icon="flame-outline" />
        </View>

        {!user?.email_verified && (
          <View style={[styles.notice, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
            <Icon name="mail-unread-outline" size={18} color={t.accentText} />
            <View style={{ flex: 1 }}>
              <Text style={[type.label, { color: t.text }]}>Verify your email</Text>
              <Text style={[type.caption, { color: t.textSecondary, marginTop: 2 }]}>
                Confirm your address to unlock posting everywhere.
              </Text>
            </View>
          </View>
        )}

        <SettingsGroup title="Your bar">
          <SettingsRow icon="wine-outline" label="My Bar" onPress={() => navigation.navigate('MyBar')} />
          <SettingsRow icon="bookmark-outline" label="Saved pours" onPress={() => navigation.navigate('Saved')} />
          <SettingsRow icon="ribbon-outline" label="Badges" onPress={() => navigation.navigate('Badges')} />
          <SettingsRow icon="gift-outline" label="Invite friends" onPress={() => navigation.navigate('Invite')} last />
        </SettingsGroup>

        <SettingsGroup title="Preferences">
          <SettingsRow icon="color-palette-outline" label="Appearance" value={themeLabel} onPress={() => navigation.navigate('Appearance')} />
          <SettingsRow icon="notifications-outline" label="Notifications" onPress={() => navigation.navigate('NotificationSettings')} last />
        </SettingsGroup>

        <SettingsGroup
          title="Security & privacy"
          footer="Your session token is stored in the device keychain, never in plain text."
        >
          <SettingsRow
            icon="lock-closed-outline"
            label="Security"
            value={lockOn ? 'App lock on' : bioAvailable ? 'App lock off' : undefined}
            onPress={() => navigation.navigate('Security')}
          />
          <SettingsRow icon="shield-checkmark-outline" label="Privacy & data" onPress={() => navigation.navigate('Privacy')} last />
        </SettingsGroup>

        <SettingsGroup title="Support">
          <SettingsRow icon="help-circle-outline" label="Help & FAQ" onPress={() => navigation.navigate('Help')} />
          <SettingsRow icon="heart-outline" label="Drink responsibly" onPress={() => navigation.navigate('Responsible')} />
          <SettingsRow icon="document-text-outline" label="Terms & policies" onPress={() => navigation.navigate('Legal')} last />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow icon="log-out-outline" label="Log out" destructive onPress={confirmLogout} last />
        </SettingsGroup>

        <Text style={[type.caption, { color: t.textMuted, textAlign: 'center', marginTop: 4 }]}>
          DrinkedInn v1.0.0 · 18+
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 14, padding: 16, borderRadius: radius.lg, borderWidth: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stats: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 24 },
  stat: { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  notice: { flexDirection: 'row', gap: 12, alignItems: 'center', marginHorizontal: 16, marginBottom: 22, padding: 14, borderRadius: radius.md, borderWidth: 1 },
});
