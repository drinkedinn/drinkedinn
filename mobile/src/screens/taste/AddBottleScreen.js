// src/screens/taste/AddBottleScreen.js
// Modal composer for adding to the Collection (POST /collection) or the
// Bucket List (POST /bucketlist). A pill toggle at the top selects which.
//
// Collection accepts a rich record (name, type, vintage, notes). The bucket
// list is intentionally lightweight — the server only stores drink_name, so
// this screen only asks for that when the bucket mode is active. If someone
// added type / vintage / notes then flipped to bucket, those extra fields are
// held in memory but not sent, because the server would ignore them anyway.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, Alert, Platform,
  KeyboardAvoidingView, Pressable, Keyboard,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Button, Icon, Bounce, useToast } from '../../components/ui';
import { pop } from '../../ui/haptics';
import TypePicker from '../../components/taste/TypePicker';
import track from '../../lib/track';

const NAME_MAX = 80;
const NOTES_MAX = 240;

function ModeToggle({ mode, onChange }) {
  const { t } = useTheme();
  const opts = [
    { key: 'collection', label: 'On my shelf', icon: 'library-outline' },
    { key: 'bucket', label: 'Want to try', icon: 'bookmark-outline' },
  ];
  return (
    <View style={[styles.toggle, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
      {opts.map((o) => {
        const active = o.key === mode;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              if (active) return;
              try { Haptics.selectionAsync(); } catch {}
              onChange(o.key);
            }}
            style={[
              styles.toggleSeg,
              active && { backgroundColor: t.surface, borderColor: t.border },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Icon name={o.icon} size={15} color={active ? t.accent : t.textMuted} />
            <Text style={[type.label, { color: active ? t.text : t.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, maxLength, autoFocus }) {
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

export default function AddBottleScreen({ navigation, route }) {
  const { t } = useTheme();
  const toast = useToast();
  const onCreated = route.params?.onCreated;
  const submitting = useRef(false);

  const [mode, setMode] = useState(route.params?.initialMode === 'bucket' ? 'bucket' : 'collection');
  const [name, setName] = useState('');
  const [type_, setType_] = useState('Whiskey');
  const [vintage, setVintage] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  // If the initial mode came in as something odd, coerce it once so subsequent
  // navigation still works cleanly.
  useEffect(() => {
    if (mode !== 'collection' && mode !== 'bucket') setMode('collection');
  }, [mode]);

  const dirty = name.trim() || vintage.trim() || notes.trim() || type_ !== 'Whiskey';

  const close = useCallback(() => {
    Keyboard.dismiss();
    if (!dirty) { navigation.goBack(); return; }
    Alert.alert('Discard this?', 'You’ll lose what you’ve written.', [
      { text: 'Keep writing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }, [dirty, navigation]);

  const submit = async () => {
    if (submitting.current) return;
    const clean = name.trim();
    if (!clean) { toast?.show('Give it a name first.', 'error'); return; }

    submitting.current = true;
    setBusy(true);
    try {
      let created;
      if (mode === 'collection') {
        const res = await api.post('/collection', {
          name: clean,
          drink_type: type_,
          vintage: vintage.trim(),
          notes: notes.trim(),
        });
        created = res?.data;
      } else {
        const res = await api.post('/bucketlist', { drink_name: clean });
        created = res?.data;
      }

      if (created && typeof created === 'object' && created.id != null) {
        onCreated?.(created, mode);
      }
      pop();
      track('taste_bottle_add', { mode, type: type_ });
      toast?.show(
        mode === 'collection' ? 'Added to your shelf.' : 'Saved to your list.',
        'success'
      );
      navigation.goBack();
    } catch (e) {
      toast?.show(e?.safeMessage || 'Could not save that.', 'error');
      submitting.current = false;
      setBusy(false);
    }
  };

  const isBucket = mode === 'bucket';

  return (
    <Screen edges={['top']}>
      <View style={[styles.header, { borderBottomColor: t.divider }]}>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Close">
          <Text style={[type.body, { color: t.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Text style={[type.h3, { color: t.text }]}>Add a bottle</Text>
        <Button label="Save" size="sm" onPress={submit} loading={busy} disabled={!name.trim() || busy} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingTop: 14, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: 16, marginBottom: 18 }}>
            <ModeToggle mode={mode} onChange={setMode} />
            <Text style={[type.caption, { color: t.textMuted, marginTop: 8, lineHeight: 17 }]}>
              {isBucket
                ? 'A quiet reminder — nothing more. Check it off when you get to it.'
                : 'Keep the bottles you’ve fallen for close at hand.'}
            </Text>
          </View>

          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder={isBucket ? 'That dram you’ve been meaning to try' : 'What’s the bottle called?'}
            autoFocus
            maxLength={NAME_MAX}
          />

          {!isBucket && (
            <>
              <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginBottom: 10, marginLeft: 16 }]}>
                Type
              </Text>
              <TypePicker value={type_} onChange={setType_} style={{ marginBottom: 18 }} />

              <Field
                label="Vintage or age (optional)"
                value={vintage}
                onChangeText={setVintage}
                placeholder="2018, 12 year, NV…"
                maxLength={40}
              />

              <Field
                label="Notes (optional)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Where you got it, why it matters, when to open it."
                multiline
                maxLength={NOTES_MAX}
              />
            </>
          )}
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
  toggle: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 3,
  },
  toggleSeg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
