// src/screens/profile/useProfileUgcActions.js
// Report + Block for every piece of member content the pillars render.
//
// App Store 1.2 and Play's UGC policy both require reporting AND blocking to be
// reachable from the content itself, not buried in settings — so every tile,
// row and card that shows something another member wrote carries a "…".
//
// Cross-platform rule this module exists to enforce: Android's Alert dialog
// silently drops everything past the third button, so a five-reason picker
// loses reasons and Cancel on Android. Multi-choice therefore always goes
// through showReportSheet (src/lib/reportSheet.js). Alert is used only for the
// two-button block confirmation, which is safe everywhere.

import { useCallback } from 'react';
import { Alert } from 'react-native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui';
import { showReportSheet } from '../../lib/reportSheet';
import track from '../../lib/track';

// Reasons mirror src/hooks/usePostActions.js so the moderation queue sees one
// vocabulary no matter which surface a report came from.
const REASONS = [
  { key: 'unsafe_drinking', label: 'Encourages unsafe drinking' },
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'inappropriate', label: 'Sexual or violent content' },
  { key: 'other', label: 'Something else' },
];

// The sheet is a singleton with one exit animation. Opening the second sheet
// inside the first one's closing frame leaves it parked off-screen, so let the
// first finish before raising the next.
const SHEET_GAP_MS = 340;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function useProfileUgcActions({ onBlocked } = {}) {
  const { user } = useAuth();
  const toast = useToast();

  const submitReport = useCallback(
    async ({ targetType, targetId, noun = 'moment' }) => {
      if (targetId == null) return;
      const reason = await showReportSheet({
        title: `What’s wrong with this ${noun}?`,
        reasons: REASONS,
      });
      if (!reason) return;
      try {
        await api.post('/reports', {
          target_type: targetType,
          target_id: targetId,
          reason,
        });
        toast?.show('Reported. Our team will review it.', 'success');
        track('profile_pillar_report', { target: targetType });
      } catch (e) {
        toast?.show(e?.safeMessage || 'Could not send that report.', 'error');
      }
    },
    [toast],
  );

  const blockMember = useCallback(
    (memberId, memberName) => {
      if (memberId == null) return;
      const who = memberName || 'this member';
      Alert.alert(
        `Block ${who}?`,
        `You won’t see ${who}’s moments, and they won’t see yours. Any connection between you is removed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.post(`/blocks/${memberId}`);
                toast?.show(`${who} is blocked.`, 'success');
                track('profile_pillar_block');
                onBlocked?.(memberId);
              } catch (e) {
                toast?.show(e?.safeMessage || 'Could not block that member.', 'error');
              }
            },
          },
        ],
      );
    },
    [toast, onBlocked],
  );

  /**
   * The "…" entry point.
   * @param targetType one of the server's TARGET_TYPES (post | story | place | user)
   * @param noun       what the sheet calls it in plain language
   * @param authorId   who made it — omit to hide the block option
   */
  const openMenu = useCallback(
    async ({ targetType = 'post', targetId, authorId, authorName, noun = 'moment' }) => {
      if (targetId == null) return;
      const mine = authorId != null && String(authorId) === String(user?.id);

      const options = [{ key: 'report', label: `Report this ${noun}` }];
      if (!mine && authorId != null) {
        options.push({ key: 'block', label: `Block ${authorName || 'this member'}` });
      }

      const choice = await showReportSheet({
        title: mine ? `Your ${noun}` : authorName || 'Options',
        reasons: options,
      });
      if (!choice) return;

      await wait(SHEET_GAP_MS);
      if (choice === 'report') {
        await submitReport({ targetType, targetId, noun });
      } else if (choice === 'block') {
        blockMember(authorId, authorName);
      }
    },
    [user?.id, submitReport, blockMember],
  );

  return { openMenu, submitReport, blockMember };
}
