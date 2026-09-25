// src/screens/stories/CreateStoryScreen.js
// Composer for a 24-hour moment. Modal-style: cancel closes without saving,
// Share uploads the photo and posts the story.
//
// Flow:
//   1. User picks a photo (library or camera) — required, because the whole
//      point of a moment is to show it.
//   2. Optional short caption ("Add a moment").
//   3. What they're pouring (optional, defaults to a house glass).
//   4. Share → POST /upload to get a URL, then POST /stories.
//
// Server contract note: server/routes/stories.js currently persists only
// `drink` on the row. We still send `image_url` and `caption` so the moment a
// server column lands the client is ready — Express drops unknown fields
// harmlessly. The Share button remains gated on having a photo picked so the
// composer's promise ("show us the moment") isn't broken even if the image
// isn't yet stored server-side. See the integrator note in structured output.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Platform, KeyboardAvoidingView,
  Pressable, Alert, ActivityIndicator, Keyboard, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Icon, Avatar, Bounce, Button, useToast } from '../../components/ui';
import DrinkPicker from '../../components/compose/DrinkPicker';
import track from '../../lib/track';

const CAPTION_MAX = 140;

export default function CreateStoryScreen({ navigation }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [drink, setDrink] = useState('🍹');
  const [uploading, setUploading] = useState(0);
  const [posting, setPosting] = useState(false);
  const [showDrinks, setShowDrinks] = useState(false);
  const captionRef = useRef(null);

  const dirty = !!image || !!caption.trim();

  const close = useCallback(() => {
    Keyboard.dismiss();
    if (!dirty) { navigation.goBack(); return; }
    Alert.alert('Discard this moment?', "You can share it later.", [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }, [dirty, navigation]);

  const pickImage = useCallback(async (fromCamera) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast?.show(
          fromCamera ? 'Camera access is needed.' : 'Photo access is needed.',
          'error',
        );
        return;
      }
      const opts = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [9, 16],
      };
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (!res.canceled && res.assets?.[0]) {
        setImage(res.assets[0]);
        track('story_photo_picked', { source: fromCamera ? 'camera' : 'library' });
      }
    } catch {
      toast?.show("Couldn't open the picker just now.", 'error');
    }
  }, [toast]);

  const pickPrompt = useCallback(() => {
    Alert.alert('Add a moment', 'Show us where you are.', [
      { text: 'Take photo', onPress: () => pickImage(true) },
      { text: 'Choose from library', onPress: () => pickImage(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [pickImage]);

  // If nothing is picked yet, prompt on first paint so the composer opens
  // straight into the picker like every other stories composer.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || image) return;
    opened.current = true;
    // A tick, so the modal transition finishes first.
    const id = setTimeout(pickPrompt, 320);
    return () => clearTimeout(id);
  }, [image, pickPrompt]);

  const submit = useCallback(async () => {
    if (!image) { toast?.show('Add a photo first.', 'error'); return; }
    const body = caption.trim();
    if (body.length > CAPTION_MAX) {
      toast?.show(`Captions are up to ${CAPTION_MAX} characters.`, 'error');
      return;
    }
    setPosting(true);
    try {
      // 1) upload the image
      setUploading(0.02);
      const form = new FormData();
      form.append('image', {
        uri: image.uri,
        name: image.fileName || `moment-${Date.now()}.jpg`,
        type: image.mimeType || 'image/jpeg',
      });
      const up = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploading(Math.min(0.98, e.loaded / e.total));
        },
      });
      const image_url = up.data?.url || '';
      setUploading(1);

      // 2) post the story
      await api.post('/stories', {
        drink,
        image_url,
        caption: body || undefined,
      });

      track('story_created', { has_caption: !!body });
      toast?.show('Shared. Live for the next 24h.', 'success');
      navigation.goBack();
    } catch (e) {
      toast?.show(e.safeMessage || 'Could not share that moment.', 'error');
      setPosting(false);
      setUploading(0);
    }
  }, [image, caption, drink, toast, navigation]);

  const canPost = !!image && !posting;
  const captionRemaining = CAPTION_MAX - caption.length;

  return (
    <Screen edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.divider }]}>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Close composer">
          <Text style={[type.body, { color: t.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Text style={[type.h3, { color: t.text }]}>New moment</Text>
        <Button label="Share" size="sm" onPress={submit} loading={posting} disabled={!canPost} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Author + hint */}
        <View style={styles.authorRow}>
          <Avatar uri={user?.avatar} name={user?.name} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: t.text }]}>{user?.name}</Text>
            <Text style={[type.caption, { color: t.textMuted }]}>
              Visible for 24 hours
            </Text>
          </View>
        </View>

        {/* Preview */}
        <View style={styles.previewWrap}>
          {image ? (
            <View style={[styles.preview, { borderColor: t.border, backgroundColor: '#000' }]}>
              <Image
                source={{ uri: image.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={220}
              />

              {/* Bottom scrim for caption legibility */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.55)']}
                style={styles.captionScrim}
                pointerEvents="none"
              />

              {/* Caption input over the preview */}
              <View style={styles.captionInputWrap} pointerEvents="box-none">
                <TextInput
                  ref={captionRef}
                  value={caption}
                  onChangeText={(v) => setCaption(v.slice(0, CAPTION_MAX))}
                  placeholder="Add a moment…"
                  placeholderTextColor="rgba(255,255,255,0.75)"
                  multiline
                  maxLength={CAPTION_MAX}
                  style={styles.captionInput}
                />
                {caption.length > CAPTION_MAX - 30 && (
                  <Text style={styles.captionCount}>{captionRemaining}</Text>
                )}
              </View>

              {/* Replace / clear the photo */}
              <View style={styles.topActions} pointerEvents="box-none">
                <Bounce
                  onPress={pickPrompt}
                  haptic="light"
                  scaleTo={0.9}
                  style={styles.topBtn}
                  accessibilityLabel="Replace photo"
                >
                  <Icon name="refresh" size={16} color="#fff" />
                </Bounce>
                <Bounce
                  onPress={() => setImage(null)}
                  haptic="light"
                  scaleTo={0.9}
                  style={styles.topBtn}
                  accessibilityLabel="Remove photo"
                >
                  <Icon name="close" size={16} color="#fff" />
                </Bounce>
              </View>

              {/* Drink chip */}
              <Bounce
                onPress={() => setShowDrinks((s) => !s)}
                haptic="light"
                scaleTo={0.94}
                style={styles.drinkChip}
                accessibilityLabel="Change what you're drinking"
              >
                <Text style={{ fontSize: 18 }}>{drink}</Text>
                <Text style={styles.drinkChipLabel}>
                  {showDrinks ? 'Done' : 'Change'}
                </Text>
              </Bounce>

              {posting && uploading > 0 && uploading < 1 && (
                <View style={[StyleSheet.absoluteFill, styles.uploadOverlay]}>
                  <ActivityIndicator color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', marginTop: 8 }}>
                    {Math.round(uploading * 100)}%
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <EmptyPreview t={t} onLibrary={() => pickImage(false)} onCamera={() => pickImage(true)} />
          )}
        </View>

        {/* Drink picker slides in below the preview when requested */}
        {showDrinks && (
          <View style={{ paddingTop: 12, paddingBottom: 6 }}>
            <Text
              style={[
                type.overline,
                { color: t.textMuted, textTransform: 'uppercase', marginLeft: 16, marginBottom: 8 },
              ]}
            >
              What's in the glass
            </Text>
            <DrinkPicker value={drink} onChange={(d) => { setDrink(d); }} />
            <Text
              style={[
                type.caption,
                { color: t.textMuted, marginHorizontal: 20, marginTop: 8 },
              ]}
            >
              No-proof drinks are welcome — soft drinks, coffee and mate are all here.
            </Text>
          </View>
        )}
        </ScrollView>

        {/* Bottom hint bar pinned above the keyboard. */}
        <View style={[styles.hintBar, { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: t.divider, backgroundColor: t.bg }]}>
          <Icon name="time-outline" size={16} color={t.textMuted} />
          <Text style={[type.caption, { color: t.textMuted, flex: 1 }]}>
            Moments disappear after 24 hours.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function EmptyPreview({ t, onLibrary, onCamera }) {
  return (
    <View
      style={[
        styles.empty,
        { backgroundColor: t.surfaceAlt, borderColor: t.border },
      ]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: t.accentSoft }]}>
        <Icon name="images-outline" size={26} color={t.accent} />
      </View>
      <Text style={[type.h2, { color: t.text, textAlign: 'center' }]}>
        Show us the moment
      </Text>
      <Text
        style={[
          type.body,
          { color: t.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 },
        ]}
      >
        A photo of who you're with, where you are, what's in the glass.
      </Text>

      <View style={styles.emptyActions}>
        <Button label="Take photo"    icon="camera-outline" onPress={onCamera} variant="secondary" />
        <Button label="From library"  icon="albums-outline"  onPress={onLibrary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  authorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
  },
  previewWrap: { paddingHorizontal: 16 },
  preview: {
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
  },
  captionScrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 160,
  },
  captionInputWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 18, paddingBottom: 18, paddingTop: 30,
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
  },
  captionInput: {
    flex: 1, color: '#fff', fontSize: 17, fontWeight: '600',
    lineHeight: 23, maxHeight: 90, textAlignVertical: 'bottom',
  },
  captionCount: {
    color: '#fff', fontSize: 12, fontWeight: '700', marginBottom: 4,
    minWidth: 22, textAlign: 'right',
  },
  topActions: {
    position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8,
  },
  topBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  drinkChip: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill,
  },
  drinkChipLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },

  uploadOverlay: {
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },

  empty: {
    aspectRatio: 3 / 4, borderRadius: radius.lg, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', padding: 26, gap: 4,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: radius.xl,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyActions: {
    flexDirection: 'row', gap: 10, marginTop: 22,
  },

  hintBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
