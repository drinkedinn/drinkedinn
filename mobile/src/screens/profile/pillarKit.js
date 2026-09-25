// src/screens/profile/pillarKit.js
// Shared primitives for the six profile pillars.
//
// Everything in here is deliberately layout-only and non-virtualised. The
// pillars render inside ProfileScreen's existing scroll container, so a nested
// vertical FlatList/SectionList would fight the parent (and log the
// "VirtualizedLists should never be nested" warning). Lists are capped and
// expanded on demand instead — see LIST_CAP usage in each tab.

import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { mediaUrl } from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce, Shimmer, EmptyState } from '../../components/ui';

/* ── time / text helpers ─────────────────────────────────────────────────── */

// SQLite hands back "YYYY-MM-DD HH:MM:SS" in UTC. Safari/Hermes will not parse
// that without the T and the Z, and a bad parse renders "NaN" in the UI.
export function parseDate(ts) {
  if (!ts) return null;
  const raw = String(ts);
  const d = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  return isNaN(d.getTime()) ? null : d;
}

export function timeAgo(ts) {
  const d = parseDate(ts);
  if (!d) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 0) return 'now';
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

export function monthLabel(ts) {
  const d = parseDate(ts);
  if (!d) return '';
  try {
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export function plural(n, one, many) {
  const v = Number(n) || 0;
  return `${v} ${v === 1 ? one : many || `${one}s`}`;
}

// Scores are stored 0–10 in half steps (server/routes/ratings.js, ScoreControl).
export function scoreText(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/* ── countries ───────────────────────────────────────────────────────────── */

// place_visits.country holds an ISO-3166 alpha-2 code (see server
// lib/clientCountry.js). Flags-as-emoji are not used as UI — a readable name
// plus one Ionicon keeps the icon language consistent.
const COUNTRY_NAMES = {
  AE: 'United Arab Emirates', AR: 'Argentina', AT: 'Austria', AU: 'Australia',
  BE: 'Belgium', BR: 'Brazil', CA: 'Canada', CH: 'Switzerland', CL: 'Chile',
  CN: 'China', CO: 'Colombia', CZ: 'Czechia', DE: 'Germany', DK: 'Denmark',
  EE: 'Estonia', EG: 'Egypt', ES: 'Spain', FI: 'Finland', FR: 'France',
  GB: 'United Kingdom', GR: 'Greece', HK: 'Hong Kong', HR: 'Croatia',
  HU: 'Hungary', ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IN: 'India',
  IS: 'Iceland', IT: 'Italy', JP: 'Japan', KE: 'Kenya', KR: 'South Korea',
  LT: 'Lithuania', LU: 'Luxembourg', LV: 'Latvia', MA: 'Morocco',
  MX: 'Mexico', MY: 'Malaysia', NG: 'Nigeria', NL: 'Netherlands',
  NO: 'Norway', NZ: 'New Zealand', PE: 'Peru', PH: 'Philippines',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', RS: 'Serbia', SE: 'Sweden',
  SG: 'Singapore', SI: 'Slovenia', SK: 'Slovakia', TH: 'Thailand',
  TR: 'Türkiye', TW: 'Taiwan', UA: 'Ukraine', US: 'United States',
  VN: 'Vietnam', ZA: 'South Africa',
};

export function countryLabel(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return 'Somewhere';
  return COUNTRY_NAMES[c] || c;
}

/* ── navigation ──────────────────────────────────────────────────────────── */

// Re-exported from the shared implementation so there is exactly one copy.
// See src/lib/nav.js for why this is needed at all.
export { navigateByName } from '../../lib/nav';

/* ── layout ──────────────────────────────────────────────────────────────── */

export const GUTTER = 16;
export const GAP = 10;

/** Measure the real container width so grids work at any parent width. */
export function useMeasuredWidth(fallback = 0) {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e) => {
    const w = e?.nativeEvent?.layout?.width;
    if (typeof w === 'number' && w > 0) setWidth(Math.round(w));
  }, []);
  return [width > 0 ? width : fallback, onLayout];
}

export function columnWidth(total, columns, gap = GAP) {
  const cols = Math.max(1, columns);
  const w = (Number(total) || 0) - gap * (cols - 1);
  return Math.max(0, Math.floor(w / cols));
}

/** Split a flat list into rows of `n` so a grid can be laid out with Views. */
export function chunk(list, n) {
  const arr = Array.isArray(list) ? list : [];
  const size = Math.max(1, n);
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ── building blocks ─────────────────────────────────────────────────────── */

/** Image with a themed fallback tile — never a blank hole while loading. */
export function Thumb({ uri, width, height, round = radius.md, icon = 'wine-outline', iconSize = 20 }) {
  const { t } = useTheme();
  const src = mediaUrl(uri);
  const box = { width, height, borderRadius: round, backgroundColor: t.surfaceAlt };

  if (!src) {
    return (
      <View style={[box, styles.center]}>
        <Icon name={icon} size={iconSize} color={t.textMuted} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: src }}
      style={box}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
    />
  );
}

/** The "…" affordance that keeps Report/Block reachable from the content. */
export function OptionsButton({ onPress, label = 'Options', overlay, style }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.optionsBtn,
        overlay
          ? { backgroundColor: t.scrim, position: 'absolute', top: 6, right: 6 }
          : { backgroundColor: 'transparent' },
        pressed && { opacity: 0.6 },
        style,
      ]}
    >
      <Icon name="ellipsis-horizontal" size={15} color={overlay ? '#FFFFFF' : t.textMuted} />
    </Pressable>
  );
}

export function SectionHeading({ title, caption, actionLabel, onAction }) {
  const { t } = useTheme();
  return (
    <View style={styles.headingRow}>
      <View style={{ flex: 1 }}>
        <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>{title}</Text>
        {!!caption && (
          <Text style={[type.caption, { color: t.textMuted, marginTop: 3 }]} numberOfLines={1}>
            {caption}
          </Text>
        )}
      </View>
      {!!actionLabel && (
        <Bounce onPress={onAction} haptic="light" hitSlop={8} accessibilityLabel={actionLabel}>
          <Text style={[type.label, { color: t.accent }]}>{actionLabel}</Text>
        </Bounce>
      )}
    </View>
  );
}

/** A compact moment row — used by Places and Trips. */
export function MomentRow({ post, onPress, onOptions, showAuthor }) {
  const { t } = useTheme();
  if (!post) return null;

  const meta = [
    showAuthor ? post.name : null,
    post.location || null,
    timeAgo(post.created_at) || null,
  ].filter(Boolean).join(' · ');

  return (
    <Bounce
      onPress={onPress}
      haptic="light"
      scaleTo={0.985}
      accessibilityLabel={`Open moment${post.name ? ` by ${post.name}` : ''}`}
      style={[styles.momentRow, { backgroundColor: t.surface, borderColor: t.border }]}
    >
      <Thumb uri={post.image_url} width={52} height={52} round={radius.sm} icon="image-outline" />
      <View style={{ flex: 1, marginLeft: 12, marginRight: onOptions ? 4 : 0 }}>
        <Text style={[type.body, { color: t.text, lineHeight: 20 }]} numberOfLines={2}>
          {String(post.content || '').trim() || 'A moment'}
        </Text>
        {!!meta && (
          <Text style={[type.caption, { color: t.textMuted, marginTop: 4 }]} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>
      {onOptions ? <OptionsButton onPress={onOptions} label="Moment options" /> : null}
    </Bounce>
  );
}

/* ── states ──────────────────────────────────────────────────────────────── */

/**
 * Loading placeholder. `variant` mirrors the geometry of the tab it stands in
 * so the switch from skeleton to content doesn't jump.
 */
export function PillarSkeleton({ variant = 'rows', width = 0 }) {
  const { t } = useTheme();

  if (variant === 'rail') {
    return (
      <View style={{ paddingHorizontal: GUTTER }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ alignItems: 'center' }}>
              <Shimmer style={{ width: 64, height: 64, borderRadius: 32 }} />
              <Shimmer style={{ width: 38, height: 8, borderRadius: 4, marginTop: 8 }} />
            </View>
          ))}
        </View>
        <Shimmer style={{ width: '100%', height: 132, borderRadius: radius.md, marginTop: 22 }} />
      </View>
    );
  }

  if (variant === 'grid2' || variant === 'grid3') {
    const cols = variant === 'grid2' ? 2 : 3;
    const w = columnWidth(width, cols);
    const h = variant === 'grid2' ? 132 : 150;
    return (
      <View style={{ paddingHorizontal: GUTTER }}>
        {[0, 1].map((r) => (
          <View key={r} style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
            {Array.from({ length: cols }).map((_, c) => (
              <Shimmer key={c} style={{ width: w || undefined, flex: w ? undefined : 1, height: h, borderRadius: radius.md }} />
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[styles.skelRow, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <Shimmer style={{ width: 52, height: 52, borderRadius: radius.sm }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Shimmer style={{ width: '62%', height: 12, borderRadius: 6 }} />
            <Shimmer style={{ width: '38%', height: 10, borderRadius: 5, marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Inline failure with a retry. The toast already carried err.safeMessage. */
export function PillarError({ message, onRetry }) {
  const { t } = useTheme();
  return (
    <View style={[styles.errorBox, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={[styles.errorIcon, { backgroundColor: t.dangerSoft }]}>
        <Icon name="cloud-offline-outline" size={17} color={t.danger} />
      </View>
      <Text style={[type.body, { color: t.textSecondary, flex: 1, lineHeight: 20 }]}>
        {message || 'That didn’t load.'}
      </Text>
      <Bounce onPress={onRetry} haptic="light" hitSlop={10} accessibilityLabel="Try again">
        <Text style={[type.label, { color: t.accent }]}>Retry</Text>
      </Bounce>
    </View>
  );
}

/**
 * House EmptyState, pulled up a little. EmptyState reserves 72px of head room
 * for a full screen; inside a tab body that sits under a tab bar it reads as a
 * gap, so the wrapper trims it without forking the component.
 */
export function PillarEmpty(props) {
  return (
    <View style={{ marginTop: -26, marginBottom: 10 }}>
      <EmptyState {...props} />
    </View>
  );
}

/** "Show all 24" footer for capped lists. */
export function ShowAll({ hidden, onPress }) {
  const { t } = useTheme();
  if (!hidden || hidden <= 0) return null;
  return (
    <Bounce
      onPress={onPress}
      haptic="light"
      scaleTo={0.98}
      accessibilityLabel={`Show ${hidden} more`}
      style={[styles.showAll, { borderColor: t.border, backgroundColor: t.surface }]}
    >
      <Text style={[type.label, { color: t.text }]}>Show {hidden} more</Text>
      <Icon name="chevron-down" size={15} color={t.textMuted} />
    </Bounce>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  optionsBtn: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  headingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: GUTTER, marginBottom: 10,
  },
  momentRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: GUTTER, marginBottom: GAP,
    padding: 11, borderRadius: radius.md, borderWidth: 1,
  },
  skelRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: GAP, padding: 11, borderRadius: radius.md, borderWidth: 1,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: GUTTER, padding: 14,
    borderRadius: radius.md, borderWidth: 1,
  },
  errorIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  showAll: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: GUTTER, marginTop: 2, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1,
  },
});
