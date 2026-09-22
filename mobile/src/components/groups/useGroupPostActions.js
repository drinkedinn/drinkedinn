// src/components/groups/useGroupPostActions.js
// Report / block menu for posts inside a group. Mirrors the pattern in
// src/hooks/usePostActions.js — report via POST /reports and block via
// POST /blocks/:userId — but omits the "delete" branch, because the group-post
// server contract does not expose a delete endpoint. Own posts open no menu.

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { showReportSheet } from '../../lib/reportSheet';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui';

const REASONS = [
  { key: 'unsafe_drinking', label: 'Encourages unsafe drinking' },
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'inappropriate', label: 'Sexual or violent content' },
  { key: 'other', label: 'Something else' },
];

export default function useGroupPostActions({ onRemoved } = {}) {
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
        toast?.show(e?.safeMessage || 'Could not send that report.', 'error');
      }
    },
    [toast]
  );

  const chooseReason = useCallback(
    async (post) => {
      const key = await showReportSheet({ title: "Report this pour — what's wrong with it?", reasons: REASONS });
      if (key) submitReport(post, key);
    },
    [submitReport]
  );

  const blockUser = useCallback(
    (post) => {
      const name = post?.name || 'this member';
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
                toast?.show(e?.safeMessage || 'Could not block that member.', 'error');
              }
            },
          },
        ]
      );
    },
    [toast, onRemoved]
  );

  const openMenu = useCallback(
    (post) => {
      if (!post) return;
      // We don't offer any action on your own post — the server has no
      // group-post delete route, and pretending would be worse than nothing.
      if (post.user_id === user?.id) return;

      Alert.alert(post.name || 'Options', null, [
        { text: 'Report this pour', onPress: () => chooseReason(post) },
        {
          text: `Block ${post.name || 'this member'}`,
          style: 'destructive',
          onPress: () => blockUser(post),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [user?.id, chooseReason, blockUser]
  );

  return { openMenu, blockUser, submitReport };
}
