// src/screens/account/EditProfileScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Avatar, Icon, Button, useToast } from '../../components/ui';

const MAX_BIO = 240;

function Field({ label, value, onChangeText, placeholder, multiline, maxLength, autoCapitalize, counter }) {
  const { t } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={styles.labelRow}>
        <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>{label}</Text>
        {counter && <Text style={[type.caption, { color: t.textMuted }]}>{(value || '').length}/{maxLength}</Text>}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        multiline={multiline}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[
          styles.input,
          {
            backgroundColor: t.surface,
            borderColor: focus ? t.accent : t.border,
            color: t.text,
            minHeight: multiline ? 96 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
    </View>
  );
}

export default function EditProfileScreen({ navigation }) {
  const { t } = useTheme();
  const { user, patchUser, refresh } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name || '');
  const [title, setTitle] = useState(user?.title || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast?.show('Photo access is needed to change your picture.', 'error'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8, allowsEditing: true, aspect: [1, 1],
    });
    if (res.canceled || !res.assets?.[0]) return;

    const asset = res.assets[0];
    try {
      const form = new FormData();
      form.append('image', {
        uri: asset.uri,
        name: asset.fileName || `avatar-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
      const up = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAvatar(up.data.url);
      toast?.show('Photo updated — remember to save.', 'success');
    } catch (e) {
      toast?.show(e.safeMessage || 'Upload failed.', 'error');
    }
  };

  const save = async () => {
    if (!name.trim()) { toast?.show('Your name can’t be empty.', 'error'); return; }
    setSaving(true);
    try {
      await api.put('/users/me', {
        name: name.trim(),
        title: title.trim(),
        bio: bio.trim(),
        avatar,
        drinks: user?.drinks || '{}',
        onboarded: 1,
      });
      await patchUser({ name: name.trim(), title: title.trim(), bio: bio.trim(), avatar });
      try { await refresh(); } catch {}
      toast?.show('Profile saved.', 'success');
      navigation.goBack();
    } catch (e) {
      toast?.show(e.safeMessage || 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header
        title="Edit profile"
        onBack={() => navigation.goBack()}
        right={<Button label="Save" size="sm" onPress={save} loading={saving} />}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 26 }}>
            <Pressable onPress={pickAvatar} accessibilityLabel="Change profile photo">
              <Avatar uri={avatar} name={name} size={96} />
              <View style={[styles.camera, { backgroundColor: t.accent, borderColor: t.bg }]}>
                <Icon name="camera" size={15} color={t.textOnAccent} />
              </View>
            </Pressable>
            <Text style={[type.caption, { color: t.textMuted, marginTop: 10 }]}>Tap to change photo</Text>
          </View>

          <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" maxLength={60} autoCapitalize="words" />
          <Field label="Headline" value={title} onChangeText={setTitle} placeholder="CFO by day, sommelier by night" maxLength={80} />
          <Field label="Bio" value={bio} onChangeText={setBio} placeholder="What are you drinking these days?" multiline maxLength={MAX_BIO} counter />

          <View style={[styles.readonly, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
            <Icon name="mail-outline" size={16} color={t.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[type.caption, { color: t.textMuted }]}>Email</Text>
              <Text style={[type.body, { color: t.text }]}>{user?.email}</Text>
            </View>
            {user?.email_verified ? (
              <Icon name="checkmark-circle" size={18} color={t.success} />
            ) : (
              <Text style={[type.caption, { color: t.warning }]}>Unverified</Text>
            )}
          </View>
          <Text style={[type.caption, { color: t.textMuted, marginTop: 8, lineHeight: 17 }]}>
            Email changes aren’t supported yet — contact support if you need to update it.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  input: { borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  camera: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  readonly: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, borderWidth: 1, padding: 14 },
});
