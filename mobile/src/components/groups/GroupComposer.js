// src/components/groups/GroupComposer.js
// The inline composer that sits above the post list on GroupDetailScreen.
// Members-only. Short text + one optional photo — group_posts on the server
// take { content, drink, image_url }, and image is uploaded through /upload
// exactly like the main composer.

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Avatar, Bounce, Icon, useToast } from '../ui';
import track from '../../lib/track';

const MAX = 500;

export default function GroupComposer({ groupId, groupDrink = '🥃', onPosted }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(0);
  const [posting, setPosting] = useState(false);
  const inputRef = useRef(null);

  const pickImage = useCallback(async (fromCamera) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast?.show(fromCamera ? 'Camera access is needed.' : 'Photo access is needed.', 'error');
        return;
      }
      const opts = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      };
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (!res.canceled && res.assets?.[0]) setImage(res.assets[0]);
    } catch (e) {
      toast?.show('Could not open the picker.', 'error');
    }
  }, [toast]);

  const addPhoto = useCallback(() => {
    if (image) { setImage(null); return; }
    Alert.alert('Add a photo', 'Show the group the glass.', [
      { text: 'Take photo', onPress: () => pickImage(true) },
      { text: 'Choose from library', onPress: () => pickImage(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [image, pickImage]);

  const submit = useCallback(async () => {
    const body = content.trim();
    if (!body && !image) {
      toast?.show('Share a moment first.', 'error');
      return;
    }
    if (body.length > MAX) {
      toast?.show(`That's ${body.length - MAX} characters over.`, 'error');
      return;
    }

    setPosting(true);
    try {
      let image_url = '';
      if (image) {
        setUploading(0.02);
        const form = new FormData();
        form.append('image', {
          uri: image.uri,
          name: image.fileName || `group-${Date.now()}.jpg`,
          type: image.mimeType || 'image/jpeg',
        });
        const up = await api.post('/upload', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e?.total) setUploading(Math.min(0.98, e.loaded / e.total));
          },
        });
        image_url = up.data?.url || '';
        setUploading(1);
      }

      const res = await api.post(`/groups/${groupId}/posts`, {
        content: body,
        drink: groupDrink,
        image_url,
      });

      track('group_post_created', { group_id: groupId, has_image: !!image_url });
      toast?.show('Shared with the group.', 'success');
      setContent('');
      setImage(null);
      setUploading(0);
      inputRef.current?.blur();
      onPosted?.(res.data);
    } catch (e) {
      toast?.show(e?.safeMessage || 'Could not share that.', 'error');
    } finally {
      setPosting(false);
    }
  }, [content, image, groupId, groupDrink, onPosted, toast]);

  const remaining = MAX - content.length;
  const canPost = (content.trim().length > 0 || !!image) && content.length <= MAX && !posting;
  const uploadPct = Math.round(uploading * 100);

  return (
    <View style={[styles.wrap, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.row}>
        <Avatar uri={user?.avatar} name={user?.name} size={36} />
        <TextInput
          ref={inputRef}
          value={content}
          onChangeText={setContent}
          placeholder="Share a moment with the group…"
          placeholderTextColor={t.textMuted}
          multiline
          style={[styles.input, { color: t.text }]}
          maxLength={MAX + 40}
        />
      </View>

      {!!image && (
        <View style={[styles.preview, { borderColor: t.border }]}>
          <Image source={{ uri: image.uri }} style={styles.previewImg} contentFit="cover" transition={200} />
          {posting && uploading > 0 && uploading < 1 && (
            <View style={[StyleSheet.absoluteFill, styles.progress]}>
              <ActivityIndicator color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', marginTop: 6 }}>{uploadPct}%</Text>
            </View>
          )}
          <Bounce
            onPress={() => setImage(null)}
            haptic="light"
            style={[styles.rm, { backgroundColor: t.scrim }]}
            accessibilityLabel="Remove photo"
          >
            <Icon name="close" size={15} color="#fff" />
          </Bounce>
        </View>
      )}

      <View style={styles.footer}>
        <Bounce
          onPress={addPhoto}
          haptic="light"
          hitSlop={8}
          disabled={posting}
          accessibilityLabel={image ? 'Remove photo' : 'Add a photo'}
          style={styles.iconBtn}
        >
          <Icon name={image ? 'image' : 'image-outline'} size={19} color={image ? t.accent : t.textSecondary} />
        </Bounce>

        <View style={{ flex: 1 }} />

        {content.length > 0 && (
          <Text
            style={[
              type.caption,
              { color: remaining < 0 ? t.danger : remaining <= 60 ? t.warning : t.textMuted, fontVariant: ['tabular-nums'] },
            ]}
          >
            {remaining}
          </Text>
        )}

        <Bounce
          onPress={submit}
          haptic="medium"
          disabled={!canPost}
          style={[styles.send, { backgroundColor: canPost ? t.accent : t.surfaceAlt }]}
          accessibilityLabel="Share with group"
        >
          {posting ? (
            <ActivityIndicator size="small" color={t.textOnAccent} />
          ) : (
            <Icon name="arrow-up" size={18} color={canPost ? t.textOnAccent : t.textMuted} />
          )}
        </Bounce>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 140,
    fontSize: 15,
    lineHeight: 21,
    paddingTop: Platform.OS === 'ios' ? 9 : 4,
    paddingBottom: 4,
  },
  preview: {
    marginTop: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewImg: { width: '100%', aspectRatio: 4 / 3 },
  progress: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rm: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
