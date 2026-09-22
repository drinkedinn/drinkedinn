// src/screens/messages/useThreadActions.js
// Report / Block menu for a direct-message thread. Mirrors usePostActions
// (Apple 1.2 / Play UGC) but targets a person rather than a post, because in
// a 1:1 thread the offending content IS the person on the other side.
//
// Reasons and copy stay in the messaging register — "message" and "conversation"
// instead of "pour" — so a report from a DM never reads like a mislabelled feed
// action.

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { showReportSheet } from '../../lib/reportSheet';
import api from '../../api';
import { useToast } from '../../components/ui';

const REASONS = [
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'unsafe_drinking', label: 'Encourages unsafe drinking' },
  { key: 'inappropriate', label: 'Sexual or violent messages' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'impersonation', label: 'Impersonation' },
  { key: 'other', label: 'Something else' },
];

/**
 * useThreadActions({ userId, name, onBlocked })
 * openMenu() shows Report / Block. Block calls onBlocked() after success so
 * the screen can navigate back — a thread with a blocked person must not stay
 * open (they'd sit on the message list while the /messages/:userId endpoint
 * silently 404s on refresh).
 */
export default function useThreadActions({ userId, name, onBlocked } = {}) {
  const toast = useToast();
  const who = name || 'this member';

  const submitReport = useCallback(
    async (reason) => {
      if (!userId) return;
      try {
        await api.post('/reports', {
          target_type: 'user',
          target_id: userId,
          reason,
        });
        toast?.show('Reported. Our team will review it.', 'success');
      } catch (e) {
        toast?.show(e.safeMessage || 'Could not send that report.', 'error');
      }
    },
    [userId, toast]
  );

  const chooseReason = useCallback(async () => {
    const key = await showReportSheet({ title: `Report ${who}? What's wrong with this conversation?`, reasons: REASONS });
    if (key) submitReport(key);
  }, [who, submitReport]);

  const block = useCallback(() => {
    if (!userId) return;
    Alert.alert(
      `Block ${who}?`,
      `You won't see ${who}'s messages or pours, and they won't see yours. Any connection between you is removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/blocks/${userId}`);
              toast?.show(`${who} is blocked.`, 'success');
              onBlocked?.();
            } catch (e) {
              toast?.show(e.safeMessage || 'Could not block that member.', 'error');
            }
          },
        },
      ]
    );
  }, [userId, who, toast, onBlocked]);

  const openMenu = useCallback(() => {
    if (!userId) return;
    Alert.alert(who, null, [
      { text: 'Report this conversation', onPress: chooseReason },
      { text: `Block ${who}`, style: 'destructive', onPress: block },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [userId, who, chooseReason, block]);

  return { openMenu, block, submitReport };
}
