// src/screens/events/EventDetailScreen.js
// One event, with an RSVP toggle, share, host controls, and the report/block
// menu required for any UGC surface. Accepts either { event } (full row) or
// { id } (from a deep link) and hydrates from the list endpoint if needed.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Share, ActivityIndicator, Pressable } from 'react-native';
import api, { ORIGIN } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Icon, Avatar, Bounce, Button, EmptyState, useToast } from '../../components/ui';
import DateChip from '../../components/events/DateChip';
import { fullDate, formatTime, longDate, hasTime, parseEventDate, whenLabel } from '../../components/events/dateUtils';
import { track } from '../../lib/track';

const REPORT_REASONS = [
  { key: 'unsafe_drinking', label: 'Encourages unsafe drinking' },
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'inappropriate', label: 'Sexual or violent content' },
  { key: 'other', label: 'Something else' },
];

function DetailRow({ icon, label, value, onPress }) {
  const { t } = useTheme();
  const inner = (
    <View style={[styles.row, { borderBottomColor: t.divider }]}>
      <View style={[styles.iconWrap, { backgroundColor: t.surfaceAlt }]}>
        <Icon name={icon} size={18} color={t.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.caption, { color: t.textMuted }]}>{label}</Text>
        <Text style={[type.body, { color: t.text, marginTop: 2 }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
      {onPress && <Icon name="chevron-forward" size={16} color={t.textMuted} />}
    </View>
  );
  return onPress ? <Bounce onPress={onPress} haptic="light" scaleTo={0.99}>{inner}</Bounce> : inner;
}

export default function EventDetailScreen({ navigation, route }) {
  const { t, elevation } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const incoming = route.params?.event || null;
  const eventId = route.params?.id || incoming?.id;

  const [event, setEvent] = useState(incoming);
  const [loading, setLoading] = useState(!incoming);
  const [notFound, setNotFound] = useState(false);
  const [rsvping, setRsvping] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) { setLoading(false); return; }
    try {
      // There is no dedicated GET /events/:id, so hydrate off the list.
      const res = await api.get('/events');
      const rows = Array.isArray(res.data) ? res.data : [];
      const found = rows.find((e) => String(e.id) === String(eventId));
      if (found) { setEvent(found); setNotFound(false); }
      else if (!incoming) setNotFound(true);
    } catch (e) {
      // If we already have an incoming row, stay on that; otherwise surface.
      if (!incoming) toast?.show(e.safeMessage || 'Could not load event.', 'error');
    } finally {
      setLoading(false);
    }
  }, [eventId, incoming, toast]);

  useEffect(() => { load(); }, [load]);

  const isHost = !!event && !!user && event.user_id === user.id;
  const rsvped = !!event?.user_rsvped;
  const goingCount = Number(event?.rsvp_count) || 0;

  const toggleRsvp = useCallback(async () => {
    if (!event || rsvping) return;
    setRsvping(true);
    const before = { user_rsvped: event.user_rsvped, rsvp_count: event.rsvp_count };
    // Optimistic
    setEvent((e) => ({
      ...e,
      user_rsvped: rsvped ? 0 : 1,
      rsvp_count: Math.max(0, (Number(e?.rsvp_count) || 0) + (rsvped ? -1 : 1)),
    }));
    try {
      const res = await api.post(`/events/${event.id}/rsvp`);
      const next = !!res.data?.rsvped;
      track(next ? 'event_rsvp_in' : 'event_rsvp_out', { id: event.id });
      // Reconcile with server truth in case optimistic drifted.
      setEvent((e) => ({ ...e, user_rsvped: next ? 1 : 0 }));
      toast?.show(next ? 'Count you in.' : 'RSVP removed.', next ? 'success' : 'info');
    } catch (e) {
      // Roll back and surface a safe message.
      setEvent((prev) => ({ ...prev, ...before }));
      toast?.show(e.safeMessage || 'Could not update your RSVP.', 'error');
    } finally {
      setRsvping(false);
    }
  }, [event, rsvped, rsvping, toast]);

  const share = useCallback(async () => {
    if (!event) return;
    try {
      const when = whenLabel(event.date);
      const place = event.location ? ` at ${event.location}` : '';
      await Share.share({
        message: `${event.name || 'Someone'} is hosting "${event.title}" — ${when}${place}. Come along on DrinkedInn.`,
        url: `${ORIGIN}/events/${event.id}`,
      });
      track('event_share', { id: event.id });
    } catch { /* user dismissed the sheet */ }
  }, [event]);

  const confirmDelete = useCallback(() => {
    if (!event) return;
    Alert.alert(
      'Cancel this event?',
      `"${event.title}" will be removed for everyone who RSVPed. This can't be undone.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel event',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.delete(`/events/${event.id}`);
              track('event_delete', { id: event.id });
              toast?.show('Event cancelled.', 'success');
              navigation.goBack();
            } catch (e) {
              toast?.show(e.safeMessage || 'Could not cancel that.', 'error');
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [event, navigation, toast]);

  // Report the host — /reports only accepts post/user/comment target types, so
  // we report the host as a user. Comment carries the event context.
  const submitReport = useCallback(async (reason) => {
    if (!event) return;
    try {
      await api.post('/reports', {
        target_type: 'user',
        target_id: event.user_id,
        reason: `${reason} — event #${event.id} "${(event.title || '').slice(0, 80)}"`,
      });
      toast?.show('Reported. Our team will review it.', 'success');
    } catch (e) {
      toast?.show(e.safeMessage || 'Could not send that report.', 'error');
    }
  }, [event, toast]);

  const chooseReason = useCallback(async () => {
    // Reasons pass label to the server here (rather than key) — kept to match
    // how the module originally submitted; showReportSheet still handles any
    // number of options on both platforms, which is the fix.
    const key = await showReportSheet({ title: "Report this event — what's wrong with it?", reasons: REPORT_REASONS });
    if (key) submitReport(REPORT_REASONS.find((r) => r.key === key)?.label || key);
  }, [submitReport]);

  const blockHost = useCallback(() => {
    if (!event) return;
    const name = event.name || 'this host';
    Alert.alert(
      `Block ${name}?`,
      `You won't see ${name}'s events or pours, and they won't see yours. Any connection between you is removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/blocks/${event.user_id}`);
              toast?.show(`${name} is blocked.`, 'success');
              // A blocked user's content should disappear — go back to the list.
              navigation.goBack();
            } catch (e) {
              toast?.show(e.safeMessage || 'Could not block that member.', 'error');
            }
          },
        },
      ]
    );
  }, [event, navigation, toast]);

  const openMenu = useCallback(() => {
    if (!event) return;
    if (isHost) {
      Alert.alert('Your event', null, [
        { text: 'Share', onPress: share },
        { text: 'Cancel event', style: 'destructive', onPress: confirmDelete },
        { text: 'Close', style: 'cancel' },
      ]);
    } else {
      Alert.alert(event.name || 'Options', null, [
        { text: 'Share', onPress: share },
        { text: 'Report this event', onPress: chooseReason },
        { text: `Block ${event.name || 'this host'}`, style: 'destructive', onPress: blockHost },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [event, isHost, share, confirmDelete, chooseReason, blockHost]);

  const openHost = useCallback(() => {
    if (!event) return;
    if (isHost) navigation.navigate('Account');
    else navigation.navigate('User', { userId: event.user_id });
  }, [event, isHost, navigation]);

  const parsed = useMemo(() => parseEventDate(event?.date), [event?.date]);

  if (loading) {
    return (
      <Screen edges={['top']}>
        <Header title="Event" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.accent} size="large" />
        </View>
      </Screen>
    );
  }

  if (!event || notFound) {
    return (
      <Screen edges={['top']}>
        <Header title="Event" onBack={() => navigation.goBack()} />
        <EmptyState
          icon="calendar-outline"
          title="This one's not available"
          body="It may have been cancelled or is no longer visible to you."
          actionLabel="Back to events"
          onAction={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Header
        title="Event"
        onBack={() => navigation.goBack()}
        right={
          <Pressable onPress={openMenu} hitSlop={10} style={{ padding: 4 }} accessibilityLabel="Event options">
            <Icon name="ellipsis-horizontal" size={20} color={t.textMuted} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 1)]}>
          <View style={styles.heroTop}>
            <DateChip date={event.date} size="lg" />
            <View style={{ flex: 1 }}>
              {!!event.drink && <Text style={{ fontSize: 22 }}>{event.drink}</Text>}
              <Text style={[type.h1, { color: t.text, marginTop: 4 }]} numberOfLines={3}>
                {event.title}
              </Text>
            </View>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.goingRow}>
              <Icon name="people" size={15} color={t.accent} />
              <Text style={[type.label, { color: t.text }]}>
                {goingCount === 0 ? 'Be the first' : `${goingCount} going`}
              </Text>
            </View>
            <Button
              label={rsvped ? "You're in" : "I'm in"}
              icon={rsvped ? 'checkmark' : 'add'}
              variant={rsvped ? 'subtle' : 'primary'}
              size="sm"
              onPress={toggleRsvp}
              loading={rsvping}
            />
          </View>
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <DetailRow
            icon="calendar-outline"
            label="When"
            value={hasTime(event.date) && parsed ? `${fullDate(event.date)}\n${formatTime(parsed)}` : fullDate(event.date) || longDate(event.date) || 'Date TBA'}
          />
          {!!event.location && (
            <DetailRow icon="location-outline" label="Where" value={event.location} />
          )}
          <DetailRow
            icon="person-outline"
            label="Hosted by"
            value={event.name || 'A DrinkedInn member'}
            onPress={openHost}
          />
        </View>

        {/* Host row */}
        <Bounce
          onPress={openHost}
          haptic="light"
          scaleTo={0.995}
          accessibilityLabel={`View ${event.name || 'host'} profile`}
        >
          <View style={[styles.hostCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Avatar uri={event.avatar} name={event.name} size={44} ring={isHost} />
            <View style={{ flex: 1 }}>
              <Text style={[type.h3, { color: t.text }]} numberOfLines={1}>
                {event.name || 'A member'}
              </Text>
              <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>
                {isHost ? 'You are the host' : 'Tap to see their profile'}
              </Text>
            </View>
            <Icon name="chevron-forward" size={17} color={t.textMuted} />
          </View>
        </Bounce>

        {/* Going preview — server doesn't return the attendee list, so we show
            the count with a friendly caption and the host's avatar as the anchor. */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.avatarStack}>
              <Avatar uri={event.avatar} name={event.name} size={30} />
              {goingCount > 1 && (
                <View style={[styles.stackChip, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
                  <Text style={[type.caption, { color: t.textSecondary, fontWeight: '700' }]}>
                    +{Math.max(0, goingCount - 1)}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.label, { color: t.text }]}>
                {goingCount === 0 ? 'No RSVPs yet' : goingCount === 1 ? '1 person going' : `${goingCount} people going`}
              </Text>
              <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>
                {rsvped ? "You're on the list." : 'Say you\'re in so the host can plan.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Host controls */}
        {isHost && (
          <View style={styles.hostActions}>
            <View style={{ flex: 1 }}>
              <Button
                label="Share"
                icon="share-outline"
                variant="secondary"
                size="md"
                onPress={share}
                full
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Button
                label={deleting ? 'Cancelling…' : 'Cancel event'}
                icon="trash-outline"
                variant="danger"
                size="md"
                onPress={confirmDelete}
                loading={deleting}
                full
              />
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 18,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 12,
  },
  goingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  avatarStack: { width: 46, flexDirection: 'row', alignItems: 'center' },
  stackChip: {
    marginLeft: -12,
    paddingHorizontal: 7,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  hostActions: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 6,
  },
});
