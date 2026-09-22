// src/screens/explore/useExplorePostActions.js
// Report / block / delete for every moment Explore renders.
//
// Apple guideline 1.2 and Google Play's UGC policy both require reporting AND
// blocking to be reachable from the content itself — that includes the ones in
// a horizontal rail, not just the ones in a vertical feed.
//
// The reason picker is showReportSheet, never Alert.alert: Android's alert
// silently drops everything past the third button, which would lose two of the
// five reasons and the Cancel control with it.

import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui';
import { showReportSheet } from '../../lib/reportSheet';
import track from '../../lib/track';

const REASONS = [
  { key: 'unsafe_drinking', label: 'Encourages unsafe drinking' },
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'inappropriate', label: 'Sexual or violent content' },
  { key: 'other', label: 'Something else' },
];

export default function useExplorePostActions({ onRemoved } = {}) {
  const { user } = useAuth();
  const toast = useToast();

  // ToastProvider's context value is a fresh object on each of its renders, so
  // depending on `toast` directly would change every callback's identity each
  // time a toast appears — and re-render every memoised card in every rail.
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const submitReport = useCallback(
    async (post, reason) => {
      try {
        await api.post('/reports', {
          target_type: 'post',
          target_id: post.id,
          reason,
        });
        track('report_submitted', { surface: 'explore', target_type: 'post' });
        toastRef.current?.show('Reported. Our team will review it.', 'success');
      } catch (e) {
        toastRef.current?.show(e?.safeMessage || 'Could not send that report.', 'error');
      }
    },
    []
  );

  const chooseReason = useCallback(
    async (post) => {
      const reason = await showReportSheet({
        title: "Report this moment — what's wrong with it?",
        reasons: REASONS,
      });
      if (reason) await submitReport(post, reason);
    },
    [submitReport]
  );

  const blockUser = useCallback(
    (post) => {
      const name = post?.name || 'this member';
      Alert.alert(
        `Block ${name}?`,
        `You won't see ${name}'s moments, and they won't see yours. Any connection between you is removed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.post(`/blocks/${post.user_id}`);
                toastRef.current?.show(`${name} is blocked.`, 'success');
                // The second argument lets the screen tell a block (the member
                // must also leave the people rail) from a delete (they must not).
                onRemoved?.(post, 'block');
              } catch (e) {
                toastRef.current?.show(e?.safeMessage || 'Could not block that member.', 'error');
              }
            },
          },
        ]
      );
    },
    [onRemoved]
  );

  const confirmDelete = useCallback(
    (post) => {
      Alert.alert('Delete this moment?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/posts/${post.id}`);
              toastRef.current?.show('Moment deleted.', 'success');
              onRemoved?.(post, 'delete');
            } catch (e) {
              toastRef.current?.show(e?.safeMessage || 'Could not delete that.', 'error');
            }
          },
        },
      ]);
    },
    [onRemoved]
  );

  /** Entry point behind every post's options control. */
  const openMenu = useCallback(
    (post) => {
      if (!post?.id) return;

      if (post.user_id === user?.id) {
        // Two buttons plus Cancel is the most Android's alert renders reliably.
        Alert.alert('Your moment', null, [
          { text: 'Delete moment', style: 'destructive', onPress: () => confirmDelete(post) },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      Alert.alert(post.name || 'Options', null, [
        { text: 'Report this moment', onPress: () => chooseReason(post) },
        {
          text: `Block ${post.name || 'this member'}`,
          style: 'destructive',
          onPress: () => blockUser(post),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [user?.id, chooseReason, blockUser, confirmDelete]
  );

  return { openMenu, blockUser, submitReport };
}
