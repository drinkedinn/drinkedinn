// src/screens/CreatePostScreen.js — the pour composer.
// Drafts survive accidental dismissal, uploads show real progress, and the
// action toolbar stays pinned above the keyboard.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, Alert, Platform,
  KeyboardAvoidingView, ActivityIndicator, Pressable, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { radius, type } from '../theme/tokens';
import { Screen, Icon, Avatar, Bounce, Button, useToast } from '../components/ui';
import DrinkPicker from '../components/compose/DrinkPicker';
import PollBuilder from '../components/compose/PollBuilder';

const MAX = 500;
const DRAFT_KEY = 'di_compose_draft';

function CounterRing({ length }) {
  const { t } = useTheme();
  const remaining = MAX - length;
  const pct = Math.min(1, length / MAX);
  const near = remaining <= 60;
  const over = remaining < 0;
  const color = over ? t.danger : near ? t.warning : t.accent;

  return (
    <View style={styles.counter}>
      {near && (
        <Text style={[type.caption, { color, fontVariant: ['tabular-nums'] }]}>{remaining}</Text>
      )}
      <View style={[styles.ringTrack, { borderColor: t.border }]}>
        <View
          style={{
            width: `${Math.min(100, pct * 100)}%`,
            height: '100%',
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

function ToolButton({ icon, label, active, onPress, disabled }) {
  const { t } = useTheme();
  return (
    <Bounce onPress={onPress} haptic="light" disabled={disabled} scaleTo={0.9} accessibilityLabel={label}>
      <View
        style={[
          styles.tool,
          { backgroundColor: active ? t.accentSoft : 'transparent', borderColor: active ? t.accentBorder : 'transparent' },
        ]}
      >
        <Icon name={icon} size={21} color={disabled ? t.textMuted : active ? t.accent : t.textSecondary} />
      </View>
    </Bounce>
  );
}

export default function CreatePostScreen({ navigation }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [content, setContent] = useState('');
  const [drink, setDrink] = useState('🥃');
  const [location, setLocation] = useState('');
  const [showLocation, setShowLocation] = useState(false);
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(0);
  const [poll, setPoll] = useState(null);
  const [posting, setPosting] = useState(false);
  const inputRef = useRef(null);
  const restored = useRef(false);

  // Restore draft
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          setContent(d.content || '');
          setDrink(d.drink || '🥃');
          setLocation(d.location || '');
          setShowLocation(!!d.location);
          if (d.poll) setPoll(d.poll);
          if (d.content) toast?.show('Draft restored.', 'info');
        }
      } catch {} finally {
        restored.current = true;
        setTimeout(() => inputRef.current?.focus(), 350);
      }
    })();
  }, []);

  // Persist draft (text only — images stay local to the session)
  useEffect(() => {
    if (!restored.current) return;
    const id = setTimeout(() => {
      const empty = !content.trim() && !location.trim() && !poll;
      if (empty) AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      else AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ content, drink, location, poll })).catch(() => {});
    }, 400);
    return () => clearTimeout(id);
  }, [content, drink, location, poll]);

  const dirty = content.trim() || image || location.trim() || poll;

  const close = useCallback(() => {
    Keyboard.dismiss();
    if (!dirty) { navigation.goBack(); return; }
    Alert.alert('Keep this draft?', 'Your text will be here when you come back.', [
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => { await AsyncStorage.removeItem(DRAFT_KEY).catch(() => {}); navigation.goBack(); },
      },
      { text: 'Keep draft', onPress: () => navigation.goBack() },
    ]);
  }, [dirty, navigation]);

  const pickImage = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast?.show(fromCamera ? 'Camera access is needed.' : 'Photo access is needed.', 'error');
      return;
    }
    const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true, aspect: [4, 3] };
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets?.[0]) setImage(res.assets[0]);
  };

  const addPhoto = () => {
    if (image) { setImage(null); return; }
    Alert.alert('Add a photo', 'Show us the glass.', [
      { text: 'Take photo', onPress: () => pickImage(true) },
      { text: 'Choose from library', onPress: () => pickImage(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submit = async () => {
    const body = content.trim();
    if (!body && !image) { toast?.show('Add a note or a photo first.', 'error'); return; }
    if (body.length > MAX) { toast?.show(`That's ${body.length - MAX} characters over.`, 'error'); return; }

    const pollOptions = poll ? poll.map((p) => p.trim()).filter(Boolean) : [];
    if (poll && pollOptions.length < 2) { toast?.show('A poll needs at least two options.', 'error'); return; }

    setPosting(true);
    try {
      let image_url = '';
      if (image) {
        setUploading(0.02);
        const form = new FormData();
        form.append('image', {
          uri: image.uri,
          name: image.fileName || `pour-${Date.now()}.jpg`,
          type: image.mimeType || 'image/jpeg',
        });
        const up = await api.post('/upload', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e.total) setUploading(Math.min(0.98, e.loaded / e.total));
          },
        });
        image_url = up.data?.url || '';
        setUploading(1);
      }

      await api.post('/posts', {
        content: body,
        drink,
        location: location.trim(),
        image_url,
        poll_options: pollOptions,
      });

      await AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      toast?.show('Poured. 🥂', 'success');
      navigation.goBack();
    } catch (e) {
      toast?.show(e.safeMessage || 'Could not share that.', 'error');
      setPosting(false);
      setUploading(0);
    }
  };

  const canPost = (content.trim().length > 0 || !!image) && content.length <= MAX && !posting;

  return (
    <Screen edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.divider }]}>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Close composer">
          <Text style={[type.body, { color: t.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Text style={[type.h3, { color: t.text }]}>New pour</Text>
        <Button label="Share" size="sm" onPress={submit} loading={posting} disabled={!canPost} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Author + input */}
          <View style={styles.authorRow}>
            <Avatar uri={user?.avatar} name={user?.name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]}>{user?.name}</Text>
              <Text style={[type.caption, { color: t.textMuted }]}>Sharing to your feed</Text>
            </View>
          </View>

          <TextInput
            ref={inputRef}
            value={content}
            onChangeText={setContent}
            placeholder="What's in your glass tonight?"
            placeholderTextColor={t.textMuted}
            multiline
            style={[styles.textArea, { color: t.text }]}
            scrollEnabled={false}
          />

          {/* Image preview */}
          {!!image && (
            <View style={[styles.imgWrap, { borderColor: t.border }]}>
              <Image source={{ uri: image.uri }} style={styles.img} contentFit="cover" transition={200} />
              {posting && uploading > 0 && uploading < 1 && (
                <View style={[StyleSheet.absoluteFill, styles.uploadOverlay]}>
                  <ActivityIndicator color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', marginTop: 8 }}>
                    {Math.round(uploading * 100)}%
                  </Text>
                </View>
              )}
              <Bounce
                onPress={() => setImage(null)}
                haptic="light"
                style={[styles.imgRemove, { backgroundColor: t.scrim }]}
                accessibilityLabel="Remove photo"
              >
                <Icon name="close" size={16} color="#fff" />
              </Bounce>
            </View>
          )}

          {/* Poll */}
          {poll && (
            <View style={{ marginTop: 14 }}>
              <PollBuilder options={poll} onChange={setPoll} onClose={() => setPoll(null)} />
            </View>
          )}

          {/* Location */}
          {showLocation && (
            <View style={[styles.locWrap, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
              <Icon name="location-outline" size={17} color={t.textSecondary} />
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="Where are you pouring?"
                placeholderTextColor={t.textMuted}
                maxLength={60}
                style={{ flex: 1, color: t.text, fontSize: 15, paddingVertical: 2 }}
                autoFocus
              />
              <Bounce onPress={() => { setLocation(''); setShowLocation(false); }} haptic="light" hitSlop={8} accessibilityLabel="Remove location">
                <Icon name="close" size={16} color={t.textMuted} />
              </Bounce>
            </View>
          )}

          {/* Drink */}
          <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginLeft: 16, marginTop: 22, marginBottom: 10 }]}>
            What are you drinking
          </Text>
          <DrinkPicker value={drink} onChange={setDrink} />
        </ScrollView>

        {/* Toolbar pinned above the keyboard */}
        <View style={[styles.toolbar, { borderTopColor: t.divider, backgroundColor: t.bg }]}>
          <ToolButton icon={image ? 'image' : 'image-outline'} label="Add photo" active={!!image} onPress={addPhoto} />
          <ToolButton
            icon={showLocation ? 'location' : 'location-outline'}
            label="Add location"
            active={showLocation}
            onPress={() => setShowLocation((s) => !s)}
          />
          <ToolButton
            icon={poll ? 'bar-chart' : 'bar-chart-outline'}
            label="Add poll"
            active={!!poll}
            onPress={() => setPoll((p) => (p ? null : ['', '']))}
          />
          <View style={{ flex: 1 }} />
          <CounterRing length={content.length} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingTop: 16 },
  textArea: { paddingHorizontal: 16, paddingTop: 14, fontSize: 18, lineHeight: 26, minHeight: 110, textAlignVertical: 'top' },
  imgWrap: { marginHorizontal: 16, marginTop: 6, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1 },
  img: { width: '100%', aspectRatio: 4 / 3 },
  uploadOverlay: { backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  imgRemove: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  locWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 16, marginTop: 14,
    borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11,
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  tool: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 6 },
  ringTrack: { width: 34, height: 4, borderRadius: 2, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
