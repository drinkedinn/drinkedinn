// src/components/composer/CreateSheet.js
// "Share a moment" — the Create bottom sheet.
//
// Not a screen. One host is mounted at the app root and any code can raise it,
// which is why the Create tab can be a sheet instead of a fifth screen: the tab
// bar calls openCreateSheet() and never navigates.
//
// Structure mirrors src/lib/reportSheet.js — a module-level resolver, an
// imperative opener that returns a promise, and a provider mounted once at the
// root — so there is one sheet idiom in this app rather than two.
//
// Usage from anywhere with a navigation object (tab bar, header button, FAB):
//   openCreateSheet({ navigation, source: 'tab_bar' })
//
// Usage inside a screen:
//   const openCreate = useCreateSheet();
//   <Bounce onPress={() => openCreate({ source: 'feed_fab' })} />
//
// Usage where you want to route it yourself:
//   const choice = await openCreateSheet();      // no navigation passed
//   if (choice) navigation.navigate(choice.route, choice.params);
//
// Resolves with the chosen action object ({ key, label, route, params, ... })
// or null if the sheet was dismissed.

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, Pressable, ScrollView, StyleSheet, Animated, Easing, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContext } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { radius, type } from '../../theme/tokens';
import { useToast } from '../ui';
import { track } from '../../lib/track';
import { tap } from '../../ui/haptics';
import { CREATE_ACTIONS, normalizeActions } from './createActions';
import CreateSheetRow from './CreateSheetRow';

const DEFAULT_TITLE = 'Share a moment';
const TRAVEL = 420;

// iOS refuses to present a second modal while one is still on screen, and three
// of the four destinations are `presentation: 'modal'` screens. So the push
// waits for this sheet's Modal to actually be gone.
const NAV_DELAY_MS = Platform.OS === 'ios' ? 180 : 0;

// ── module-level resolver ───────────────────────────────────────────────────
let hostOpen = null;      // (props) => void, provided by the mounted host
let hostClose = null;     // (action|null) => void
let currentResolve = null;
let pendingNavigation = null;

/**
 * Raise the Create sheet.
 *
 * @param {object}   [options]
 * @param {object}   [options.navigation] navigation object; when given, the
 *                   sheet routes the chosen action itself after it closes.
 * @param {string}   [options.source]     analytics label for where it opened from.
 * @param {string}   [options.title]      override the sheet title.
 * @param {Array}    [options.actions]    override the rows.
 * @param {Function} [options.onChoose]   called with the chosen action.
 * @returns {Promise<object|null>} the chosen action, or null if dismissed.
 */
export function openCreateSheet(options = {}) {
  const opts = options || {};
  const { navigation, source, title, actions, onChoose } = opts;

  return new Promise((resolve) => {
    // Never strand an earlier caller's promise if the sheet is re-opened.
    if (currentResolve) {
      const previous = currentResolve;
      currentResolve = null;
      previous(null);
    }

    if (!hostOpen) {
      if (__DEV__) {
        console.warn('[CreateSheet] openCreateSheet() called before <CreateSheetProvider> was mounted.');
      }
      resolve(null);
      return;
    }

    currentResolve = (action) => {
      resolve(action || null);
      if (action && typeof onChoose === 'function') {
        try { onChoose(action); } catch {}
      }
    };
    pendingNavigation = navigation || null;

    track('create_sheet_opened', source ? { source } : undefined);
    hostOpen({ title: title || DEFAULT_TITLE, actions: normalizeActions(actions) });
  });
}

/** Close the sheet from outside (e.g. a deep link taking over). Resolves null. */
export function closeCreateSheet() {
  hostClose?.(null);
}

/**
 * Screen-friendly opener. Picks up the screen's navigation object so callers
 * do not have to thread it through. Safe outside a navigator — it simply
 * resolves the choice instead of routing it.
 */
export function useCreateSheet() {
  const navigation = useContext(NavigationContext);
  return useCallback(
    (options) => openCreateSheet({ navigation, ...(options || {}) }),
    [navigation]
  );
}

// Walk up the navigator tree looking for the route. Prevents a dead tap (and a
// red box in dev) when a destination has not been registered yet — "Add a
// place" lands with the Places module, and this sheet may ship first.
function routeIsRegistered(nav, routeName) {
  if (!nav || !routeName) return false;
  let node = nav;
  let sawRouteNames = false;

  for (let depth = 0; node && depth < 12; depth += 1) {
    let names;
    try { names = node.getState?.()?.routeNames; } catch {}
    if (Array.isArray(names)) {
      sawRouteNames = true;
      if (names.includes(routeName)) return true;
    }

    let parent;
    try { parent = node.getParent?.(); } catch {}
    if (!parent || parent === node) break;
    node = parent;
  }

  // If no navigator would tell us its route names, don't block the tap.
  return !sawRouteNames;
}

function CreateSheetHost() {
  const { t } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [visible, setVisible] = useState(false);
  const [sheet, setSheet] = useState({ title: DEFAULT_TITLE, actions: CREATE_ACTIONS });

  // A signed-out session must not leave a create sheet floating over the auth
  // screen. The host owns its own `visible` state, so nothing else can clear it.
  useEffect(() => {
    if (!user && visible) {
      setVisible(false);
      const r = currentResolve;
      currentResolve = null;
      r?.(null);
    }
  }, [user, visible]);

  const translateY = useRef(new Animated.Value(TRAVEL)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const navTimer = useRef(null);
  const closing = useRef(false);
  const shown = useRef(false);
  // Bumped on every open so a close animation that is already in flight cannot
  // hide a sheet that has since been re-opened.
  const generation = useRef(0);

  // The host registers itself with the module-level resolver exactly once and
  // reads the latest callbacks through these refs rather than re-registering,
  // because re-running that effect would tear down an open sheet — useToast()
  // hands back a fresh object on every ToastProvider render, so anything
  // depending on it changes identity whenever an unrelated toast appears.
  const goRef = useRef(null);
  const dismissRef = useRef(null);
  const animateInRef = useRef(null);

  const animateIn = useCallback(() => {
    translateY.stopAnimation();
    opacity.stopAnimation();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [translateY, opacity]);

  const go = useCallback(
    (nav, action) => {
      if (!nav || !action?.route) return;
      if (!routeIsRegistered(nav, action.route)) {
        toast?.show(`${action.label} isn’t available yet.`, 'info');
        return;
      }
      try {
        nav.navigate(action.route, action.params);
      } catch {
        toast?.show('Could not open that just now.', 'error');
      }
    },
    [toast]
  );

  const dismiss = useCallback(
    (action) => {
      if (!shown.current || closing.current) return;
      closing.current = true;

      const myGeneration = generation.current;
      translateY.stopAnimation();
      opacity.stopAnimation();

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: TRAVEL, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start(() => {
        // Re-opened while this close was running — leave the new sheet alone.
        if (myGeneration !== generation.current) return;

        closing.current = false;
        shown.current = false;
        setVisible(false);

        const resolve = currentResolve;
        const nav = pendingNavigation;
        currentResolve = null;
        pendingNavigation = null;

        resolve?.(action || null);

        if (!action) {
          track('create_sheet_dismissed');
          return;
        }
        track('create_sheet_action', { action: action.key, route: action.route });

        if (!nav) return;
        if (navTimer.current) clearTimeout(navTimer.current);
        navTimer.current = setTimeout(() => {
          navTimer.current = null;
          goRef.current?.(nav, action);
        }, NAV_DELAY_MS);
      });
    },
    [translateY, opacity]
  );

  useEffect(() => {
    goRef.current = go;
    dismissRef.current = dismiss;
    animateInRef.current = animateIn;
  }, [go, dismiss, animateIn]);

  useEffect(() => {
    hostOpen = (next) => {
      generation.current += 1;
      closing.current = false;
      if (navTimer.current) { clearTimeout(navTimer.current); navTimer.current = null; }

      // Already on screen (re-opened mid-close): nothing will re-render on
      // `visible`, so drive the entrance here. Otherwise the effect below runs
      // it once the Modal's content has actually mounted.
      const wasShown = shown.current;
      shown.current = true;
      setSheet(next);
      setVisible(true);
      if (wasShown) animateInRef.current?.();
    };
    hostClose = (action) => dismissRef.current?.(action || null);

    return () => {
      hostOpen = null;
      hostClose = null;
      shown.current = false;
      if (navTimer.current) { clearTimeout(navTimer.current); navTimer.current = null; }
      // Don't leave an awaiting caller hanging if the tree unmounts.
      const resolve = currentResolve;
      currentResolve = null;
      pendingNavigation = null;
      resolve?.(null);
    };
  }, []);

  // Animate in once the Modal's content is mounted; park it below the fold
  // again once it is closed, so the next open starts from the right place.
  useEffect(() => {
    if (visible) {
      animateIn();
    } else {
      translateY.setValue(TRAVEL);
      opacity.setValue(0);
    }
  }, [visible, animateIn, translateY, opacity]);

  const onChoose = useCallback(
    (action) => {
      tap();
      dismiss(action);
    },
    [dismiss]
  );

  const rows = Array.isArray(sheet?.actions) && sheet.actions.length ? sheet.actions : CREATE_ACTIONS;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => dismiss(null)}
    >
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: t.scrim, opacity }]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => dismiss(null)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            backgroundColor: t.bgElevated,
            borderColor: t.border,
            paddingBottom: Math.max(insets.bottom, 12),
            transform: [{ translateY }],
            // A bottom sheet's shadow has to fall upward, so this is hand-rolled
            // from the shadow tokens rather than using elevation().
            shadowColor: t.shadowColor,
            shadowOpacity: t.shadowOpacity * 1.2,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: -6 },
            elevation: 16,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: t.borderStrong }]} />

        <Text style={[type.h2, { color: t.text, textAlign: 'center', marginBottom: 14 }]} numberOfLines={2}>
          {sheet?.title || DEFAULT_TITLE}
        </Text>

        <ScrollView
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 2 }}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {rows.map((action, i) => (
            <CreateSheetRow
              key={`${action?.key || 'row'}_${i}`}
              action={action}
              first={i === 0}
              onPress={onChoose}
            />
          ))}
        </ScrollView>

        <Pressable
          onPress={() => dismiss(null)}
          style={({ pressed }) => [
            styles.cancel,
            { backgroundColor: pressed ? t.surfacePress : t.surfaceAlt },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={[type.bodyStrong, { color: t.text }]}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

/** Mount once at the app root, inside ToastProvider and NavigationContainer. */
export function CreateSheetProvider({ children }) {
  return (
    <>
      {children}
      <CreateSheetHost />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  list: { flexGrow: 0, flexShrink: 1 },
  cancel: {
    marginTop: 12,
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
});

export default CreateSheetProvider;
