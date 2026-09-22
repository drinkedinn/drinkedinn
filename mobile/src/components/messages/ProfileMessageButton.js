// src/components/messages/ProfileMessageButton.js
// A ready-to-drop "Message" button for the ProfileScreen action bar.
// Kept as its own component so ProfileScreen doesn't need to know about the
// messages module — it just imports and places this next to Connect/Follow.
//
// Usage in ProfileScreen (integrator wires this):
//   <ProfileMessageButton user={viewedUser} />

import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../ui';
import track from '../../lib/track';

export default function ProfileMessageButton({ user, variant = 'secondary', size = 'md', full, style }) {
  const nav = useNavigation();
  if (!user?.id) return null;

  const openThread = () => {
    track('message_open_from_profile', { user_id: user.id });
    nav.navigate('Thread', {
      userId: user.id,
      name: user.name,
      avatar: user.avatar,
    });
  };

  return (
    <Button
      label="Message"
      icon="chatbubble-ellipses-outline"
      variant={variant}
      size={size}
      full={full}
      onPress={openThread}
      style={style}
    />
  );
}
