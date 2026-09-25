// src/screens/explore/useExploreUserActions.js
// Report / block for a *member* — the person rows in search results and in the
// "People to pour with" rail.
//
// A profile row is user-generated content too (name, title, photo), and the
// profile screen it links to has no reporting path of its own, so the
// affordance has to live here or it doesn't exist at all. App Store 1.2 and
// Play's UGC policy both require it.
//
// Reasons go through showReportSheet — six of them would be silently cut to
// three by Alert.alert on Android.

import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui';
import { showReportSheet } from '../../lib/reportSheet';
import track from '../../lib/track';

const REASONS = [
  { key: 'impersonation', label: 'Pretending to be someone else' },
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'inappropriate', label: 'Inappropriate profile' },
  { key: 'underage', label: 'Appears to be under age' },
  { key: 'other', label: 'Something else' },
];

export default function useExploreUserActions({ onBlocked } = {}) {
  const { user } = useAuth();
  const toast = useToast();

  // See useExplorePostActions: the toast context value is not stable, so it is
  // held in a ref rather than listed as a dependency.
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const report = useCallback(
    async (person) => {
      const reason = await showReportSheet({
        title: `Report ${person?.name || 'this member'} — what's wrong?`,
        reasons: REASONS,
      });
      if (!reason) return;
      try {
        await api.post('/reports', {
          target_type: 'user',
          target_id: person.id,
          reason,
        });
        track('report_submitted', { surface: 'explore', target_type: 'user' });
        toastRef.current?.show('Reported. Our team will review it.', 'success');
      } catch (e) {
        toastRef.current?.show(e?.safeMessage || 'Could not send that report.', 'error');
      }
    },
    []
  );

  const block = useCallback(
    (person) => {
      const name = person?.name || 'this member';
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
                await api.post(`/blocks/${person.id}`);
                toastRef.current?.show(`${name} is blocked.`, 'success');
                onBlocked?.(person);
              } catch (e) {
                toastRef.current?.show(e?.safeMessage || 'Could not block that member.', 'error');
              }
            },
          },
        ]
      );
    },
    [onBlocked]
  );

  /** Entry point behind a person row's options control. */
  const openMenu = useCallback(
    (person) => {
      if (!person?.id || person.id === user?.id) return;
      Alert.alert(person.name || 'Options', null, [
        { text: 'Report this member', onPress: () => report(person) },
        { text: `Block ${person.name || 'this member'}`, style: 'destructive', onPress: () => block(person) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [user?.id, report, block]
  );

  return { openMenu, report, block };
}
