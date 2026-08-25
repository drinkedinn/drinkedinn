// src/lib/appLock.js
// Optional biometric app lock (Face ID / Touch ID / fingerprint). Opt-in per
// device and stored locally — enabling it only gates access to the running app,
// it never replaces the server-side session.

import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'di_biometric_lock';

export async function isBiometricAvailable() {
  try {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

export async function biometricLabel() {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Fingerprint';
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Iris';
  } catch {}
  return 'Biometrics';
}

export async function isLockEnabled() {
  try { return (await AsyncStorage.getItem(KEY)) === '1'; } catch { return false; }
}

export async function setLockEnabled(on) {
  try { await AsyncStorage.setItem(KEY, on ? '1' : '0'); } catch {}
}

export async function authenticate(reason = 'Unlock DrinkedInn') {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}
