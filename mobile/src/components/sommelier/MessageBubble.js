// src/components/sommelier/MessageBubble.js
// A single message row in the Innkeeper chat.
//
// User messages sit on the right in an accent bubble; the Innkeeper's replies
// sit on the left in a surface bubble with the shared border treatment. An
// avatar-sized sparkle mark anchors assistant replies so the thread has a
// clear conversational rhythm even without profile photos.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon } from '../ui';
import RichText from './RichText';

export default function MessageBubble({ role, content, error }) {
  const { t } = useTheme();
  const isUser = role === 'user';

  if (isUser) {
    return (
      <View style={[styles.row, styles.rowRight]}>
        <View style={[styles.bubble, styles.userBubble, { backgroundColor: t.accent }]}>
          <Text
            style={[type.body, { color: t.textOnAccent, lineHeight: 22 }]}
            selectable
          >
            {content}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, styles.rowLeft]}>
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: error ? t.dangerSoft : t.accentSoft,
            borderColor: error ? t.danger : t.accentBorder,
          },
        ]}
      >
        <Icon
          name={error ? 'alert-circle-outline' : 'sparkles-outline'}
          size={15}
          color={error ? t.danger : t.accent}
        />
      </View>
      <View
        style={[
          styles.bubble,
          styles.assistantBubble,
          {
            backgroundColor: t.surface,
            borderColor: error ? t.danger : t.border,
          },
        ]}
      >
        <RichText
          text={content}
          style={[type.body, { color: error ? t.danger : t.text, lineHeight: 22 }]}
          boldStyle={{ fontWeight: '700', color: error ? t.danger : t.text }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 5,
    alignItems: 'flex-end',
    gap: 8,
  },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.lg,
  },
  assistantBubble: {
    borderTopLeftRadius: 4,
    borderWidth: 1,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
});
