// src/screens/referrals/InviteScreen.js
// Invite friends. The screen shows the member's referral code big and shareable,
// their referral stats, and a leaderboard of who's brought the most people in.
//
// Contract (server/routes/referrals.js):
//   GET /api/referrals/code        → { code, referrals, link }
//   GET /api/referrals/leaderboard → [{ id, name, avatar, title, referral_count }, ...]
//
// A copy-to-clipboard shortcut would be ideal, but neither expo-clipboard nor
// @react-native-clipboard/clipboard is in package.json and React Native's own
// Clipboard module has been removed in RN 0.81. So both the code tap and the
// primary button open the OS share sheet — noted in the integrator handoff.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Share,
  Alert,
} from 'react-native';
import { showReportSheet } from '../../lib/reportSheet';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import {
  Screen,
  Header,
  Icon,
  FadeIn,
  useToast,
} from '../../components/ui';
import { Shimmer } from '../../components/ui/Skeleton';
import CodeCard from '../../components/referrals/CodeCard';
import LeaderRow from '../../components/referrals/LeaderRow';
import { track } from '../../lib/track';
import { pop } from '../../ui/haptics';

// Warm, on-brand invite copy. People first, then the moment. No mention of
// drinks or quantity — we're inviting them to a place, not a habit.
function buildMessage(link) {
  return `Join me on DrinkedInn — your people, your places, your stories. ${link}`;
}

function fallbackLink(code) {
  if (!code) return 'https://www.drinkedinn.com';
  return `https://www.drinkedinn.com/?ref=${encodeURIComponent(code)}`;
}

function InlineNotice({ icon, title, body }) {
  // A compact in-card empty/error state. EmptyState is tuned for full-screen
  // empties (72pt top padding), which would look ridiculous inside a card.
  return (
    <View style={inlineStyles.wrap}>
      <InlineIcon name={icon} />
      <InlineTitle>{title}</InlineTitle>
      <InlineBody>{body}</InlineBody>
    </View>
  );
}

function InlineIcon({ name }) {
  const { t } = useTheme();
  return (
    <View style={[inlineStyles.iconWrap, { backgroundColor: t.surfaceAlt }]}>
      <Icon name={name} size={20} color={t.textSecondary} />
    </View>
  );
}

function InlineTitle({ children }) {
  const { t } = useTheme();
  return <Text style={[type.bodyStrong, { color: t.text, textAlign: 'center' }]}>{children}</Text>;
}

function InlineBody({ children }) {
  const { t } = useTheme();
  return (
    <Text style={[type.caption, { color: t.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 18 }]}>
      {children}
    </Text>
  );
}

const inlineStyles = StyleSheet.create({
  wrap: { paddingVertical: 26, paddingHorizontal: 24, alignItems: 'center' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
});

const REPORT_REASONS = [
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'impersonation', label: 'Impersonation' },
  { key: 'inappropriate', label: 'Inappropriate profile' },
  { key: 'other', label: 'Something else' },
];

export default function InviteScreen({ navigation }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [code, setCode] = useState(null);
  const [link, setLink] = useState(null);
  const [referralCount, setReferralCount] = useState(0);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderErr, setLeaderErr] = useState(false);

  const load = useCallback(async () => {
    // Two independent calls; treat leaderboard failure as recoverable so
    // the code section still renders.
    const [codeRes, leaderRes] = await Promise.allSettled([
      api.get('/referrals/code'),
      api.get('/referrals/leaderboard'),
    ]);

    if (codeRes.status === 'fulfilled') {
      const data = codeRes.value?.data || {};
      const nextCode = typeof data.code === 'string' ? data.code : null;
      setCode(nextCode);
      setLink(typeof data.link === 'string' && data.link ? data.link : fallbackLink(nextCode));
      setReferralCount(Number.isFinite(data.referrals) ? data.referrals : 0);
    } else {
      throw codeRes.reason;
    }

    if (leaderRes.status === 'fulfilled' && Array.isArray(leaderRes.value?.data)) {
      setLeaders(leaderRes.value.data.filter((l) => l && l.id != null));
      setLeaderErr(false);
    } else {
      setLeaders([]);
      setLeaderErr(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        toast?.show(e?.safeMessage || 'Could not load your invite.', 'error');
      } finally {
        setLoading(false);
      }
    })();
    track('invite_screen_opened');
  }, [load, toast]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      toast?.show(e?.safeMessage || 'Could not refresh.', 'error');
    } finally {
      setRefreshing(false);
    }
  }, [load, toast]);

  const shareInvite = useCallback(
    async (source = 'button') => {
      if (!code) return;
      const shareLink = link || fallbackLink(code);
      const message = buildMessage(shareLink);
      try {
        const result = await Share.share(
          {
            message,
            // Only iOS reads `url`; sharing it separately makes richer previews.
            url: shareLink,
            title: 'Join me on DrinkedInn',
          },
          { subject: 'Join me on DrinkedInn', dialogTitle: 'Share your invite' }
        );
        if (result?.action === Share.sharedAction) {
          pop();
          track('invite_shared', { source });
        }
      } catch (e) {
        toast?.show('Could not open share sheet.', 'error');
      }
    },
    [code, link, toast]
  );

  const openProfile = useCallback(
    (leader) => {
      if (!leader?.id) return;
      if (leader.id === user?.id) navigation.navigate('Account');
      else navigation.navigate('User', { userId: leader.id });
    },
    [navigation, user?.id]
  );

  // Report / block on a leaderboard entry — required for UGC surfaces.
  const reportUser = useCallback(
    async (leader, reason) => {
      if (!leader?.id) return;
      try {
        await api.post('/reports', {
          target_type: 'user',
          target_id: leader.id,
          reason,
        });
        toast?.show('Reported. Our team will review it.', 'success');
      } catch (e) {
        toast?.show(e?.safeMessage || 'Could not send that report.', 'error');
      }
    },
    [toast]
  );

  const blockUser = useCallback(
    (leader) => {
      if (!leader?.id) return;
      const name = leader.name || 'this member';
      Alert.alert(
        `Block ${name}?`,
        `You won't see ${name}'s pours, and they won't see yours. Any connection between you is removed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.post(`/blocks/${leader.id}`);
                toast?.show(`${name} is blocked.`, 'success');
                // Hide the row locally so the block feels applied.
                setLeaders((rows) => rows.filter((r) => r.id !== leader.id));
              } catch (e) {
                toast?.show(e?.safeMessage || 'Could not block that member.', 'error');
              }
            },
          },
        ]
      );
    },
    [toast]
  );

  const openLeaderMenu = useCallback(
    (leader) => {
      if (!leader?.id || leader.id === user?.id) return;
      Alert.alert(leader.name || 'Options', null, [
        {
          text: 'Report this member',
          onPress: async () => {
            const key = await showReportSheet({ title: "Report this member — what's wrong?", reasons: REPORT_REASONS });
            if (key) reportUser(leader, key);
          },
        },
        {
          text: `Block ${leader.name || 'this member'}`,
          style: 'destructive',
          onPress: () => blockUser(leader),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [user?.id, reportUser, blockUser]
  );

  return (
    <Screen>
      <Header title="Invite friends" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60, paddingTop: 4 }}
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
      >
        {/* Intro */}
        <View style={styles.introBlock}>
          <Text style={[type.h2, { color: t.text }]}>Bring the good ones in.</Text>
          <Text style={[type.body, { color: t.textSecondary, marginTop: 6, lineHeight: 22 }]}>
            The best moments are the ones you share. Send your code — when a friend joins,
            you'll both find each other on the feed.
          </Text>
        </View>

        <FadeIn>
          <CodeCard
            code={code}
            link={link}
            loading={loading}
            hasClipboard={false}
            onSharePress={() => shareInvite('button')}
            onCodePress={() => shareInvite('code_tap')}
          />
        </FadeIn>

        {/* Stat strip */}
        <View style={styles.stats}>
          {loading ? (
            <Shimmer style={{ height: 78, borderRadius: radius.md, flex: 1 }} />
          ) : (
            <View style={[styles.statCard, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={[styles.statIcon, { backgroundColor: t.accentSoft }]}>
                <Icon name="people-outline" size={17} color={t.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.h1, { color: t.text }]} allowFontScaling={false}>
                  {referralCount}
                </Text>
                <Text style={[type.caption, { color: t.textMuted }]}>
                  {referralCount === 1
                    ? 'friend has joined so far'
                    : referralCount === 0
                    ? 'friends yet — send your first invite'
                    : 'friends have joined so far'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Leaderboard */}
        <View style={styles.sectionHead}>
          <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>
            Top hosts
          </Text>
          <Text style={[type.caption, { color: t.textMuted, marginTop: 4 }]}>
            Members who've brought the most people to the bar.
          </Text>
        </View>

        <View style={[styles.leaderCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          {loading ? (
            <View style={{ padding: 14 }}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.skeletonRow,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.divider, paddingTop: 12, marginTop: 12 },
                  ]}
                >
                  <Shimmer style={{ width: 26, height: 26, borderRadius: 13 }} />
                  <Shimmer style={{ width: 38, height: 38, borderRadius: 19 }} />
                  <View style={{ flex: 1 }}>
                    <Shimmer style={{ width: '55%', height: 12, borderRadius: 6 }} />
                    <Shimmer style={{ width: '38%', height: 10, borderRadius: 5, marginTop: 8 }} />
                  </View>
                  <Shimmer style={{ width: 34, height: 22, borderRadius: 6 }} />
                </View>
              ))}
            </View>
          ) : leaderErr ? (
            <InlineNotice
              icon="cloud-offline-outline"
              title="Couldn't load the leaderboard"
              body="Pull down to try again — your code and stats are still ready."
            />
          ) : leaders.length === 0 ? (
            <InlineNotice
              icon="trophy-outline"
              title="No hosts yet"
              body="Send your first invite — you could be at the top of this list."
            />
          ) : (
            leaders.map((leader, i) => (
              <LeaderRow
                key={String(leader.id)}
                leader={leader}
                rank={i + 1}
                isMe={leader.id === user?.id}
                onOpen={openProfile}
                onLongPress={openLeaderMenu}
                last={i === leaders.length - 1}
              />
            ))
          )}
        </View>

        <Text style={[styles.footHint, { color: t.textMuted }]}>
          Long-press a name to report or block. Members must be 18+ to join.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  introBlock: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 18 },
  stats: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 18 },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: {
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 10,
  },
  leaderCard: {
    marginHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footHint: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 14,
    marginHorizontal: 32,
  },
});
