// src/screens/AuthScreen.js
// Sign in / sign up. Age is verified at registration (the server enforces
// MIN_AGE independently — this is the first gate, not the only one).

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
  Pressable, Animated, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import api, { ORIGIN } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { radius, type } from '../theme/tokens';
import { Screen, Button, Icon, useToast } from '../components/ui';
import TextField from '../components/auth/TextField';

const MIN_AGE = 18;

function ageFrom(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  const dob = new Date(y, mo - 1, d);
  if (dob.getFullYear() !== y || dob.getMonth() !== mo - 1 || dob.getDate() !== d) return null;
  if (dob > new Date()) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  const before = now.getMonth() < mo - 1 || (now.getMonth() === mo - 1 && now.getDate() < d);
  if (before) age -= 1;
  return age;
}

// Auto-format keystrokes into YYYY-MM-DD without fighting the user's deletes.
function maskDate(next, prev) {
  const deleting = next.length < prev.length;
  const digits = next.replace(/\D/g, '').slice(0, 8);
  if (deleting && /[-]$/.test(next)) return next;
  let out = digits.slice(0, 4);
  if (digits.length > 4) out += '-' + digits.slice(4, 6);
  if (digits.length > 6) out += '-' + digits.slice(6, 8);
  return out;
}

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

export default function AuthScreen() {
  const { t } = useTheme();
  const { login } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const intro = useRef(new Animated.Value(0)).current;
  const swap = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 520, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    swap.setValue(0);
    Animated.timing(swap, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [mode]);

  const isRegister = mode === 'register';
  const age = useMemo(() => (dob.length === 10 ? ageFrom(dob) : null), [dob]);
  const pwScore = strength(password);
  const pwLabels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const pwColor = [t.danger, t.danger, t.warning, t.success, t.success][pwScore];

  const validate = () => {
    const e = {};
    if (isRegister && !name.trim()) e.name = 'What should we call you?';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Enter your password.';
    else if (isRegister && password.length < 8) e.password = 'Use at least 8 characters.';
    if (isRegister) {
      if (!dob) e.dob = 'We need your date of birth.';
      else if (age === null) e.dob = 'Use the format YYYY-MM-DD.';
      else if (age < MIN_AGE) e.dob = `You must be ${MIN_AGE} or over to join.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const payload = isRegister
        ? { name: name.trim(), email: email.trim().toLowerCase(), password, date_of_birth: dob }
        : { email: email.trim().toLowerCase(), password };
      const res = await api.post(isRegister ? '/auth/register' : '/auth/login', payload);
      await login(res.data.token, res.data.user);
    } catch (err) {
      const msg = err.safeMessage || 'Something went wrong.';
      if (err.response?.status === 401) setErrors({ password: 'Email or password is incorrect.' });
      else if (err.response?.status === 409) setErrors({ email: 'That email is already registered.' });
      else toast?.show(msg, 'error');
      setBusy(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setErrors({});
    setPassword('');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <LinearGradient
        colors={[t.accentSoft, t.bg]}
        style={styles.glow}
        pointerEvents="none"
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: intro,
              transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            }}
          >
            {/* Brand */}
            <View style={styles.brand}>
              <View style={styles.brandRow}>
                <Text style={[type.display, { color: t.text }]}>Drinked</Text>
                <View style={[styles.chip, { backgroundColor: t.accent }]}>
                  <Text style={[styles.chipText, { color: t.textOnAccent }]}>Inn</Text>
                </View>
              </View>
              <Text style={[type.body, { color: t.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 22 }]}>
                {isRegister
                  ? 'Stories start here.\nYour people. Your places. Your stories.'
                  : 'Welcome back. The inn’s still open.'}
              </Text>
            </View>

            {/* Mode switch */}
            <View style={[styles.switcher, { backgroundColor: t.surfaceAlt }]}>
              {[
                { key: 'login', label: 'Log in' },
                { key: 'register', label: 'Sign up' },
              ].map((m) => {
                const active = mode === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => switchMode(m.key)}
                    style={[
                      styles.switchBtn,
                      active && { backgroundColor: t.surface, borderColor: t.border },
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[type.label, { color: active ? t.text : t.textMuted }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Form */}
            <Animated.View
              style={{
                opacity: swap,
                transform: [{ translateY: swap.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
              }}
            >
              {isRegister && (
                <TextField
                  label="Name"
                  icon="person-outline"
                  value={name}
                  onChangeText={setName}
                  placeholder="Arjun Sharma"
                  autoCapitalize="words"
                  autoComplete="name"
                  maxLength={60}
                  error={errors.name}
                />
              )}

              <TextField
                label="Email"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                error={errors.email}
              />

              <TextField
                label="Password"
                icon="lock-closed-outline"
                value={password}
                onChangeText={setPassword}
                placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                trailing={showPw ? 'eye-off-outline' : 'eye-outline'}
                onTrailingPress={() => setShowPw((s) => !s)}
                error={errors.password}
              />

              {isRegister && !!password && (
                <View style={styles.meterRow}>
                  <View style={[styles.meterTrack, { backgroundColor: t.surfaceAlt }]}>
                    <View style={{ width: `${(pwScore / 4) * 100}%`, height: '100%', backgroundColor: pwColor, borderRadius: 3 }} />
                  </View>
                  <Text style={[type.caption, { color: pwColor }]}>{pwLabels[pwScore]}</Text>
                </View>
              )}

              {isRegister && (
                <TextField
                  label="Date of birth"
                  icon="calendar-outline"
                  value={dob}
                  onChangeText={(v) => setDob(maskDate(v, dob))}
                  placeholder="YYYY-MM-DD"
                  keyboardType="number-pad"
                  maxLength={10}
                  error={errors.dob}
                  hint={
                    age !== null && age >= MIN_AGE
                      ? `You're ${age} — welcome in.`
                      : `You must be ${MIN_AGE} or over. We check this once.`
                  }
                />
              )}

              <Button
                label={isRegister ? 'Create account' : 'Log in'}
                onPress={submit}
                loading={busy}
                full
                size="lg"
                style={{ marginTop: 6 }}
              />

              {!isRegister && (
                <Pressable
                  onPress={() =>
                    Linking.openURL(`${ORIGIN}/forgot-password`).catch(() =>
                      toast?.show('Reach us at hello@drinkedinn.app to reset your password.', 'info')
                    )
                  }
                  style={{ alignSelf: 'center', marginTop: 16 }}
                  hitSlop={8}
                >
                  <Text style={[type.label, { color: t.textSecondary }]}>Forgot your password?</Text>
                </Pressable>
              )}
            </Animated.View>

            {/* Age + legal */}
            <View style={[styles.legal, { borderTopColor: t.divider }]}>
              <View style={[styles.legalBadge, { backgroundColor: t.accentSoft }]}>
                <Icon name="shield-checkmark-outline" size={15} color={t.accent} />
              </View>
              <Text style={[type.caption, { color: t.textMuted, flex: 1, lineHeight: 18 }]}>
                {MIN_AGE}+ only. By continuing you agree to our{' '}
                <Text style={{ color: t.textSecondary, fontWeight: '600' }} onPress={() => Linking.openURL(`${ORIGIN}/terms`).catch(() => {})}>
                  Terms
                </Text>{' '}
                and{' '}
                <Text style={{ color: t.textSecondary, fontWeight: '600' }} onPress={() => Linking.openURL(`${ORIGIN}/privacy`).catch(() => {})}>
                  Privacy Policy
                </Text>
                , and confirm you're of legal drinking age.
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 28 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9 },
  chipText: { fontWeight: '800', fontSize: 26, letterSpacing: -0.6 },
  switcher: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, marginBottom: 24 },
  switchBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -6, marginBottom: 14 },
  meterTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  legal: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 28, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth },
  legalBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
