// src/screens/messages/ThreadScreen.js
// A 1:1 message thread. Route params: { userId, name, avatar } — name/avatar
// are optional; if only userId is present, the header falls back to the name
// carried in the first hydrated message.
//
// Notes on the block contract (server/routes/messages.js): once either side
// blocks the other, GET /messages/:userId returns 404 rather than 403 so the
// existence of the block is not revealed. We surface that as "This conversation
// isn't available." — the same wording whether they blocked us, we blocked
// them, or the account was removed — and disable the composer.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet, Platform,
  KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import {
  Screen, Icon, Avatar, Bounce, EmptyState, useToast,
} from '../../components/ui';
import { Shimmer } from '../../components/ui/Skeleton';
import MessageBubble from '../../components/messages/MessageBubble';
import DayDivider from '../../components/messages/DayDivider';
import useUnreadMessages from '../../components/messages/useUnreadMessages';
import useThreadActions from './useThreadActions';
import { dayLabel, isNewDay, isBigGap } from './timeAgo';
import track from '../../lib/track';

const POLL_MS = 15000;
const MAX_LEN = 1000;

// Build [{ type:'day', label } | { type:'msg', message, mine, showTime, showTail }]
// from an ASC-ordered array of raw messages.
function decorate(messages, meId) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const out = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const mine = m.sender_id === meId;

    if (!prev || isNewDay(prev.created_at, m.created_at)) {
      out.push({ type: 'day', key: `d-${m.id ?? i}`, label: dayLabel(m.created_at) });
    }

    // Timestamp printed on the LAST message of a burst, or when there's
    // a >5min gap after this one.
    const gapAfter = !next || isBigGap(m.created_at, next.created_at, 5) || next.sender_id !== m.sender_id;
    const sameAuthorNext = next && next.sender_id === m.sender_id && !isNewDay(m.created_at, next.created_at);
    // Show a "tail" (tight corner on the author's side) on the LAST bubble of
    // a run so a single utterance still gets its distinctive shape.
    const showTail = !sameAuthorNext;

    out.push({
      type: 'msg',
      key: String(m.id ?? `m-${i}`),
      message: m,
      mine,
      showTime: gapAfter,
      showTail,
    });
  }
  return out;
}

function BubbleSkeleton() {
  const { t } = useTheme();
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
      <Shimmer style={{ width: '62%', height: 32, borderRadius: radius.lg, backgroundColor: t.skeleton }} />
      <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
        <Shimmer style={{ width: '48%', height: 32, borderRadius: radius.lg }} />
      </View>
      <View style={{ marginTop: 10 }}>
        <Shimmer style={{ width: '76%', height: 44, borderRadius: radius.lg }} />
      </View>
    </View>
  );
}

export default function ThreadScreen({ navigation, route }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const { markAllRead, refresh: refreshBadge } = useUnreadMessages();

  const userId = route.params?.userId;
  const seedName = route.params?.name || '';
  const seedAvatar = route.params?.avatar || null;

  const [displayName, setDisplayName] = useState(seedName);
  const [displayAvatar, setDisplayAvatar] = useState(seedAvatar);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef(null);
  const pollRef = useRef(null);
  const inFlightLoad = useRef(false);

  const openProfile = useCallback(() => {
    if (!userId) return;
    if (user && userId === user.id) navigation.navigate('Account');
    else navigation.navigate('User', { userId });
  }, [navigation, userId, user]);

  const { openMenu } = useThreadActions({
    userId,
    name: displayName || seedName,
    onBlocked: () => navigation.goBack(),
  });

  // -- data ------------------------------------------------------------------

  const load = useCallback(
    async ({ background = false } = {}) => {
      if (!userId || inFlightLoad.current) return;
      inFlightLoad.current = true;
      try {
        const res = await api.get(`/messages/${userId}`);
        const list = Array.isArray(res.data) ? res.data : [];
        // A background poll can land while a send is in flight; keep any
        // still-optimistic bubbles so they don't blink out and back.
        setMessages((prev) => {
          const pending = prev.filter(
            (m) => m && typeof m.id === 'string' && m.id.startsWith('tmp-')
          );
          // Dedupe by id — a background poll landing during an in-flight send
          // used to leave the saved row TWICE (once from the poll's list, once
          // from the mapped optimistic bubble). Keying by id makes the merge
          // idempotent regardless of ordering.
          const merged = pending.length ? [...list, ...pending] : list;
          const seen = new Set();
          const deduped = [];
          for (const m of merged) {
            if (!m || m.id == null) continue;
            const key = String(m.id);
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(m);
          }
          return deduped;
        });
        setUnavailable(false);

        // Refresh header identity from the first message where the other person
        // is the sender — the server includes name/avatar there.
        const theirs = list.find((m) => m.sender_id === userId);
        if (theirs) {
          if (!displayName && theirs.name) setDisplayName(theirs.name);
          if (!displayAvatar && theirs.avatar) setDisplayAvatar(theirs.avatar);
        }

        // Opening the thread server-side marks their messages read; sync the
        // badge so the header icon updates without waiting for the next poll.
        markAllRead();
      } catch (e) {
        if (e.response?.status === 404) {
          setUnavailable(true);
        } else if (!background) {
          toast?.show(e.safeMessage || 'Could not load this conversation.', 'error');
        }
      } finally {
        inFlightLoad.current = false;
        if (!background) setLoading(false);
      }
    },
    [userId, displayName, displayAvatar, markAllRead, toast]
  );

  // Initial fetch + focus refetch + poll while focused.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => { if (!cancelled) await load({ background: false }); })();
      pollRef.current = setInterval(() => {
        if (!unavailable && !cancelled) load({ background: true });
      }, POLL_MS);
      return () => {
        cancelled = true;
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        refreshBadge();
      };
      // We intentionally re-subscribe when the user changes; other deps close
      // over the memoised `load`.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, unavailable])
  );

  // -- send ------------------------------------------------------------------

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending || !userId || unavailable) return;
    if (body.length > MAX_LEN) {
      toast?.show(`That's ${body.length - MAX_LEN} characters too long.`, 'error');
      return;
    }

    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender_id: user?.id,
      receiver_id: userId,
      content: body,
      name: user?.name,
      avatar: user?.avatar,
      created_at: new Date().toISOString(),
      read: 0,
      _pending: true,
    };

    setSending(true);
    setText('');
    setMessages((m) => [...m, optimistic]);

    try {
      const res = await api.post(`/messages/${userId}`, { content: body });
      const saved = res?.data;
      setMessages((m) =>
        m.map((x) => (x.id === optimistic.id ? { ...(saved || optimistic), _pending: false } : x))
      );
      track('message_send', { user_id: userId, length: body.length });
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setText((t2) => (t2 ? t2 : body));
      if (e.response?.status === 404) {
        setUnavailable(true);
        toast?.show("This conversation isn't available.", 'error');
      } else {
        toast?.show(e.safeMessage || 'Message failed to send.', 'error');
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, userId, unavailable, user, toast]);

  // -- render ----------------------------------------------------------------

  const rows = decorate(messages, user?.id);
  const canSend = !!text.trim() && !sending && !unavailable;

  return (
    <Screen edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.divider, backgroundColor: t.bg }]}>
        <Bounce
          onPress={() => navigation.goBack()}
          haptic={null}
          scaleTo={0.9}
          hitSlop={12}
          style={styles.back}
          accessibilityLabel="Back to messages"
        >
          <Icon name="chevron-back" size={26} color={t.text} />
        </Bounce>
        <Bounce
          onPress={openProfile}
          haptic="light"
          scaleTo={0.98}
          style={styles.person}
          accessibilityLabel={`View ${displayName || 'member'}'s profile`}
        >
          <Avatar uri={displayAvatar} name={displayName || '?'} size={36} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={[type.h3, { color: t.text }]} numberOfLines={1}>
              {displayName || 'Member'}
            </Text>
            <Text style={[type.caption, { color: t.textMuted }]} numberOfLines={1}>
              View profile
            </Text>
          </View>
        </Bounce>
        <Bounce
          onPress={openMenu}
          haptic="light"
          hitSlop={10}
          style={[styles.moreBtn, { backgroundColor: t.surfaceAlt }]}
          accessibilityLabel="More options"
        >
          <Icon name="ellipsis-horizontal" size={18} color={t.text} />
        </Bounce>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {loading && messages.length === 0 ? (
          <BubbleSkeleton />
        ) : unavailable ? (
          <EmptyState
            icon="lock-closed-outline"
            title="This conversation isn't available"
            body="It may have been closed, or the other member isn't reachable right now."
          />
        ) : (
          <FlatList
            ref={listRef}
            data={[...rows].reverse()}
            keyExtractor={(item) => item.key}
            inverted
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 12, flexGrow: 1 }}
            renderItem={({ item }) => {
              if (item.type === 'day') return <DayDivider label={item.label} />;
              return (
                <MessageBubble
                  message={item.message}
                  mine={item.mine}
                  showTime={item.showTime}
                  showTail={item.showTail}
                />
              );
            }}
            ListEmptyComponent={
              !loading && (
                <View style={{ transform: [{ scaleY: -1 }] }}>
                  <EmptyState
                    icon="chatbubbles-outline"
                    title={`Say hello${displayName ? `, ${displayName.split(' ')[0]}` : ''}`}
                    body="The first note is the hardest — a quick nice-to-meet-you goes a long way."
                  />
                </View>
              )
            }
          />
        )}

        {/* Composer */}
        <View style={[styles.composer, { borderTopColor: t.divider, backgroundColor: t.bg }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={unavailable ? 'Messaging is off for this conversation' : 'Message…'}
            placeholderTextColor={t.textMuted}
            editable={!unavailable}
            multiline
            maxLength={MAX_LEN + 32}
            style={[
              styles.input,
              {
                backgroundColor: t.surface,
                borderColor: t.border,
                color: t.text,
                opacity: unavailable ? 0.55 : 1,
              },
            ]}
          />
          <Bounce
            onPress={send}
            haptic="medium"
            disabled={!canSend}
            style={[
              styles.send,
              { backgroundColor: canSend ? t.accent : t.surfaceAlt },
            ]}
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator size="small" color={t.textOnAccent} />
            ) : (
              <Icon
                name="arrow-up"
                size={19}
                color={canSend ? t.textOnAccent : t.textMuted}
              />
            )}
          </Bounce>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { padding: 4, marginRight: 2 },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingRight: 8 },
  moreBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    maxHeight: 120,
  },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
