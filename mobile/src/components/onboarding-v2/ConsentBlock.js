// src/components/onboarding-v2/ConsentBlock.js
// Terms + Community Guidelines + Child Safety acceptance.
//
// Google Play requires a UGC app to surface its content policy and an explicit
// acceptance before a new account can post, and a dedicated child-safety
// standards page reachable in-app. This block is that gate — the single
// checkbox is the record of consent, and the step that renders it has no Skip.
//
// The documents open in the system browser via expo-web-browser rather than an
// in-app WebView: the hosted pages are the canonical, always-current ones, and
// a browser sheet keeps them plainly outside the app's own chrome.

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon } from '../ui';
import { ORIGIN } from '../../api';

// Built off the same pinned https origin the API client uses, so there is no
// second place to update if the host ever moves.
export const DOCS = [
  {
    key: 'terms',
    url: `${ORIGIN}/terms`,
    icon: 'document-text-outline',
    title: 'Terms of Service',
    body: 'What you agree to by using DrinkedInn, and what we owe you.',
  },
  {
    key: 'guidelines',
    url: `${ORIGIN}/guidelines`,
    icon: 'people-circle-outline',
    title: 'Community Guidelines',
    body: 'What belongs here, what does not, and how reports and blocks work.',
  },
  {
    key: 'child-safety',
    url: `${ORIGIN}/child-safety`,
    icon: 'shield-checkmark-outline',
    title: 'Child Safety Standards',
    body: 'DrinkedInn is 18+. How we prevent and report child sexual abuse material.',
  },
];

export default function ConsentBlock({ accepted, onToggle, onOpened }) {
  const { t } = useTheme();
  const [opening, setOpening] = useState(null);

  const open = useCallback(
    async (doc) => {
      if (opening) return;
      setOpening(doc.key);
      try {
        await WebBrowser.openBrowserAsync(doc.url, { dismissButtonStyle: 'close' });
        onOpened?.(doc.key);
      } catch {
        // A browser that refuses to open is not worth blocking acceptance over —
        // the same documents are linked from Account → Terms & policies.
      } finally {
        setOpening(null);
      }
    },
    [opening, onOpened]
  );

  return (
    <View>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        {DOCS.map((doc, i) => (
          <Pressable
            key={doc.key}
            onPress={() => open(doc)}
            style={({ pressed }) => [
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.divider },
              pressed && { backgroundColor: t.surfacePress },
            ]}
            accessibilityRole="link"
            accessibilityLabel={`${doc.title}. Opens in your browser.`}
          >
            <View style={[styles.iconWrap, { backgroundColor: t.accentSoft }]}>
              <Icon name={doc.icon} size={18} color={t.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]}>{doc.title}</Text>
              <Text style={[type.caption, { color: t.textSecondary, marginTop: 3, lineHeight: 17 }]}>
                {doc.body}
              </Text>
            </View>
            {opening === doc.key ? (
              <ActivityIndicator size="small" color={t.textMuted} />
            ) : (
              <Icon name="open-outline" size={17} color={t.textMuted} />
            )}
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => onToggle(!accepted)}
        style={({ pressed }) => [
          styles.consent,
          {
            backgroundColor: accepted ? t.accentSoft : pressed ? t.surfacePress : t.surface,
            borderColor: accepted ? t.accentBorder : t.border,
          },
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!accepted }}
        accessibilityLabel="I am 18 or older and I agree to the Terms and Community Guidelines"
        hitSlop={6}
      >
        <View
          style={[
            styles.box,
            {
              backgroundColor: accepted ? t.accent : 'transparent',
              borderColor: accepted ? t.accent : t.borderStrong,
            },
          ]}
        >
          {!!accepted && <Icon name="checkmark" size={15} color={t.textOnAccent} />}
        </View>
        <Text style={[type.body, { color: t.text, flex: 1, lineHeight: 21 }]}>
          I am 18+ and I agree to the Terms and Community Guidelines.
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14, paddingVertical: 14 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  consent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 15,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
