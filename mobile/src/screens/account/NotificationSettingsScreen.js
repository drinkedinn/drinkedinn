// src/screens/account/NotificationSettingsScreen.js
import React, { useState, useEffect } from 'react';
import { ScrollView, ActivityIndicator, View } from 'react-native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { Screen, Header, useToast } from '../../components/ui';
import { SettingsGroup, SettingsRow } from '../../components/SettingsRow';

const ITEMS = [
  { key: 'cheers', icon: 'beer-outline', label: 'Cheers on your pours' },
  { key: 'comments', icon: 'chatbubble-outline', label: 'Comments and replies' },
  { key: 'connections', icon: 'people-outline', label: 'New connections' },
  { key: 'messages', icon: 'mail-outline', label: 'Direct messages' },
  { key: 'challenges', icon: 'trophy-outline', label: 'Challenge updates' },
];

export default function NotificationSettingsScreen({ navigation }) {
  const { t } = useTheme();
  const toast = useToast();
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/notifprefs');
        setPrefs(res.data || {});
      } catch {
        setPrefs({ cheers: 1, comments: 1, connections: 1, messages: 1, challenges: 1, digest_email: 1 });
      }
    })();
  }, []);

  const update = async (key, value) => {
    const next = { ...prefs, [key]: value ? 1 : 0 };
    setPrefs(next);
    setSaving(true);
    try {
      await api.put('/notifprefs', next);
    } catch (e) {
      setPrefs(prefs);
      toast?.show(e.safeMessage || 'Could not save preference.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) {
    return (
      <Screen>
        <Header title="Notifications" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Notifications" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingVertical: 8, paddingBottom: 60 }}>
        <SettingsGroup
          title="Push & in-app"
          footer="We never send push between 10pm and 8am your time, and cap it at a few a day."
        >
          {ITEMS.map((it, i) => (
            <SettingsRow
              key={it.key}
              icon={it.icon}
              label={it.label}
              toggle
              toggleValue={prefs[it.key] !== 0}
              onToggle={(v) => update(it.key, v)}
              last={i === ITEMS.length - 1}
            />
          ))}
        </SettingsGroup>

        <SettingsGroup title="Email" footer="A short recap of what you missed — never more than one a day.">
          <SettingsRow
            icon="newspaper-outline"
            label="Re-engagement digest"
            toggle
            toggleValue={prefs.digest_email !== 0}
            onToggle={(v) => update('digest_email', v)}
            last
          />
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}
