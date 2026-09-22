// src/screens/places/usePlaceUgcActions.js
// Report + Block for everything the Places pillar renders that a member wrote:
// the stories told at a venue, and the venue entry itself (anyone can add a
// place, so a place row is user-generated content too).
//
// App Store 1.2 and Play's UGC policy both require reporting AND blocking to be
// reachable from the content itself. Multi-choice pickers always go through
// showReportSheet — Android's Alert silently drops everything past the third
// button, which would eat reasons and Cancel. Alert is used only for the
// two-button destructive confirmations, which are safe on both platforms.

import { useCallback } from 'react';
import { Alert } from 'react-native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui';
import { showReportSheet } from '../../lib/reportSheet';
import { track } from '../../lib/track';

// Mirrors src/hooks/usePostActions.js so the moderation queue sees one
// vocabulary regardless of which surface a report came from.
const STORY_REASONS = [
  { key: 'unsafe_drinking', label: 'Encourages unsafe drinking' },
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'inappropriate', label: 'Sexual or violent content' },
  { key: 'other', label: 'Something else' },
];

// A venue has its own failure modes — most reports here are data quality, not
// abuse, but the abuse paths still have to exist.
const PLACE_REASONS = [
  { key: 'place_wrong_details', label: 'Wrong name, address or details' },
  { key: 'place_duplicate', label: 'Duplicate of another place' },
  { key: 'place_closed', label: 'Permanently closed' },
  { key: 'place_not_real', label: 'Not a real place' },
  { key: 'inappropriate', label: 'Offensive or inappropriate' },
  { key: 'other', label: 'Something else' },
];

// The sheet is a singleton with one exit animation. Raising the second sheet
// inside the first one's closing frame leaves it parked off-screen, so let the
// first finish before opening the next.
const SHEET_GAP_MS = 340;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function usePlaceUgcActions({ onStoryRemoved, onAuthorBlocked } = {}) {
  const { user } = useAuth();
  const toast = useToast();

  const submitReport = useCallback(
    async ({ targetType, targetId, reasons, title }) => {
      if (targetId == null) return;
      const reason = await showReportSheet({ title, reasons });
      if (!reason) return;
      try {
        await api.post('/reports', {
          target_type: targetType,
          target_id: targetId,
          reason,
        });
        toast?.show('Reported. Our team will review it.', 'success');
        track('places_report', { target: targetType });
      } catch (e) {
        toast?.show(e?.safeMessage || 'Could not send that report.', 'error');
      }
    },
    [toast]
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
                track('places_block');
                onAuthorBlocked?.(memberId);
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

  const deleteStory = useCallback(
    (story) => {
      if (!story?.id) return;
      Alert.alert('Delete this story?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/posts/${story.id}`);
              toast?.show('Story deleted.', 'success');
              onStoryRemoved?.(story);
            } catch (e) {
              toast?.show(e?.safeMessage || 'Could not delete that.', 'error');
            }
          },
        },
      ]);
    },
    [toast, onStoryRemoved]
  );

  /** The "…" on any story card at a place. */
  const openStoryMenu = useCallback(
    async (story) => {
      if (!story?.id) return;
      const authorId = story.user_id;
      const authorName = story.name || 'this member';
      const mine = authorId != null && String(authorId) === String(user?.id);

      const options = mine
        ? [{ key: 'delete', label: 'Delete this story' }]
        : [
            { key: 'report', label: 'Report this story' },
            ...(authorId != null ? [{ key: 'block', label: `Block ${authorName}` }] : []),
          ];

      const choice = await showReportSheet({
        title: mine ? 'Your story' : authorName,
        reasons: options,
      });
      if (!choice) return;

      await wait(SHEET_GAP_MS);
      if (choice === 'delete') deleteStory(story);
      else if (choice === 'block') blockMember(authorId, authorName);
      else if (choice === 'report') {
        await submitReport({
          targetType: 'post',
          targetId: story.id,
          reasons: STORY_REASONS,
          title: 'What’s wrong with this story?',
        });
      }
    },
    [user?.id, deleteStory, blockMember, submitReport]
  );

  /** The "…" on a place profile. */
  const openPlaceMenu = useCallback(
    async (place) => {
      if (!place?.id) return;
      const choice = await showReportSheet({
        title: place.name || 'This place',
        reasons: [{ key: 'report', label: 'Report this place' }],
      });
      if (choice !== 'report') return;

      await wait(SHEET_GAP_MS);
      await submitReport({
        targetType: 'place',
        targetId: place.id,
        reasons: PLACE_REASONS,
        title: 'What’s wrong with this place?',
      });
    },
    [submitReport]
  );

  return { openStoryMenu, openPlaceMenu, blockMember, submitReport };
}
