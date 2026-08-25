// src/hooks/usePostActions.js
// The report / block menu behind every post's options button.
// Apple guideline 1.2 and Google Play's UGC policy both require in-app
// reporting AND blocking to be reachable from the content itself.

import { useCallback } from 'react';
import { Alert } from 'react-native';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';

const REASONS = [
  { key: 'unsafe_drinking', label: 'Encourages unsafe drinking' },
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'inappropriate', label: 'Sexual or violent content' },
  { key: 'other', label: 'Something else' },
];

export default function usePostActions({ onRemoved } = {}) {
  const { user } = useAuth();
  const toast = useToast();

  const submitReport = useCallback(
    async (post, reason) => {
      try {
        await api.post('/reports', {
          target_type: 'post',
          target_id: post.id,
          reason,
        });
        toast?.show('Reported. Our team will review it.', 'success');
      } catch (e) {
        toast?.show(e.safeMessage || 'Could not send that report.', 'error');
      }
    },
    [toast]
  );

  const blockUser = useCallback(
    (post) => {
      const name = post.name || 'this member';
      Alert.alert(
        `Block ${name}?`,
        `You won't see ${name}'s pours, and they won't see yours. Any connection between you is removed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.post(`/blocks/${post.user_id}`);
                toast?.show(`${name} is blocked.`, 'success');
                onRemoved?.(post);
              } catch (e) {
                toast?.show(e.safeMessage || 'Could not block that member.', 'error');
              }
            },
          },
        ]
      );
    },
    [toast, onRemoved]
  );

  const chooseReason = useCallback(
    (post) => {
      Alert.alert('Report this pour', 'What’s wrong with it?', [
        ...REASONS.map((r) => ({ text: r.label, onPress: () => submitReport(post, r.key) })),
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [submitReport]
  );

  // Entry point wired to the options button on every post.
  const openMenu = useCallback(
    (post) => {
      if (!post) return;
      const mine = post.user_id === user?.id;

      const options = mine
        ? [
            {
              text: 'Delete pour',
              style: 'destructive',
              onPress: () =>
                Alert.alert('Delete this pour?', 'This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await api.delete(`/posts/${post.id}`);
                        toast?.show('Pour deleted.', 'success');
                        onRemoved?.(post);
                      } catch (e) {
                        toast?.show(e.safeMessage || 'Could not delete that.', 'error');
                      }
                    },
                  },
                ]),
            },
          ]
        : [
            { text: 'Report this pour', onPress: () => chooseReason(post) },
            { text: `Block ${post.name || 'this member'}`, style: 'destructive', onPress: () => blockUser(post) },
          ];

      Alert.alert(mine ? 'Your pour' : post.name || 'Options', null, [
        ...options,
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [user?.id, chooseReason, blockUser, toast, onRemoved]
  );

  return { openMenu, blockUser, submitReport };
}
