// src/components/referrals/CodeCard.js
// The hero card on InviteScreen: an oversized referral code, a link preview,
// and one primary action that opens the native share sheet with the full
// on-brand invite message. Skeleton state is styled to match the loaded card
// so the layout doesn't jump.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce, Button } from '../ui';
import { Shimmer } from '../ui/Skeleton';

function CodeChars({ code, color }) {
  // Space out characters so the code reads as its own display element
  // rather than a variable-name string.
  const chars = String(code || '').split('');
  return (
    <View style={styles.charsRow}>
      {chars.map((c, i) => (
        <Text key={`${c}-${i}`} style={[styles.charText, { color }]} allowFontScaling={false}>
          {c}
        </Text>
      ))}
    </View>
  );
}

export default function CodeCard({
  code,
  link,
  loading,
  onSharePress,
  onCodePress,
  hasClipboard,
}) {
  const { t, elevation } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, elevation(t, 2)]}>
      <View style={styles.headRow}>
        <View style={[styles.iconChip, { backgroundColor: t.accentSoft }]}>
          <Icon name="gift-outline" size={16} color={t.accent} />
        </View>
        <Text style={[type.overline, { color: t.accentText, textTransform: 'uppercase' }]}>
          Your invite code
        </Text>
      </View>

      {loading ? (
        <Shimmer style={{ height: 56, borderRadius: radius.md, marginTop: 14 }} />
      ) : (
        <Bounce
          haptic="light"
          scaleTo={0.985}
          onPress={onCodePress}
          disabled={!code}
          accessibilityLabel={
            code
              ? hasClipboard
                ? `Copy invite code ${code}`
                : `Share invite code ${code}`
              : 'Invite code unavailable'
          }
          style={{ marginTop: 14 }}
        >
          <View style={[styles.codeBox, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}>
            <CodeChars code={code || '••••••••'} color={t.accentText} />
            <View style={styles.codeHint}>
              <Icon
                name={hasClipboard ? 'copy-outline' : 'share-outline'}
                size={13}
                color={t.accentText}
              />
              <Text style={[type.caption, { color: t.accentText, fontWeight: '600' }]}>
                {hasClipboard ? 'Tap to copy' : 'Tap to share'}
              </Text>
            </View>
          </View>
        </Bounce>
      )}

      {loading ? (
        <Shimmer style={{ height: 14, borderRadius: 7, marginTop: 12, width: '80%' }} />
      ) : (
        !!link && (
          <View style={styles.linkRow}>
            <Icon name="link-outline" size={14} color={t.textMuted} />
            <Text
              style={[type.caption, { color: t.textMuted, flex: 1 }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {link}
            </Text>
          </View>
        )
      )}

      <View style={{ marginTop: 18 }}>
        <Button
          label="Share your invite"
          icon="share-outline"
          onPress={onSharePress}
          disabled={loading || !code}
          full
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 18,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconChip: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBox: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  charsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  charText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  codeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
});
