// src/components/ui/Toast.js
// Lightweight toast so errors and confirmations never rely on a blocking alert.

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, variant = 'info') => {
    if (!message) return;
    clearTimeout(timer.current);
    setToast({ message, variant, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      {toast && <ToastView key={toast.id} {...toast} />}
    </ToastCtx.Provider>
  );
}

function ToastView({ message, variant }) {
  const { t, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, []);

  const cfg = {
    info: { icon: 'information-circle-outline', color: t.text, bg: t.surface },
    success: { icon: 'checkmark-circle-outline', color: t.success, bg: t.successSoft },
    error: { icon: 'alert-circle-outline', color: t.danger, bg: t.dangerSoft },
  }[variant] || {};

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { top: insets.top + 8, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] },
      ]}
    >
      <View style={[styles.toast, { backgroundColor: cfg.bg, borderColor: t.border }, elevation(t, 2)]}>
        <Icon name={cfg.icon} size={19} color={cfg.color} />
        <Text style={[type.label, { color: t.text, flex: 1 }]} numberOfLines={2}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 999 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
});

export default ToastView;
