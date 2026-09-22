// src/lib/reportSheet.js
// Cross-platform report-reason picker.
//
// Report menus were built with Alert.alert(). That works on iOS but Android's
// dialog silently truncates to the first three buttons, so a report flow with
// five reasons + Cancel loses two reasons + Cancel entirely on Android. Users
// there could not file the last two reason categories or even dismiss the
// dialog. This module renders a real bottom sheet that accepts any number of
// reasons on both platforms.
//
// Usage:
//   const reason = await showReportSheet({ title, reasons })
//   if (reason) await api.post('/reports', { target_type, target_id, reason })
//
// Returns the chosen reason key, or null if dismissed.

import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { radius, type } from '../theme/tokens';
import { Icon } from '../components/ui';

// Module-level resolver — the sheet is imperative, so callers can await it.
let currentResolve = null;
let setVisibleFn = null;
let setPropsFn = null;

export function showReportSheet({ title = 'What’s wrong with it?', reasons = [], onChoose }) {
  return new Promise((resolve) => {
    currentResolve = (val) => { resolve(val); if (onChoose && val) onChoose(val); };
    setPropsFn?.({ title, reasons });
    setVisibleFn?.(true);
  });
}

function ReportSheetHost() {
  const { t } = useTheme();
  const [visible, setVisible] = useState(false);
  const [props, setProps] = useState({ title: '', reasons: [] });
  const translateY = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => { setVisibleFn = setVisible; setPropsFn = setProps; return () => { setVisibleFn = null; setPropsFn = null; }; }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      translateY.setValue(300); opacity.setValue(0);
    }
  }, [visible, translateY, opacity]);

  const dismiss = (chosen) => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 300, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      const r = currentResolve; currentResolve = null;
      r?.(chosen ?? null);
    });
  };

  return (
    <Modal transparent visible={visible} onRequestClose={() => dismiss(null)} animationType="none" statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)', opacity }]}>
        <Pressable style={{ flex: 1 }} onPress={() => dismiss(null)} accessibilityLabel="Dismiss" />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: t.bgElevated, borderColor: t.border, transform: [{ translateY }] },
          Platform.OS === 'ios' && { paddingBottom: 34 },
        ]}
      >
        <View style={styles.grabber} />
        <Text style={[type.bodyStrong, { color: t.text, textAlign: 'center', marginBottom: 8 }]} numberOfLines={2}>
          {props.title}
        </Text>
        {(props.reasons || []).map((r, i) => (
          <Pressable
            key={r.key}
            onPress={() => dismiss(r.key)}
            style={({ pressed }) => [
              styles.row,
              { borderTopColor: t.divider, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, backgroundColor: pressed ? t.surfacePress : 'transparent' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={r.label}
          >
            <Text style={[type.body, { color: t.text, flex: 1 }]}>{r.label}</Text>
            <Icon name="chevron-forward" size={16} color={t.textMuted} />
          </Pressable>
        ))}
        <Pressable
          onPress={() => dismiss(null)}
          style={({ pressed }) => [styles.cancel, { backgroundColor: pressed ? t.surfacePress : t.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={[type.bodyStrong, { color: t.text }]}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// Mount host at root — export as a named component the App root includes once.
export function ReportSheetProvider({ children }) {
  return (
    <>
      {children}
      <ReportSheetHost />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: radius.lg || 16, borderTopRightRadius: radius.lg || 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10, paddingHorizontal: 8, paddingBottom: 12,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#00000022', marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 15 },
  cancel: { marginTop: 12, marginHorizontal: 8, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
});
