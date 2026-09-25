// src/components/messages/MessagesHeaderButton.js
// The chatbubbles icon that lives in the Feed header. Shows an unread badge
// driven by the shared useUnreadMessages hook so it stays in sync with the
// conversations list without either surface fighting the other over polls.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { Icon, Bounce } from '../ui';
import UnreadBadge from './UnreadBadge';
import useUnreadMessages from './useUnreadMessages';
import track from '../../lib/track';

export default function MessagesHeaderButton({ onPress, size = 34 }) {
  const { t } = useTheme();
  const nav = useNavigation();
  const { count } = useUnreadMessages();

  const handle = () => {
    track('messages_open_from_header', { unread: count || 0 });
    if (onPress) onPress();
    else nav.navigate('Conversations');
  };

  return (
    <Bounce
      onPress={handle}
      haptic="light"
      accessibilityLabel={count > 0 ? `Messages, ${count} unread` : 'Messages'}
      style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.surfaceAlt }]}
    >
      <Icon name="chatbubbles-outline" size={19} color={t.text} />
      {count > 0 && (
        <View style={[styles.badgeAnchor, { borderColor: t.bg }]}>
          <UnreadBadge count={count} size="sm" />
        </View>
      )}
    </Bounce>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  badgeAnchor: {
    position: 'absolute',
    top: -3,
    right: -4,
    borderWidth: 2,
    borderRadius: 999,
  },
});
