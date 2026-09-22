// src/screens/PostDetailScreen.js
// Full pour with its comment thread. Accepts either a complete post object or
// just { id } (e.g. arriving from a notification), and hydrates if needed.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput, Platform,
  KeyboardAvoidingView, ActivityIndicator, Pressable,
} from 'react-native';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { radius, type } from '../theme/tokens';
import { Screen, Header, Icon, Avatar, Bounce, EmptyState, FadeIn, useToast } from '../components/ui';
import { PostSkeleton } from '../components/ui/Skeleton';
import PostCard from '../components/PostCard';

function timeAgo(ts) {
  if (!ts) return '';
  const raw = String(ts);
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (isNaN(s) || s < 0) return '';
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function Poll({ postId }) {
  const { t } = useTheme();
  const [poll, setPoll] = useState(null);
  const [voting, setVoting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/polls/${postId}`);
      setPoll(res.data);
    } catch { setPoll(null); }
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  if (!poll?.options?.length) return null;

  const total = poll.options.reduce((s, o) => s + (o.votes || 0), 0);
  const myVote = poll.userVote ?? poll.user_vote ?? null;

  const vote = async (optionId) => {
    if (voting || myVote) return;
    setVoting(true);
    try {
      await api.post(`/polls/${postId}/vote`, { optionId });
      await load();
    } catch { /* ignore */ } finally { setVoting(false); }
  };

  return (
    <View style={[styles.poll, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginBottom: 10 }]}>Poll</Text>
      {poll.options.map((o) => {
        const pct = total ? Math.round(((o.votes || 0) / total) * 100) : 0;
        const mine = myVote === o.id;
        return (
          <Pressable key={o.id} onPress={() => vote(o.id)} disabled={!!myVote || voting} style={styles.pollRow}>
            <View style={[styles.pollTrack, { backgroundColor: t.surfaceAlt, borderColor: mine ? t.accent : 'transparent' }]}>
              {!!myVote && (
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: t.accentSoft }} />
              )}
              <Text style={[type.body, { color: t.text, flex: 1 }]}>{o.text}</Text>
              {!!myVote && (
                <Text style={[type.label, { color: mine ? t.accentText : t.textMuted }]}>{pct}%</Text>
              )}
            </View>
          </Pressable>
        );
      })}
      <Text style={[type.caption, { color: t.textMuted, marginTop: 8 }]}>
        {total} vote{total === 1 ? '' : 's'}{myVote ? '' : ' · tap to vote'}
      </Text>
    </View>
  );
}

export default function PostDetailScreen({ navigation, route }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const incoming = route.params?.post || {};
  const postId = incoming.id;

  const [post, setPost] = useState(incoming.content !== undefined ? incoming : null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    const needsHydration = !post;
    const jobs = [api.get(`/posts/${postId}/comments`)];
    if (needsHydration) jobs.push(api.get(`/posts/${postId}`));
    const [cRes, pRes] = await Promise.allSettled(jobs);

    if (cRes.status === 'fulfilled') setComments(Array.isArray(cRes.value.data) ? cRes.value.data : []);
    if (pRes?.status === 'fulfilled') {
      setPost(pRes.value.data);
    } else if (needsHydration) {
      // Single-post endpoint unavailable — fall back to finding it in the feed
      // so deep links from notifications still resolve.
      try {
        const all = await api.get('/posts');
        const found = (all.data || []).find((p) => String(p.id) === String(postId));
        if (found) setPost(found);
      } catch {}
    }
    setLoading(false);
  }, [postId, post]);

  useEffect(() => { if (postId) load(); else setLoading(false); }, [postId]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');

    const optimistic = {
      id: `tmp-${Date.now()}`,
      content: body,
      name: user?.name,
      avatar: user?.avatar,
      user_id: user?.id,
      created_at: new Date().toISOString(),
      _pending: true,
    };
    setComments((c) => [...c, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const res = await api.post(`/posts/${postId}/comments`, { content: body });
      setComments((c) => c.map((x) => (x.id === optimistic.id ? res.data : x)));
      setPost((p) => (p ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p));
    } catch (e) {
      setComments((c) => c.filter((x) => x.id !== optimistic.id));
      setText(body);
      toast?.show(e.safeMessage || 'Comment failed to send.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <Header title="Pour" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {loading && !post ? (
          <PostSkeleton />
        ) : (
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View>
                {post && (
                  <PostCard
                    post={post}
                    onOpen={() => {}}
                    onProfile={(uid) =>
                      uid === user?.id ? navigation.navigate('Profile') : navigation.navigate('User', { userId: uid })
                    }
                  />
                )}
                {!!post?.has_poll && <Poll postId={postId} />}
                <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase', marginLeft: 16, marginTop: 12, marginBottom: 8 }]}>
                  {comments.length} comment{comments.length === 1 ? '' : 's'}
                </Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <FadeIn index={index}>
                <View style={[styles.comment, item._pending && { opacity: 0.55 }]}>
                  <Bounce
                    haptic={null}
                    scaleTo={0.97}
                    onPress={() =>
                      item.user_id === user?.id
                        ? navigation.navigate('Profile')
                        : item.user_id && navigation.navigate('User', { userId: item.user_id })
                    }
                  >
                    <Avatar uri={item.avatar} name={item.name} size={36} />
                  </Bounce>
                  <View style={[styles.bubble, { backgroundColor: t.surface, borderColor: t.border }]}>
                    <View style={styles.bubbleHead}>
                      <Text style={[type.label, { color: t.text }]}>{item.name}</Text>
                      <Text style={[type.caption, { color: t.textMuted }]}>{timeAgo(item.created_at)}</Text>
                    </View>
                    <Text style={[type.body, { color: t.textSecondary, lineHeight: 20, marginTop: 3 }]}>
                      {item.content}
                    </Text>
                  </View>
                </View>
              </FadeIn>
            )}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              !loading && (
                <EmptyState icon="chatbubble-outline" title="No comments yet" body="Be the first to say cheers." />
              )
            }
          />
        )}

        {/* Composer */}
        <View style={[styles.bar, { borderTopColor: t.divider, backgroundColor: t.bg }]}>
          <Avatar uri={user?.avatar} name={user?.name} size={32} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Add a comment…"
            placeholderTextColor={t.textMuted}
            multiline
            maxLength={500}
            style={[styles.input, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
          />
          <Bounce
            onPress={send}
            haptic="medium"
            disabled={!text.trim() || sending}
            style={[
              styles.send,
              { backgroundColor: text.trim() ? t.accent : t.surfaceAlt },
            ]}
            accessibilityLabel="Send comment"
          >
            {sending ? (
              <ActivityIndicator size="small" color={t.textOnAccent} />
            ) : (
              <Icon name="arrow-up" size={19} color={text.trim() ? t.textOnAccent : t.textMuted} />
            )}
          </Bounce>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingVertical: 6 },
  bubble: { flex: 1, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  poll: { marginHorizontal: 16, marginBottom: 6, borderRadius: radius.md, borderWidth: 1, padding: 14 },
  pollRow: { marginBottom: 8 },
  pollTrack: {
    flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, borderWidth: 1.5,
    paddingHorizontal: 13, paddingVertical: 11, overflow: 'hidden',
  },
  bar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 9,
    paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, maxHeight: 110 },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
