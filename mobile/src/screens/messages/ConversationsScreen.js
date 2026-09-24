// src/screens/messages/ConversationsScreen.js
// The list of conversations the signed-in member has going. The server
// already excludes blocked people (server/routes/messages.js) — we don't need
// to filter here — and orders by most-recent message. Rows show the other
// person, their most recent line, a relative timestamp, and an unread badge.

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, RefreshControl, StyleSheet, Animated,
} from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import {
  Screen, Header, Avatar, Icon, Bounce, EmptyState, FadeIn, useToast,
} from '../../components/ui';
import { Shimmer } from '../../components/ui/Skeleton';
import UnreadBadge from '../../components/messages/UnreadBadge';
import useUnreadMessages from '../../components/messages/useUnreadMessages';
import { timeAgoShort } from './timeAgo';
import track from '../../lib/track';
import { navigateByName } from '../../lib/nav';

function RowSkeleton() {
  const { t } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: t.divider }]}>
      <Shimmer style={{ width: 48, height: 48, borderRadius: 24 }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Shimmer style={{ width: '48%', height: 12, borderRadius: 6 }} />
        <Shimmer style={{ width: '82%', height: 11, borderRadius: 6, marginTop: 10 }} />
      </View>
      <Shimmer style={{ width: 32, height: 10, borderRadius: 5 }} />
    </View>
  );
}

function ConversationRow({ item, onOpen }) {
  const { t } = useTheme();
  const unread = Number(item.unread) || 0;
  const preview = (item.last_message || '').replace(/\s+/g, ' ').trim();

  return (
    <Bounce
      haptic={null}
      scaleTo={0.995}
      onPress={() => onOpen(item)}
      accessibilityLabel={
        unread > 0
          ? `Conversation with ${item.name || 'member'}, ${unread} unread`
          : `Conversation with ${item.name || 'member'}`
      }
    >
      <View style={[styles.row, { borderBottomColor: t.divider }]}>
        <Avatar uri={item.avatar} name={item.name || '?'} size={48} />
        <View style={styles.center}>
          <View style={styles.topRow}>
            <Text
              style={[
                unread > 0 ? type.bodyStrong : type.body,
                { color: t.text, flexShrink: 1 },
              ]}
              numberOfLines={1}
            >
              {item.name || 'Member'}
            </Text>
            {!!item.last_at && (
              <Text style={[type.caption, { color: unread > 0 ? t.accentText : t.textMuted }]}>
                {timeAgoShort(item.last_at)}
              </Text>
            )}
          </View>
          <View style={styles.bottomRow}>
            <Text
              style={[
                type.body,
                {
                  color: unread > 0 ? t.text : t.textSecondary,
                  fontWeight: unread > 0 ? '500' : '400',
                  flex: 1,
                },
              ]}
              numberOfLines={1}
            >
              {preview || (item.title ? item.title : 'Say hello.')}
            </Text>
            {unread > 0 && <UnreadBadge count={unread} size="sm" />}
          </View>
        </View>
      </View>
    </Bounce>
  );
}

export default function ConversationsScreen({ navigation }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const { refresh: refreshBadge } = useUnreadMessages();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errored, setErrored] = useState(false);

  const listRef = useRef(null);
  useScrollToTop(listRef);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/messages/conversations');
      const list = Array.isArray(res.data) ? res.data : [];
      setItems(list);
      setErrored(false);
    } catch (e) {
      setErrored(true);
      toast?.show(e.safeMessage || 'Could not load conversations.', 'error');
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      try { await load(); } finally { setLoading(false); }
    })();
  }, [load]);

  // Re-fetch every time the screen returns to focus — a thread we just left
  // may have new messages or a cleared unread count.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      track('conversations_view');
      refreshBadge();
      load();
    });
    return unsub;
  }, [navigation, load, refreshBadge]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); refreshBadge(); }
    finally { setRefreshing(false); }
  }, [load, refreshBadge]);

  const openThread = useCallback(
    (convo) => {
      const otherId = convo.other_id ?? convo.id;
      if (!otherId) return;
      track('thread_open_from_list', { user_id: otherId });
      navigation.navigate('Thread', {
        userId: otherId,
        name: convo.name,
        avatar: convo.avatar,
      });
    },
    [navigation]
  );

  return (
    <Screen>
      <Header
        title="Messages"
        onBack={() => navigation.goBack()}
        large
        border={false}
        right={
          <Bounce
            onPress={() => navigateByName(navigation, 'Explore')}
            haptic="light"
            style={[styles.headerBtn, { backgroundColor: t.surfaceAlt }]}
            accessibilityLabel="Find someone to message"
          >
            <Icon name="person-add-outline" size={18} color={t.text} />
          </Bounce>
        }
      />

      {loading ? (
        <View style={{ paddingTop: 6 }}>
          {[0, 1, 2, 3, 4].map((i) => <RowSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item, i) => String(item.other_id ?? item.id ?? i)}
          renderItem={({ item, index }) => (
            <FadeIn index={index}>
              <ConversationRow item={item} onOpen={openThread} />
            </FadeIn>
          )}
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
              progressBackgroundColor={t.surface}
            />
          }
          ListEmptyComponent={
            errored ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="We couldn't pour that in"
                body="Pull down to try again."
              />
            ) : (
              <EmptyState
                icon="chatbubbles-outline"
                title="Your table's set for two"
                body="Open someone's profile and send the first note. Good conversations start somewhere."
                actionLabel="Find people"
                onAction={() => navigateByName(navigation, 'Explore')}
              />
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  center: { flex: 1, marginLeft: 12, marginRight: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
});
