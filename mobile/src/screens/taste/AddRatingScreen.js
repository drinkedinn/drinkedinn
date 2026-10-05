// src/screens/taste/AddRatingScreen.js
// Rate a place you have been.
//
// This used to score a bottle: name, type (Whiskey/Wine/Beer), distillery, and
// a note split across nose / palate / finish. None of that describes a room, so
// the subject is the place and the note is one free-text field.
//
// Reached from the place profile, which passes { placeId, placeName } — the
// place is never typed in here. A rating belongs to a venue that already
// exists, so letting someone free-type a name would create ratings pointing at
// nothing.
//
// Server: POST /ratings { place_id, rating, note } (server/routes/ratings.js).
// It upserts on (user_id, place_id), so rating somewhere twice replaces the
// previous score rather than adding a second.

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert, Pressable } from 'react-native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Button, Icon, useToast } from '../../components/ui';
import { pop } from '../../ui/haptics';
import track from '../../lib/track';

const MAX_SCORE = 5;
const MAX_NOTE = 500;

function StarPicker({ value, onChange }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
      {Array.from({ length: MAX_SCORE }, (_, i) => {
        const n = i + 1;
        const on = value >= n;
        return (
          <Pressable
            key={n}
            onPress={() => { pop(); onChange(n); }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${n} out of ${MAX_SCORE}`}
            accessibilityState={{ selected: on }}
          >
            <Icon name={on ? 'star' : 'star-outline'} size={34} color={on ? t.accent : t.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AddRatingScreen({ navigation, route }) {
  const { t } = useTheme();
  const toast = useToast();

  const placeId = route.params?.placeId;
  const placeName = route.params?.placeName;
  const onCreated = route.params?.onCreated;

  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const dirty = rating > 0 || note.trim().length > 0;

  const close = useCallback(() => {
    if (!dirty) { navigation.goBack(); return; }
    Alert.alert('Discard this rating?', 'What you have written will not be saved.', [
      { text: 'Keep writing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }, [dirty, navigation]);

  const submit = useCallback(async () => {
    if (!placeId) {
      toast?.show('No place to rate. Open a place first.', 'error');
      return;
    }
    if (rating < 1) {
      toast?.show('Give it a score first.', 'info');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/ratings', { place_id: placeId, rating, note: note.trim() });
      track('place_rated', { rating });
      toast?.show('Rated. Thanks.', 'success');
      onCreated?.(res?.data);
      navigation.goBack();
    } catch (e) {
      toast?.show(e?.safeMessage || 'Could not save that rating.', 'error');
    } finally {
      setBusy(false);
    }
  }, [placeId, rating, note, onCreated, navigation, toast]);

  return (
    <Screen>
      <Header title="Rate this place" onBack={close} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {!!placeName && (
          <View style={[styles.place, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
            <Icon name="location-outline" size={16} color={t.textMuted} />
            <Text style={[type.label, { color: t.text, flex: 1 }]} numberOfLines={1}>{placeName}</Text>
          </View>
        )}

        <Text style={[type.label, { color: t.text, marginTop: 20 }]}>How was it?</Text>
        <StarPicker value={rating} onChange={setRating} />

        <Text style={[type.label, { color: t.text, marginTop: 24 }]}>Anything worth remembering?</Text>
        <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>Optional — a line for your future self.</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Go at sunset, sit on the left…"
          placeholderTextColor={t.textMuted}
          multiline
          maxLength={MAX_NOTE}
          style={[styles.note, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
        />
        <Text style={[type.caption, { color: t.textMuted, alignSelf: 'flex-end', marginTop: 4 }]}>
          {note.length}/{MAX_NOTE}
        </Text>

        <Button
          label={busy ? 'Saving…' : 'Save rating'}
          onPress={submit}
          disabled={busy || rating < 1}
          loading={busy}
          full
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  place: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: radius.md, padding: 12,
  },
  note: {
    borderWidth: 1, borderRadius: radius.md, padding: 12,
    minHeight: 110, textAlignVertical: 'top', marginTop: 8, fontSize: 15,
  },
});
