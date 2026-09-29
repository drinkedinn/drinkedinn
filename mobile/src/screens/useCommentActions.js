// src/screens/useCommentActions.js
// Report + Block for comments.
//
// Comments were the one user-generated surface in the app with no moderation
// affordance at all: no "…", no long-press, no menu. The server has accepted
// target_type 'comment' since reports.js was written, and nothing ever sent
// one.
//
// That is worse than an omission, because both the published Child Safety
// Standards (client/src/components/LegalPage.jsx) and the in-app settings
// footer state that "every post, story, comment, profile, message, group and
// event" carries a report option. The product promised a safety control it did
// not have — and comments are the easiest harassment surface there is, since
// anyone who can see a post can write under it.
//
// Shapes and vocabulary mirror usePlaceUgcActions.js so the moderation queue
// sees one set of reasons regardless of which surface a report came from.

import { useCallback } from 'react';
import { Alert } from 'react-native';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui';
import { showReportSheet } from '../lib/reportSheet';
import { track } from '../lib/track';

const COMMENT_REASONS = [
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'inappropriate', label: 'Sexual or violent content' },
  { key: 'unsafe_drinking', label: 'Encourages unsafe drinking' },
  { key: 'other', label: 'Something else' },
];

// The sheet is a singleton with one exit animation; opening the next inside
// the previous one's closing frame leaves it parked off-screen.
const SHEET_GAP_MS = 340;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function useCommentActions({ onAuthorBlocked } = {}) {
  const { user } = useAuth();
  const toast = useToast();

  const reportComment = useCallback(
    async (comment) => {
      if (comment?.id == null) return;
      const reason = await showReportSheet({
        title: "Report this comment — what's wrong?",
        reasons: COMMENT_REASONS,
      });
      if (!reason) return;
      try {
        await api.post('/reports', {
          target_type: 'comment',
          target_id: comment.id,
          reason,
        });
        toast?.show('Reported. Our team will review it.', 'success');
        track('comment_report', { reason });
      } catch (e) {
        toast?.show(e?.safeMessage || 'Could not send that report.', 'error');
      }
    },
    [toast]
  );

  const blockAuthor = useCallback(
    (authorId, authorName) => {
      if (authorId == null) return;
      const who = authorName || 'this member';
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
                await api.post(`/blocks/${authorId}`);
                toast?.show(`${who} is blocked.`, 'success');
                track('comment_block');
                onAuthorBlocked?.(authorId);
              } catch (e) {
                toast?.show(e?.safeMessage || 'Could not block that member.', 'error');
              }
            },
          },
        ]
      );
    },
    [toast, onAuthorBlocked]
  );

  /** The "…" on a comment. */
  const openCommentMenu = useCallback(
    async (comment) => {
      if (comment?.id == null) return;
      const authorId = comment.user_id;
      const authorName = comment.name || 'this member';
      const mine = authorId != null && String(authorId) === String(user?.id);

      // Reporting your own comment is noise for the moderation queue, and
      // there is no DELETE endpoint for comments yet, so an own comment has
      // nothing to offer. Saying so beats opening an empty sheet.
      if (mine) {
        toast?.show('This is your own comment.', 'info');
        return;
      }

      const choice = await showReportSheet({
        title: `${authorName}’s comment`,
        reasons: [
          { key: 'report', label: 'Report this comment' },
          { key: 'block', label: `Block ${authorName}` },
        ],
      });
      if (!choice) return;

      await wait(SHEET_GAP_MS);
      if (choice === 'report') return reportComment(comment);
      if (choice === 'block') return blockAuthor(authorId, authorName);
    },
    [user?.id, toast, reportComment, blockAuthor]
  );

  return { openCommentMenu, reportComment, blockAuthor };
}
