// src/screens/NotificationsScreen.js — Activity.
// Grouped by recency, typed icons, and unread state that clears on view.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, SectionList, StyleSheet, RefreshControl, Pressable } from 'react-native';
import api from '../api';
import { useTheme } from '../theme/ThemeContext';
import { radius, type } from '../theme/tokens';
import { Screen, Icon, Avatar, Bounce, EmptyState, FadeIn, useToast } from '../components/ui';
import { Shimmer } from '../components/ui/Skeleton';

const KIND = {
  cheer: { verb: 'cheered your pour', icon: 'beer', tint: 'accent' },
  repour: { verb: 'repoured your pour', icon: 'repeat', tint: 'success' },
  comment: { verb: 'commented on your pour', icon: 'chatbubble', tint: 'blue' },
  reply: { verb: 'replied to you', icon: 'chatbubble-ellipses', tint: 'blue' },
  connect: { verb: 'connected with you', icon: 'person-add', tint: 'blue' },
  follow: { verb: 'connected with you', icon: 'person-add', tint: 'blue' },
  mention: { verb: 'mentioned you', icon: 'at', tint: 'blue' },
  potd: { verb: 'featured your pour', icon: 'trophy', tint: 'accent' },
  challenge: { verb: 'posted a challenge update', icon: 'flag', tint: 'accent' },
};

function parseTs(ts) {
  if (!ts) return null;
  const raw = String(ts);
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? null : d;
}

function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

export default function NotificationsScreen({ navigation }) {
  const { t } = useTheme();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async ({ markRead = true } = {}) => {
    try {
      const res = await api.get('/notifications');
      const list = Array.isArray(res.data) ? res.data : [];
      setItems(list);
      if (markRead && list.some((n) => !n.read)) {
        api.post('/notifications/read-all').catch(() => {});
      }
    } catch (e) {
      toast?.show(e.safeMessage || 'Could not load activity.', 'error');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try { await load(); } finally { setLoading(false); }
    })();
    const unsub = navigation.addListener('focus', () => load());
    return unsub;
  }, [navigation, load]);

  const sections = useMemo(() => {
    const now = Date.now();
    const buckets = { today: [], week: [], earlier: [] };
    for (const n of items) {
      const d = parseTs(n.created_at);
      const age = d ? now - d.getTime() : Infinity;
      if (age < 86400000) buckets.today.push({ ...n, _d: d });
      else if (age < 604800000) buckets.week.push({ ...n, _d: d });
      else buckets.earlier.push({ ...n, _d: d });
    }
    return [
      { title: 'Today', data: buckets.today },
      { title: 'This week', data: buckets.week },
      { title: 'Earlier', data: buckets.earlier },
    ].filter((s) => s.data.length > 0);
  }, [items]);

  const unread = items.filter((n) => !n.read).length;

  const markAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: 1 })));
    try { await api.post('/notifications/read-all'); } catch {}
  };

  return (
    <Screen>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[type.h1, { color: t.text }]}>Activity</Text>
          {unread > 0 && (
            <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]}>
              {unread} new
            </Text>
          )}
        </View>
        {unread > 0 && (
          <Pressable onPress={markAll} hitSlop={10} accessibilityLabel="Mark all as read">
            <Text style={[type.label, { color: t.accent }]}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, gap: 20, paddingTop: 10 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Shimmer style={{ width: 44, height: 44, borderRadius: 22 }} />
              <View style={{ flex: 1 }}>
                <Shimmer style={{ width: '70%', height: 11, borderRadius: 6 }} />
                <Shimmer style={{ width: '30%', height: 9, borderRadius: 5, marginTop: 7 }} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
              tintColor={t.accent}
              colors={[t.accent]}
            />
          }
          renderSectionHeader={({ section }) => (
            <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginLeft: 16, marginTop: 18, marginBottom: 8 }]}>
              {section.title}
            </Text>
          )}
          renderItem={({ item, index }) => {
            const kind = KIND[item.type] || { verb: 'sent you an update', icon: 'notifications', tint: 'blue' };
            const tintColor = kind.tint === 'accent' ? t.accent : kind.tint === 'success' ? t.success : t.blue;
            const tintBg = kind.tint === 'accent' ? t.accentSoft : kind.tint === 'success' ? t.successSoft : t.blueSoft;
            const extra = item.count > 1 ? ` and ${item.count - 1} other${item.count > 2 ? 's' : ''}` : '';

            return (
              <FadeIn index={index}>
                <Bounce
                  haptic="light"
                  scaleTo={0.99}
                  onPress={() =>
                    item.post_id
                      ? navigation.navigate('PostDetail', { post: { id: item.post_id } })
                      : item.actor_id && navigation.navigate('User', { userId: item.actor_id })
                  }
                  style={[
                    styles.row,
                    { backgroundColor: item.read ? 'transparent' : t.accentSoft },
                  ]}
                >
                  <View>
                    <Avatar uri={item.actor_avatar} name={item.actor_name} size={44} />
                    <View style={[styles.kind, { backgroundColor: tintBg, borderColor: t.bg }]}>
                      <Icon name={kind.icon} size={11} color={tintColor} />
                    </View>
                  </View>

                  <View style={{ flex: 1, marginLeft: 13 }}>
                    <Text style={[type.body, { color: t.text, lineHeight: 20 }]}>
                      <Text style={{ fontWeight: '700' }}>{item.actor_name || 'Someone'}</Text>
                      {!!extra && <Text style={{ color: t.textSecondary }}>{extra}</Text>}
                      <Text style={{ color: t.textSecondary }}> {kind.verb}</Text>
                    </Text>
                    {!!item.post_preview && (
                      <Text style={[type.caption, { color: t.textMuted, marginTop: 3 }]} numberOfLines={1}>
                        “{item.post_preview}”
                      </Text>
                    )}
                    <Text style={[type.caption, { color: t.textMuted, marginTop: 3 }]}>{timeAgo(item._d)}</Text>
                  </View>

                  {!item.read && <View style={[styles.dot, { backgroundColor: t.accent }]} />}
                </Bounce>
              </FadeIn>
            );
          }}
          contentContainerStyle={{ paddingBottom: 130 }}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="Nothing yet"
              body="Cheers, comments and new connections will land here."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 8, borderRadius: radius.md },
  kind: {
    position: 'absolute', right: -3, bottom: -3, width: 21, height: 21, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 10 },
});
