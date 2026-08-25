// src/lib/secureStore.js
// Credentials live in the OS keystore — iOS Keychain / Android EncryptedSharedPreferences
// via expo-secure-store — never in AsyncStorage, which is plaintext on disk and
// readable on a rooted/jailbroken device or from an unencrypted device backup.
//
// SecureStore is unavailable on web, so we degrade to an in-memory store there
// rather than silently writing a token to localStorage.

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'di_auth_token';
const USER_KEY = 'di_user_profile';

const memory = new Map();
const isWeb = Platform.OS === 'web';

async function setItem(key, value) {
  if (isWeb) { memory.set(key, value); return; }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function getItem(key) {
  if (isWeb) return memory.get(key) ?? null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function removeItem(key) {
  if (isWeb) { memory.delete(key); return; }
  try { await SecureStore.deleteItemAsync(key); } catch {}
}

export const secureStore = {
  async setToken(token) { await setItem(TOKEN_KEY, token); },
  async getToken() { return getItem(TOKEN_KEY); },

  async setUser(user) { await setItem(USER_KEY, JSON.stringify(user)); },
  async getUser() {
    const raw = await getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  async clear() {
    await Promise.all([removeItem(TOKEN_KEY), removeItem(USER_KEY)]);
  },
};

export default secureStore;
