// src/components/messages/MessageBubble.js
// A single message bubble. Own messages sit right with the accent fill;
// theirs sit left on the surface. Consecutive messages from the same author
// tuck into a single visual "run" — the tail-side corner tightens so the run
// reads as one utterance rather than a stack of separate bubbles.

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon } from '../ui';
import { clockTime } from '../../screens/messages/timeAgo';

export default function MessageBubble({
  message,
  mine,
  showTime,
  showTail,
  failed,
}) {
  const { t } = useTheme();
  if (!message) return null;

  const content = typeof message.content === 'string' ? message.content : '';

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: mine ? t.accent : t.surface,
            borderColor: mine ? 'transparent' : t.border,
            borderTopRightRadius: mine && showTail ? radius.sm : radius.lg,
            borderTopLeftRadius: !mine && showTail ? radius.sm : radius.lg,
          },
          message._pending && { opacity: 0.7 },
        ]}
      >
        <Text
          style={[
            type.body,
            {
              color: mine ? t.textOnAccent : t.text,
              lineHeight: 21,
            },
          ]}
          selectable
        >
          {content}
        </Text>
      </View>

      {(showTime || message._pending || failed) && (
        <View style={[styles.meta, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
          {failed ? (
            <>
              <Icon name="alert-circle" size={12} color={t.danger} />
              <Text style={[type.caption, { color: t.danger }]}>Tap to retry</Text>
            </>
          ) : message._pending ? (
            <>
              <ActivityIndicator size="small" color={t.textMuted} />
              <Text style={[type.caption, { color: t.textMuted }]}>Sending…</Text>
            </>
          ) : (
            <Text style={[type.caption, { color: t.textMuted }]}>
              {clockTime(message.created_at)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    marginTop: 2,
  },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    marginBottom: 2,
    maxWidth: '82%',
  },
});
