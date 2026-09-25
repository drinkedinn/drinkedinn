// src/components/onboarding/SuggestionRow.js
// One suggested person from /onboarding/suggestions with a Follow toggle.
// Optimistic and rollback on failure — the row owns its own pending state so
// the parent list stays simple.

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Avatar, Icon, Bounce, useToast } from '../ui';

export default function SuggestionRow({ person, following, onChange }) {
  const { t } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (busy) return;
    const next = !following;
    setBusy(true);
    onChange?.(person.id, next); // optimistic
    try {
      const res = await api.post(`/users/${person.id}/connect`);
      const server = !!res?.data?.connected;
      if (server !== next) onChange?.(person.id, server);
    } catch (e) {
      onChange?.(person.id, !next); // rollback
      toast?.show(e?.safeMessage || 'Could not update that.', 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, following, person.id, onChange, toast]);

  const followers = Number(person.followers || 0);
  const posts = Number(person.posts || 0);
  const meta = [
    person.title || null,
    followers > 0 ? `${followers} follower${followers === 1 ? '' : 's'}` : null,
    posts > 0 ? `${posts} pour${posts === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Avatar uri={person.avatar} name={person.name || '?'} size={48} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={styles.nameRow}>
          <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
            {person.name || 'A member'}
          </Text>
          {!!person.verified && <Icon name="checkmark-circle" size={14} color={t.blue} />}
        </View>
        {!!meta && (
          <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>

      <Bounce
        onPress={toggle}
        haptic={following ? 'light' : 'medium'}
        scaleTo={0.94}
        accessibilityLabel={following ? `Unfollow ${person.name || 'this member'}` : `Follow ${person.name || 'this member'}`}
        style={[
          styles.followBtn,
          following
            ? { backgroundColor: t.surfaceAlt, borderColor: t.border }
            : { backgroundColor: t.accent, borderColor: 'transparent' },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={following ? t.text : t.textOnAccent} />
        ) : (
          <>
            <Icon
              name={following ? 'checkmark' : 'add'}
              size={16}
              color={following ? t.text : t.textOnAccent}
            />
            <Text style={{ color: following ? t.text : t.textOnAccent, fontWeight: '700', fontSize: 13 }}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </>
        )}
      </Bounce>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    minWidth: 96,
    justifyContent: 'center',
  },
});
