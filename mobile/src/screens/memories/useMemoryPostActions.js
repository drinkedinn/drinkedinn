// src/screens/memories/useMemoryPostActions.js
// Report / block for a post shown inside the memory viewer.
//
// A memory is built from the viewer's OWN posts (server/routes/memories.js
// filters on p.user_id = req.user.id), so in practice this menu never opens.
// It exists because the viewer renders whatever the endpoint returns, and if
// that contract ever widens to shared or tagged memories the UGC obligations
// (App Store 1.2, Play UGC) must already be satisfied — not retrofitted.
//
// Every step is a bottom sheet rather than an Alert with a stack of buttons:
// Android's dialog silently truncates to three buttons, which is how report
// flows lose reasons. See src/lib/reportSheet.js.

import { useCallback } from 'react';
import { Alert } from 'react-native';
import api from '../../api';
import { showReportSheet } from '../../lib/reportSheet';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui';

const REASONS = [
  { key: 'unsafe_drinking', label: 'Encourages unsafe drinking' },
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'inappropriate', label: 'Sexual or violent content' },
  { key: 'other', label: 'Something else' },
];

export default function useMemoryPostActions({ onRemoved } = {}) {
  const { user } = useAuth();
  const toast = useToast();

  const isMine = useCallback(
    (post) => user?.id != null && post?.user_id != null && String(post.user_id) === String(user.id),
    [user?.id],
  );

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
        // Never echo the raw error: a 404 here would reveal a block exists.
        toast?.show(e?.safeMessage || 'Could not send that report.', 'error');
      }
    },
    [toast],
  );

  const chooseReason = useCallback(
    async (post) => {
      const reason = await showReportSheet({
        title: 'Report this moment — what’s wrong with it?',
        reasons: REASONS,
      });
      if (reason) await submitReport(post, reason);
    },
    [submitReport],
  );

  // Wrapped in a promise so the viewer can keep its progress bar paused until
  // the member has actually finished deciding.
  const blockUser = useCallback(
    (post) =>
      new Promise((resolve) => {
        const name = post?.name || 'this member';
        let settled = false;
        const done = (v) => { if (!settled) { settled = true; resolve(v); } };

        Alert.alert(
          `Block ${name}?`,
          `You won’t see ${name}’s moments, and they won’t see yours. Any connection between you is removed.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => done(false) },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                try {
                  await api.post(`/blocks/${post?.user_id}`);
                  toast?.show(`${name} is blocked.`, 'success');
                  onRemoved?.(post);
                  done(true);
                } catch (e) {
                  toast?.show(e?.safeMessage || 'Could not block that member.', 'error');
                  done(false);
                }
              },
            },
          ],
          // Android's hardware back dismisses without firing any onPress — without
          // this the promise would never settle and the viewer would stay paused.
          { cancelable: true, onDismiss: () => done(false) },
        );
      }),
    [toast, onRemoved],
  );

  /** Resolves once the member is done with the menu (or dismissed it). */
  const openMenu = useCallback(
    async (post) => {
      if (!post?.id) return;
      // Defensive: your own moment has nothing to report and nobody to block.
      if (isMine(post)) return;

      const name = post.name || 'this member';
      const choice = await showReportSheet({
        title: name,
        reasons: [
          { key: 'report', label: 'Report this moment' },
          { key: 'block', label: `Block ${name}` },
        ],
      });

      if (choice === 'report') await chooseReason(post);
      else if (choice === 'block') await blockUser(post);
    },
    [isMine, chooseReason, blockUser],
  );

  return { openMenu, blockUser, submitReport, isMine };
}
