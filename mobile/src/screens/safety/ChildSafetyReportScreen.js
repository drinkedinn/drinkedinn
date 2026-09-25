// src/screens/safety/ChildSafetyReportScreen.js
// Reporting a child-safety concern.
//
// POST /reports/child-safety { details, target_type?, target_id? } — a separate
// endpoint from ordinary reports so the path is unambiguous in the moderation
// queue, and one that is never deduplicated: a second report may carry new
// evidence, and answering "already reported" to a child-safety escalation is
// not a behaviour this app should ever have.
//
// The response deliberately carries no detail, so neither does this screen. A
// reporter must not be able to infer what the team already knows about an
// account. Nothing here celebrates: no confetti, no cheer, no emoji.
//
// Optional route params let another surface hand us context:
//   { targetType?: 'user' | 'post' | …, targetId?: number, about?: string }

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Button, useToast } from '../../components/ui';
import SafetyNotice from '../../components/safety/SafetyNotice';
import ResourceLink from '../../components/safety/ResourceLink';
import {
  CHILD_SAFETY_RESOURCES,
  SAFETY_EMAIL,
  TARGET_TYPES,
} from '../../components/safety/reportCatalog';
import { warn } from '../../ui/haptics';
import track from '../../lib/track';

const DETAILS_MIN = 10;
const DETAILS_MAX = 820;   // leaves room for the "About" line inside the
const ABOUT_MAX = 140;     // server's 1000-character column.

const EMERGENCY_LINE =
  'If a child is in immediate danger, contact your local emergency services first. Reporting here does not reach them.';

export default function ChildSafetyReportScreen({ navigation, route }) {
  const { t } = useTheme();
  const toast = useToast();

  const params = route?.params || {};
  const [details, setDetails] = useState('');
  const [about, setAbout] = useState(typeof params.about === 'string' ? params.about.slice(0, ABOUT_MAX) : '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => { track('child_safety_report_open'); }, []);

  const trimmed = details.trim();
  const canSend = trimmed.length >= DETAILS_MIN && !sending;
  const remaining = DETAILS_MAX - details.length;

  const inputStyle = useMemo(
    () => ({
      backgroundColor: t.surface,
      borderColor: t.border,
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: 13,
      paddingVertical: 12,
      color: t.text,
      fontSize: 15,
      lineHeight: 21,
    }),
    [t]
  );

  const submit = useCallback(async () => {
    if (!canSend) return;
    setSending(true);

    const aboutText = about.trim();
    const body = {
      details: (aboutText ? `${trimmed}\n\nAbout: ${aboutText}` : trimmed).slice(0, 1000),
    };
    // Only forward context we were actually handed, and only in a shape the
    // server accepts — it validates target_type against its own list.
    if (typeof params.targetType === 'string' && TARGET_TYPES.includes(params.targetType)) {
      body.target_type = params.targetType;
    }
    if (params.targetId != null && Number.isInteger(Number(params.targetId))) {
      body.target_id = Number(params.targetId);
    }

    try {
      await api.post('/reports/child-safety', body);
      track('child_safety_report_submitted');
      setSent(true);
    } catch (e) {
      warn();
      toast?.show(
        e?.safeMessage || `Could not send that report. Write to ${SAFETY_EMAIL}.`,
        'error'
      );
    } finally {
      setSending(false);
    }
  }, [canSend, about, trimmed, params.targetType, params.targetId, toast]);

  if (sent) {
    return (
      <Screen>
        <Header
          title="Child safety"
          onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        />
        <ScrollView
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <SafetyNotice
            icon="checkmark-outline"
            title="Report received"
            body="The safety team has it. We won’t share what happens next — including whether we have seen this account before."
            style={{ marginBottom: 16 }}
          />

          <SafetyNotice
            icon="alert-circle-outline"
            tone="danger"
            title="If a child is in danger right now"
            body={EMERGENCY_LINE}
            style={{ marginBottom: 16 }}
          />

          <Text style={[type.overline, styles.sectionLabel, { color: t.textMuted }]}>
            Where else to report
          </Text>
          <View style={{ marginHorizontal: 16 }}>
            {CHILD_SAFETY_RESOURCES.map((r) => (
              <ResourceLink
                key={r.key}
                label={r.label}
                note={r.note}
                url={r.url}
                onFail={() => toast?.show('Could not open that link.', 'error')}
              />
            ))}
          </View>

          <View style={{ marginHorizontal: 16, marginTop: 18 }}>
            <Button
              label="Done"
              variant="secondary"
              full
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : null)}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Child safety"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SafetyNotice
            icon="alert-circle-outline"
            tone="danger"
            title="Before you start"
            body={EMERGENCY_LINE}
            style={{ marginBottom: 16 }}
          />

          <Text style={[type.body, styles.intro, { color: t.textSecondary }]}>
            DrinkedInn is an 18+ community. Tell us what you saw and a person on the safety
            team will read it. The account you name is never told who reported them.
          </Text>

          <View style={styles.field}>
            <Text style={[type.label, { color: t.text, marginBottom: 6 }]}>What did you see?</Text>
            <TextInput
              value={details}
              onChangeText={(v) => setDetails(v.slice(0, DETAILS_MAX))}
              placeholder="Describe what happened, where you saw it, and anything that would help us find it."
              placeholderTextColor={t.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={DETAILS_MAX}
              editable={!sending}
              style={[inputStyle, { minHeight: 148 }]}
              accessibilityLabel="What did you see"
            />
            <Text style={[type.caption, { color: t.textMuted, marginTop: 6 }]}>
              {trimmed.length < DETAILS_MIN
                ? `At least ${DETAILS_MIN} characters so the team can act on it.`
                : `${remaining} character${remaining === 1 ? '' : 's'} left.`}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={[type.label, { color: t.text, marginBottom: 6 }]}>
              Who or what is this about?
            </Text>
            <TextInput
              value={about}
              onChangeText={(v) => setAbout(v.slice(0, ABOUT_MAX))}
              placeholder="A name, a handle or a link — optional"
              placeholderTextColor={t.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={ABOUT_MAX}
              editable={!sending}
              style={inputStyle}
              accessibilityLabel="Who or what is this about, optional"
            />
          </View>

          <View style={{ marginHorizontal: 16, marginTop: 6 }}>
            <Button
              label="Send to the safety team"
              full
              loading={sending}
              disabled={!canSend}
              onPress={submit}
            />
            <Text style={[type.caption, { color: t.textMuted, marginTop: 12, lineHeight: 17 }]}>
              Reports are stored securely and passed to the authorities where the law requires
              it. If you would rather write to us directly, the team is at {SAFETY_EMAIL}.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginHorizontal: 16, lineHeight: 21, marginBottom: 20 },
  field: { marginHorizontal: 16, marginBottom: 18 },
  sectionLabel: { textTransform: 'uppercase', marginLeft: 20, marginBottom: 8 },
});
