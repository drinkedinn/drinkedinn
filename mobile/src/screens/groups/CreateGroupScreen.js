// src/screens/groups/CreateGroupScreen.js
// The "start a group" modal. Name + optional description + an icon picked
// from the same DRINKS palette used everywhere else. On success the modal
// closes and the Groups list refreshes on focus to surface the new group.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, Platform, Pressable,
  KeyboardAvoidingView, Keyboard, Alert,
} from 'react-native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Icon, Button, useToast } from '../../components/ui';
import DrinkPicker from '../../components/compose/DrinkPicker';
import track from '../../lib/track';

const NAME_MAX = 40;
const DESC_MAX = 200;

function PreviewCard({ name, description, drink, hostName }) {
  const { t, elevation } = useTheme();
  return (
    <View
      style={[
        styles.preview,
        { backgroundColor: t.surface, borderColor: t.border },
        elevation(t, 1),
      ]}
    >
      <View style={[styles.previewCover, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
        <Text style={{ fontSize: 40 }}>{drink}</Text>
      </View>
      <View style={{ padding: 14 }}>
        <Text style={[type.h3, { color: t.text }]} numberOfLines={1}>
          {name.trim() || 'Your group name'}
        </Text>
        <Text
          style={[type.caption, { color: t.textSecondary, marginTop: 6, lineHeight: 17 }]}
          numberOfLines={2}
        >
          {description.trim() || 'A short line about what you gather around.'}
        </Text>
        <View style={styles.previewMeta}>
          <Icon name="people-outline" size={12} color={t.textMuted} />
          <Text style={[type.caption, { color: t.textMuted }]}>
            Just you · Started by {hostName}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function CreateGroupScreen({ navigation }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [drink, setDrink] = useState('🥃');
  const [creating, setCreating] = useState(false);
  const nameRef = useRef(null);

  const dirty = useMemo(
    () => name.trim() || description.trim() || drink !== '🥃',
    [name, description, drink]
  );

  const close = useCallback(() => {
    Keyboard.dismiss();
    if (!dirty || creating) {
      navigation.goBack();
      return;
    }
    Alert.alert('Discard this group?', 'Your details won’t be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }, [dirty, creating, navigation]);

  const submit = useCallback(async () => {
    const n = name.trim();
    if (!n) {
      toast?.show('Give your group a name.', 'error');
      nameRef.current?.focus();
      return;
    }
    if (n.length > NAME_MAX) {
      toast?.show(`Name is ${n.length - NAME_MAX} characters over.`, 'error');
      return;
    }

    setCreating(true);
    try {
      const res = await api.post('/groups', {
        name: n,
        description: description.trim(),
        drink_type: drink,
      });
      const created = res.data || {};
      track('group_created', { id: created.id, has_description: !!description.trim() });
      toast?.show('Doors open. Welcome, host.', 'success');
      // Close the modal — the Groups list refreshes on focus and the new
      // group lands under "Your groups".
      navigation.goBack();
    } catch (e) {
      toast?.show(e?.safeMessage || 'Could not start that group.', 'error');
      setCreating(false);
    }
  }, [name, description, drink, navigation, toast]);

  const canCreate = name.trim().length > 0 && !creating;
  const nameRemaining = NAME_MAX - name.length;
  const descRemaining = DESC_MAX - description.length;

  return (
    <Screen edges={['top']}>
      <View style={[styles.header, { borderBottomColor: t.divider }]}>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Cancel">
          <Text style={[type.body, { color: t.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Text style={[type.h3, { color: t.text }]}>Start a group</Text>
        <Button label="Create" size="sm" onPress={submit} loading={creating} disabled={!canCreate} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Live preview */}
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <PreviewCard
              name={name}
              description={description}
              drink={drink}
              hostName={user?.name || 'you'}
            />
          </View>

          {/* Name */}
          <View style={styles.fieldWrap}>
            <View style={styles.fieldHead}>
              <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>Name</Text>
              {name.length > 0 && (
                <Text
                  style={[
                    type.caption,
                    {
                      color: nameRemaining < 0 ? t.danger : nameRemaining <= 8 ? t.warning : t.textMuted,
                      fontVariant: ['tabular-nums'],
                    },
                  ]}
                >
                  {nameRemaining}
                </Text>
              )}
            </View>
            <View style={[styles.input, { backgroundColor: t.surface, borderColor: t.border }]}>
              <TextInput
                ref={nameRef}
                value={name}
                onChangeText={setName}
                placeholder="Whisky Wednesdays"
                placeholderTextColor={t.textMuted}
                style={[type.body, { color: t.text, flex: 1, paddingVertical: Platform.OS === 'ios' ? 12 : 8 }]}
                maxLength={NAME_MAX + 20}
                returnKeyType="next"
                autoFocus
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.fieldWrap}>
            <View style={styles.fieldHead}>
              <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>
                Description
              </Text>
              {description.length > 0 && (
                <Text
                  style={[
                    type.caption,
                    {
                      color: descRemaining < 0 ? t.danger : descRemaining <= 30 ? t.warning : t.textMuted,
                      fontVariant: ['tabular-nums'],
                    },
                  ]}
                >
                  {descRemaining}
                </Text>
              )}
            </View>
            <View style={[styles.input, { backgroundColor: t.surface, borderColor: t.border, paddingVertical: 4 }]}>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Who this room is for, and what you gather around."
                placeholderTextColor={t.textMuted}
                multiline
                style={[type.body, { color: t.text, minHeight: 84, paddingTop: 10, textAlignVertical: 'top', flex: 1 }]}
                maxLength={DESC_MAX + 40}
              />
            </View>
          </View>

          {/* Icon */}
          <View style={styles.fieldWrap}>
            <Text
              style={[
                type.overline,
                { color: t.textMuted, textTransform: 'uppercase', marginBottom: 10 },
              ]}
            >
              Choose an icon
            </Text>
            <DrinkPicker value={drink} onChange={setDrink} />
          </View>

          {/* Privacy note */}
          <View style={[styles.note, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
            <Icon name="information-circle-outline" size={17} color={t.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[type.label, { color: t.text }]}>Everyone can find this group</Text>
              <Text style={[type.caption, { color: t.textSecondary, marginTop: 3, lineHeight: 17 }]}>
                Groups on DrinkedInn are open — anyone can browse and join. Private groups are coming soon.
              </Text>
            </View>
          </View>

          <Text
            style={[
              type.caption,
              { color: t.textMuted, textAlign: 'center', marginTop: 18, paddingHorizontal: 40, lineHeight: 17 },
            ]}
          >
            Please keep the room welcoming. Groups that break community rules can be reported and closed.
          </Text>
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
  preview: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewCover: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  fieldWrap: {
    paddingHorizontal: 16,
    marginTop: 22,
  },
  fieldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 24,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
