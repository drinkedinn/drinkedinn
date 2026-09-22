// src/screens/sommelier/SommelierScreen.js — Ask the Innkeeper.
//
// A chat with our in-house AI sommelier. The screen keeps the entire
// conversation in local state and re-sends the (trimmed) history with every
// request, so context survives across turns without any server-side session.
//
// Transport note. The server route (routes/sommelier.js) responds two ways:
//   • JSON `{ content, streaming: false }` when no ANTHROPIC_API_KEY is set —
//     that's the graceful fallback we render as a normal assistant message.
//   • text/event-stream of `data: {token}` chunks otherwise.
//
// React Native's fetch does not expose a body stream, so we cannot render a
// token-by-token typewriter effect without shipping a new dependency. We ask
// axios for the raw text, wait for the full response behind a typing indicator,
// then assemble the tokens client-side. If a new streaming library lands in
// package.json later, only the ask() helper below needs to change.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet, Platform,
  KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Header, Icon, Bounce, FadeIn, useToast } from '../../components/ui';
import { track } from '../../lib/track';
import MessageBubble from '../../components/sommelier/MessageBubble';
import TypingIndicator from '../../components/sommelier/TypingIndicator';
import PromptChips from '../../components/sommelier/PromptChips';

const MAX_CHARS = 800;

// A polite last-resort assistant reply when we truly cannot parse anything.
// We prefer this over silence so the thread doesn't feel broken.
const FALLBACK_REPLY =
  "I couldn't quite catch that one. Try me again in a moment — I'll be right here.";

/**
 * Ask the server. Returns { content } for a normal reply, or { error }
 * for a server-reported problem we should surface warmly (not as a toast).
 * Network / auth failures throw so the caller can use err.safeMessage.
 */
async function ask(message, history) {
  const trimmedHistory = history
    .filter((m) => !m._pending && !m._error && typeof m.content === 'string' && m.content.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));

  const res = await api.post(
    '/sommelier/chat',
    { message, history: trimmedHistory },
    {
      timeout: 60000,
      responseType: 'text',
      transformResponse: [(d) => d],
    }
  );

  const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');

  // SSE first — the streaming path when the API key is configured.
  let assembled = '';
  let sseSaw = false;
  let sseError = null;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    sseSaw = true;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const parsed = JSON.parse(payload);
      if (typeof parsed.token === 'string') assembled += parsed.token;
      if (typeof parsed.error === 'string') sseError = parsed.error;
    } catch { /* skip malformed chunks */ }
  }
  if (sseSaw) {
    if (assembled.trim()) return { content: assembled };
    if (sseError) return { error: sseError };
    return { content: FALLBACK_REPLY };
  }

  // JSON — the no-API-key fallback path, or any other structured reply.
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.content === 'string' && parsed.content.trim()) {
      return { content: parsed.content };
    }
    if (parsed && typeof parsed.error === 'string') return { error: parsed.error };
  } catch { /* not JSON */ }

  const trimmed = raw.trim();
  return { content: trimmed || FALLBACK_REPLY };
}

export default function SommelierScreen({ navigation }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef(null);

  useEffect(() => { track('sommelier_open'); }, []);

  const scrollToBottom = useCallback(() => {
    // A tiny defer lets FlatList measure the new row before we scroll.
    requestAnimationFrame(() => listRef.current?.scrollToEnd?.({ animated: true }));
  }, []);

  const send = useCallback(async (rawText, { fromChip = false } = {}) => {
    const body = (rawText ?? '').trim();
    if (!body || sending) return;
    if (body.length > MAX_CHARS) {
      toast?.show(`That's ${body.length - MAX_CHARS} characters over.`, 'error');
      return;
    }

    const historyForCall = messages;
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: body };
    const pendingId = `a-${Date.now()}`;
    const pending = { id: pendingId, role: 'assistant', content: '', _pending: true };

    setMessages((m) => [...m, userMsg, pending]);
    setDraft('');
    setSending(true);
    track('sommelier_ask', { chars: body.length, from_chip: fromChip, turn: historyForCall.length / 2 + 1 });
    scrollToBottom();

    try {
      const result = await ask(body, historyForCall);
      setMessages((m) =>
        m.map((x) =>
          x.id === pendingId
            ? {
                ...x,
                _pending: false,
                _error: !!result.error,
                content: result.content || result.error || FALLBACK_REPLY,
              }
            : x
        )
      );
    } catch (e) {
      // Real failure (network, 401, timeout). Drop the placeholder and toast.
      setMessages((m) => m.filter((x) => x.id !== pendingId));
      toast?.show(e.safeMessage || 'The Innkeeper stepped away. Try again in a moment.', 'error');
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }, [messages, sending, scrollToBottom, toast]);

  const onSubmitFromChip = useCallback((text) => send(text, { fromChip: true }), [send]);
  const onSubmit = useCallback(() => send(draft), [send, draft]);

  const canSend = !sending && draft.trim().length > 0 && draft.length <= MAX_CHARS;

  const renderItem = useCallback(
    ({ item, index }) => {
      if (item._pending) return <TypingIndicator />;
      return (
        <FadeIn index={Math.min(index, 3)}>
          <MessageBubble role={item.role} content={item.content} error={item._error} />
        </FadeIn>
      );
    },
    []
  );

  const empty = messages.length === 0;

  return (
    <Screen edges={['top']}>
      <Header
        title="Ask the Innkeeper"
        subtitle={user?.name ? `A pour tailored to you, ${user.name.split(' ')[0]}.` : 'A pour tailored to you.'}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={[
            { paddingTop: 6, paddingBottom: 16 },
            empty && { flexGrow: 1 },
          ]}
          onContentSizeChange={() => { if (!empty) listRef.current?.scrollToEnd?.({ animated: true }); }}
          ListEmptyComponent={
            <PromptChips onPick={onSubmitFromChip} />
          }
        />

        {/* Composer pinned above the keyboard */}
        <View style={[styles.composerWrap, { borderTopColor: t.divider, backgroundColor: t.bg }]}>
          <View style={[styles.composer, { backgroundColor: t.surface, borderColor: t.border }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask about a pairing, a plan, a bottle…"
              placeholderTextColor={t.textMuted}
              multiline
              maxLength={MAX_CHARS + 40}
              editable={!sending}
              style={[styles.input, { color: t.text }]}
              returnKeyType="default"
              accessibilityLabel="Message the Innkeeper"
            />
            <Bounce
              onPress={onSubmit}
              haptic="medium"
              disabled={!canSend}
              scaleTo={0.9}
              hitSlop={10}
              style={[styles.send, { backgroundColor: canSend ? t.accent : t.surfaceAlt }]}
              accessibilityLabel="Send to the Innkeeper"
            >
              {sending ? (
                <ActivityIndicator color={t.textOnAccent} size="small" />
              ) : (
                <Icon
                  name="arrow-up"
                  size={19}
                  color={canSend ? t.textOnAccent : t.textMuted}
                />
              )}
            </Bounce>
          </View>
          <Text style={[type.caption, { color: t.textMuted, marginTop: 6, textAlign: 'center' }]}>
            The Innkeeper is AI — enjoy responsibly, always your call.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  composerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 46,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    paddingVertical: 8,
    paddingRight: 4,
    maxHeight: 140,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
