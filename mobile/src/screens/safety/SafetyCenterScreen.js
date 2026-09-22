// src/screens/safety/SafetyCenterScreen.js
// The Safety Center — a destination, not a settings sub-page.
//
// Google Play's UGC policy requires reporting and blocking to be accessible and
// published guidelines to be reachable in-app; for Social apps it additionally
// requires a published child-safety standard, an in-app reporting mechanism for
// child sexual abuse and exploitation, and a designated contact — whether or
// not the app admits minors. Everything on that list lives on this one screen
// so a reviewer, and more importantly a member in a bad moment, finds it fast.

import React, { useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import { Screen, Header, useToast } from '../../components/ui';
import { SettingsGroup, SettingsRow } from '../../components/SettingsRow';
import SafetyNotice from '../../components/safety/SafetyNotice';
import { SAFETY_EMAIL } from '../../components/safety/reportCatalog';
import {
  openChildSafetyStandards,
  openGuidelines,
  openSafetyMail,
} from '../../components/safety/safetyLinks';
import useReportRouter from './useReportRouter';
import track from '../../lib/track';

export default function SafetyCenterScreen({ navigation }) {
  const { t } = useTheme();
  const toast = useToast();
  const { openReportPicker } = useReportRouter(navigation);

  useEffect(() => { track('safety_center_open'); }, []);

  const openLink = useCallback(
    async (open, name) => {
      const ok = await open();
      if (!ok) toast?.show(`Could not open the ${name}.`, 'error');
    },
    [toast]
  );

  const contactSafety = useCallback(async () => {
    if (!(await openSafetyMail('Safety'))) {
      toast?.show(`Could not open your mail app. Write to ${SAFETY_EMAIL}.`, 'error');
    }
  }, [toast]);

  return (
    <Screen>
      <Header
        title="Safety Center"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <ScrollView
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <SafetyNotice
          icon="shield-outline"
          title="Everyone here is a person first"
          body="If someone crosses a line, tell us. Reports are private — we never say who filed one — and blocking takes effect the moment you tap it."
          style={{ marginBottom: 24 }}
        />

        <SettingsGroup
          title="Report"
          footer="Child-safety reports go to a dedicated queue. They are never merged, never auto-closed, and a person reads every one."
        >
          <SettingsRow
            icon="flag-outline"
            label="Report something"
            onPress={openReportPicker}
          />
          <SettingsRow
            icon="alert-circle-outline"
            label="Report a child-safety concern"
            destructive
            onPress={() => navigation.navigate('ChildSafetyReport')}
            last
          />
        </SettingsGroup>

        <SettingsGroup
          title="Your controls"
          footer="Blocking hides the two of you from each other and removes any connection between you."
        >
          <SettingsRow
            icon="person-remove-outline"
            label="Blocked accounts"
            onPress={() => navigation.navigate('BlockedAccounts')}
            last
          />
        </SettingsGroup>

        <SettingsGroup title="Our standards" footer="Both open in your browser.">
          <SettingsRow
            icon="people-circle-outline"
            label="Community Guidelines"
            onPress={() => openLink(openGuidelines, 'guidelines')}
          />
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Child Safety Standards"
            onPress={() => openLink(openChildSafetyStandards, 'child safety standards')}
            last
          />
        </SettingsGroup>

        <SettingsGroup
          title="Get help"
          footer={`${SAFETY_EMAIL} — a person reads every message. If someone is in immediate danger, contact your local emergency services first.`}
        >
          <SettingsRow
            icon="mail-outline"
            label="Contact the safety team"
            onPress={contactSafety}
            last
          />
        </SettingsGroup>

        <View style={styles.foot}>
          <Text style={[type.caption, { color: t.textMuted, textAlign: 'center', lineHeight: 17 }]}>
            DrinkedInn is an 18+ community.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  foot: { paddingHorizontal: 32, marginTop: 2 },
});
