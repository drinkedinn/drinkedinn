// src/screens/taste/AddRatingScreen.js
// Modal composer for POST /ratings.
// Fields: drink_name (required), drink_type (chip), rating (0-10 in 0.5 steps),
// nose / palate / finish, optional distillery.
//
// The screen is a form, not a social post: nothing here goes to the feed. Copy
// centers on the memory of the pour, never on how much or how often.

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, Alert, Platform,
  KeyboardAvoidingView, Pressable, Keyboard,
} from 'react-native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Button, useToast } from '../../components/ui';
import { pop } from '../../ui/haptics';
import TypePicker from '../../components/taste/TypePicker';
import ScoreControl from '../../components/taste/ScoreControl';
import track from '../../lib/track';

const NOTES_MAX = 240;
const NAME_MAX = 80;

function Field({ label, value, onChangeText, placeholder, multiline, autoFocus, maxLength, keyboardType }) {
  const { t } = useTheme();
  return (
    <View style={{ marginBottom: 16, paddingHorizontal: 16 }}>
      <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginBottom: 8 }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        multiline={multiline}
        autoFocus={autoFocus}
        maxLength={maxLength}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            backgroundColor: t.surface,
            borderColor: t.border,
            color: t.text,
            minHeight: multiline ? 64 : 44,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
      {typeof maxLength === 'number' && multiline && (
        <Text style={[type.caption, { color: t.textMuted, marginTop: 4, textAlign: 'right' }]}>
          {(value?.length || 0)} / {maxLength}
        </Text>
      )}
    </View>
  );
}

export default function AddRatingScreen({ navigation, route }) {
  const { t } = useTheme();
  const toast = useToast();
  const onCreated = route.params?.onCreated;
  const submitting = useRef(false);

  const [name, setName] = useState('');
  const [type_, setType_] = useState('Whiskey');
  const [rating, setRating] = useState(0);
  const [distillery, setDistillery] = useState('');
  const [nose, setNose] = useState('');
  const [palate, setPalate] = useState('');
  const [finish, setFinish] = useState('');
  const [busy, setBusy] = useState(false);

  const dirty =
    name.trim() ||
    distillery.trim() ||
    nose.trim() ||
    palate.trim() ||
    finish.trim() ||
    rating > 0 ||
    type_ !== 'Whiskey';

  const close = useCallback(() => {
    Keyboard.dismiss();
    if (!dirty) { navigation.goBack(); return; }
    Alert.alert('Discard this note?', 'You’ll lose what you’ve written.', [
      { text: 'Keep writing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }, [dirty, navigation]);

  const submit = async () => {
    if (submitting.current) return;
    const drinkName = name.trim();
    if (!drinkName) { toast?.show('Give it a name first.', 'error'); return; }
    if (rating <= 0) { toast?.show('Score it before you save.', 'error'); return; }

    submitting.current = true;
    setBusy(true);
    try {
      const res = await api.post('/ratings', {
        drink_name: drinkName,
        drink_type: type_,
        rating,
        distillery: distillery.trim(),
        nose: nose.trim(),
        palate: palate.trim(),
        finish: finish.trim(),
      });
      const created = res?.data;
      if (created && typeof created === 'object' && created.id != null) {
        onCreated?.(created);
      }
      pop();
      track('taste_rating_add', { type: type_, score: rating });
      toast?.show('Noted. Kept in your book.', 'success');
      navigation.goBack();
    } catch (e) {
      toast?.show(e?.safeMessage || 'Could not save that.', 'error');
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <View style={[styles.header, { borderBottomColor: t.divider }]}>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Close">
          <Text style={[type.body, { color: t.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Text style={[type.h3, { color: t.text }]}>New rating</Text>
        <Button label="Save" size="sm" onPress={submit} loading={busy} disabled={!name.trim() || rating <= 0 || busy} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingTop: 14, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Lagavulin 16, Old Fashioned, a house cider…"
            autoFocus
            maxLength={NAME_MAX}
          />

          <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginBottom: 10, marginLeft: 16 }]}>
            Type
          </Text>
          <TypePicker value={type_} onChange={setType_} style={{ marginBottom: 18 }} />

          <View style={{ marginBottom: 20 }}>
            <ScoreControl value={rating} onChange={setRating} label="Score" />
          </View>

          <Field
            label="Distillery or origin (optional)"
            value={distillery}
            onChangeText={setDistillery}
            placeholder="Islay, Kentucky, your kitchen…"
            maxLength={80}
          />

          <View style={{ marginTop: 6, paddingHorizontal: 16, marginBottom: 10 }}>
            <Text style={[type.h3, { color: t.text }]}>Tasting notes</Text>
            <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>
              A sentence each is plenty. This is a memory, not a review.
            </Text>
          </View>

          <Field
            label="Nose"
            value={nose}
            onChangeText={setNose}
            placeholder="What it smelled like when you brought it close."
            multiline
            maxLength={NOTES_MAX}
          />
          <Field
            label="Palate"
            value={palate}
            onChangeText={setPalate}
            placeholder="First sip, mid-palate — what stood out?"
            multiline
            maxLength={NOTES_MAX}
          />
          <Field
            label="Finish"
            value={finish}
            onChangeText={setFinish}
            placeholder="What lingered after you set the glass down."
            multiline
            maxLength={NOTES_MAX}
          />
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
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
});
