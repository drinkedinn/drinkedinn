// src/screens/events/CreateEventScreen.js
// Modal composer for a new gathering.
//
// The server (POST /events) persists { title, date, location, drink } — nothing
// else. This screen intentionally sticks to that contract so no field silently
// dies. Draft text survives an accidental dismissal.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, Alert, Platform,
  KeyboardAvoidingView, Pressable, Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Icon, Button, useToast } from '../../components/ui';
import DateTimeField from '../../components/events/DateTimeField';
import DrinkChipPicker from '../../components/events/DrinkChipPicker';
import { toIsoLocal, longDate } from '../../components/events/dateUtils';
import { track } from '../../lib/track';

const DRAFT_KEY = 'di_event_draft';
const TITLE_MAX = 80;
const LOCATION_MAX = 80;

// Sensible default: tonight at 7pm, or tomorrow 7pm if it's already past.
function defaultWhen() {
  const d = new Date();
  d.setSeconds(0, 0);
  if (d.getHours() >= 19) {
    d.setDate(d.getDate() + 1);
  }
  d.setHours(19, 0, 0, 0);
  return d;
}

function FieldLabel({ icon, children }) {
  const { t } = useTheme();
  return (
    <View style={styles.labelRow}>
      <Icon name={icon} size={14} color={t.textMuted} />
      <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>{children}</Text>
    </View>
  );
}

export default function CreateEventScreen({ navigation }) {
  const { t } = useTheme();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [when, setWhen] = useState(defaultWhen);
  const [drink, setDrink] = useState('🍹');
  const [submitting, setSubmitting] = useState(false);
  const restored = useRef(false);

  // Restore draft
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d.title) setTitle(d.title);
          if (d.location) setLocation(d.location);
          if (d.drink) setDrink(d.drink);
          if (d.when) {
            const parsed = new Date(d.when);
            if (!isNaN(parsed.getTime())) setWhen(parsed);
          }
          if (d.title) toast?.show('Draft restored.', 'info');
        }
      } catch {} finally {
        restored.current = true;
      }
    })();
  }, []);

  // Persist draft
  useEffect(() => {
    if (!restored.current) return;
    const id = setTimeout(() => {
      const empty = !title.trim() && !location.trim();
      if (empty) AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      else AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({
        title, location, drink, when: when instanceof Date ? when.toISOString() : null,
      })).catch(() => {});
    }, 400);
    return () => clearTimeout(id);
  }, [title, location, drink, when]);

  const dirty = title.trim().length > 0 || location.trim().length > 0;

  const close = useCallback(() => {
    Keyboard.dismiss();
    if (!dirty) { navigation.goBack(); return; }
    Alert.alert('Keep this draft?', 'Your details will be here when you come back.', [
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
          navigation.goBack();
        },
      },
      { text: 'Keep draft', onPress: () => navigation.goBack() },
    ]);
  }, [dirty, navigation]);

  const post = useCallback(async (trimmedTitle) => {
    setSubmitting(true);
    try {
      await api.post('/events', {
        title: trimmedTitle.slice(0, TITLE_MAX),
        date: toIsoLocal(when),
        location: location.trim().slice(0, LOCATION_MAX),
        drink,
      });
      await AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      track('event_create');
      toast?.show('Event created. Round them up.', 'success');
      // Modal → returning to the list, which refetches on focus and puts the
      // new event at the top. Safer than replacing a modal presentation with
      // a stack screen.
      navigation.goBack();
    } catch (e) {
      toast?.show(e.safeMessage || 'Could not create that.', 'error');
      setSubmitting(false);
    }
  }, [when, location, drink, navigation, toast]);

  const submit = useCallback(() => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { toast?.show('Give it a name so people know what to expect.', 'error'); return; }
    if (!(when instanceof Date) || isNaN(when.getTime())) { toast?.show('Pick a date and time.', 'error'); return; }

    // A past time isn't a hard error server-side, but nudging is kind.
    if (when.getTime() < Date.now() - 60_000) {
      Alert.alert(
        'That date is in the past',
        'Are you setting a placeholder, or should we push it to a future date?',
        [
          { text: 'Change date', style: 'cancel' },
          { text: 'Create anyway', onPress: () => post(trimmedTitle) },
        ]
      );
      return;
    }
    post(trimmedTitle);
  }, [title, when, post, toast]);

  const canPost = title.trim().length > 0 && !submitting;

  return (
    <Screen edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.divider }]}>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Close composer">
          <Text style={[type.body, { color: t.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Text style={[type.h3, { color: t.text }]}>New event</Text>
        <Button label="Create" size="sm" onPress={submit} loading={submitting} disabled={!canPost} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
            <FieldLabel icon="sparkles-outline">What's the plan?</FieldLabel>
            <TextInput
              value={title}
              onChangeText={(txt) => setTitle(txt.slice(0, TITLE_MAX))}
              placeholder="A name that says why to come"
              placeholderTextColor={t.textMuted}
              style={[styles.titleInput, { color: t.text, borderColor: t.border, backgroundColor: t.surface }]}
              maxLength={TITLE_MAX}
              multiline
            />
          </View>

          {/* Location */}
          <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
            <FieldLabel icon="location-outline">Where</FieldLabel>
            <TextInput
              value={location}
              onChangeText={(txt) => setLocation(txt.slice(0, LOCATION_MAX))}
              placeholder="A place, a neighbourhood, or an address"
              placeholderTextColor={t.textMuted}
              style={[styles.plainInput, { color: t.text, borderColor: t.border, backgroundColor: t.surface }]}
              maxLength={LOCATION_MAX}
            />
          </View>

          {/* Date & time */}
          <View style={{ marginTop: 22 }}>
            <View style={{ paddingHorizontal: 16 }}>
              <FieldLabel icon="calendar-outline">When</FieldLabel>
            </View>
            <View
              style={[
                styles.pickerCard,
                { backgroundColor: t.surface, borderColor: t.border },
              ]}
            >
              <Text style={[type.bodyStrong, { color: t.text, paddingHorizontal: 16, marginBottom: 12 }]}>
                {longDate(toIsoLocal(when))}
              </Text>
              <DateTimeField value={when} onChange={setWhen} />
            </View>
          </View>

          {/* Drink */}
          <View style={{ marginTop: 22 }}>
            <View style={{ paddingHorizontal: 16 }}>
              <FieldLabel icon="wine-outline">What you'll pour</FieldLabel>
            </View>
            <DrinkChipPicker value={drink} onChange={setDrink} />
            <Text style={[type.caption, { color: t.textMuted, paddingHorizontal: 16, marginTop: 10, lineHeight: 17 }]}>
              Zero-proof is always on the menu — pick what fits the room.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  titleInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    minHeight: 56,
    textAlignVertical: 'top',
  },
  plainInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  pickerCard: {
    marginHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 14,
  },
});
