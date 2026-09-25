// src/screens/onboarding-v2/useSuggestedPeople.js
// Everything behind the "Find your people" step: loading GET
// /onboarding/suggestions, the one-tap follow, and the report / block menu that
// has to exist wherever user content is shown.
//
// There is deliberately no contacts path here. Reading the address book would
// put the app under Google Play's Contacts Permissions policy and make
// READ_CONTACTS a declaration we would have to defend at every review, and the
// server already knows who is worth suggesting. Server suggestions are the only
// source, now and later.

import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui';
import { showReportSheet } from '../../lib/reportSheet';
import track from '../../lib/track';
import * as haptics from '../../ui/haptics';

// Profile reports. 'csae' matches the prefix the server escalates to P0 and
// never de-duplicates — child-safety reports are always recorded.
const REPORT_REASONS = [
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'impersonation', label: 'Fake profile or impersonation' },
  { key: 'inappropriate', label: 'Sexual or violent content' },
  { key: 'csae', label: 'Child safety concern' },
  { key: 'other', label: 'Something else' },
];

export default function useSuggestedPeople() {
  const { user } = useAuth();
  const toast = useToast();

  const [suggestions, setSuggestions] = useState(null); // null = still loading
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [followed, setFollowed] = useState({});
  const [busyIds, setBusyIds] = useState({});

  const load = useCallback(async () => {
    try {
      const res = await api.get('/onboarding/suggestions');
      const list = Array.isArray(res?.data?.suggestions) ? res.data.suggestions : [];
      setSuggestions(list.filter((p) => p && p.id != null && p.id !== user?.id));
      setFailed(false);
    } catch {
      // Silent: this runs a step early as a prefetch, and the people step owns
      // the visible error surface. Toasting here would fire over another screen.
      setSuggestions([]);
      setFailed(true);
    }
  }, [user?.id]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const retry = useCallback(() => {
    setSuggestions(null);
    setFailed(false);
    load();
  }, [load]);

  const remove = useCallback((id) => {
    setSuggestions((list) => (Array.isArray(list) ? list.filter((p) => p.id !== id) : list));
    setFollowed((f) => { const next = { ...f }; delete next[id]; return next; });
  }, []);

  const toggleFollow = useCallback(
    async (person) => {
      const id = person?.id;
      if (id == null || busyIds[id]) return;
      setBusyIds((b) => ({ ...b, [id]: true }));
      try {
        // The endpoint toggles, so its answer is the only truth about which way
        // it went — never assume the optimistic direction.
        const res = await api.post(`/users/${id}/connect`);
        const connected = res?.data?.connected === true;
        setFollowed((f) => ({ ...f, [id]: connected }));
        if (connected) { haptics.pop(); track('onboarding_v2_follow', { target: id }); }
      } catch (e) {
        toast?.show(e?.safeMessage || 'Could not update that follow.', 'error');
      } finally {
        setBusyIds((b) => { const next = { ...b }; delete next[id]; return next; });
      }
    },
    [busyIds, toast]
  );

  const openMenu = useCallback(
    async (person) => {
      if (person?.id == null) return;
      const name = person.name || 'this member';

      // A sheet, not an alert: Android drops everything past the third button.
      const action = await showReportSheet({
        title: name,
        reasons: [
          { key: 'report', label: `Report ${name}` },
          { key: 'block', label: `Block ${name}` },
        ],
      });
      if (!action) return;

      // Let the sheet finish closing before it is asked to present again.
      await new Promise((r) => setTimeout(r, 240));

      if (action === 'report') {
        const reason = await showReportSheet({ title: `Report ${name}`, reasons: REPORT_REASONS });
        if (!reason) return;
        try {
          await api.post('/reports', { target_type: 'user', target_id: person.id, reason });
          toast?.show('Reported. Our team will review it.', 'success');
          track('onboarding_v2_report', { reason });
        } catch (e) {
          toast?.show(e?.safeMessage || 'Could not send that report.', 'error');
        }
        return;
      }

      // Exactly two buttons, so this one is safe on Android.
      Alert.alert(
        `Block ${name}?`,
        `You won't see ${name}'s stories, and they won't see yours.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.post(`/blocks/${person.id}`);
                remove(person.id);
                toast?.show(`${name} is blocked.`, 'success');
                track('onboarding_v2_block', {});
              } catch (e) {
                toast?.show(e?.safeMessage || 'Could not block that member.', 'error');
              }
            },
          },
        ]
      );
    },
    [toast, remove]
  );

  const followCount = useMemo(() => Object.values(followed).filter(Boolean).length, [followed]);

  return {
    suggestions, failed, refreshing, followed, busyIds, followCount,
    load, refresh, retry, toggleFollow, openMenu, setFollowed,
  };
}
