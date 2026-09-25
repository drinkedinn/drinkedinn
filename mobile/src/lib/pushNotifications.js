// src/lib/pushNotifications.js
// Native push registration.
//
// Deliberately NOT called on app launch. An unsolicited permission prompt is the
// fastest way to get permanently denied — iOS only asks once, and a "no" is very
// hard to reverse. We ask when the user turns push on, or after they've seen
// enough value to want it.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from '../api';

// Foreground behaviour: show the banner, but don't badge or make noise while
// the person is already looking at the app.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function pushSupported() {
  return Device.isDevice; // simulators can't receive push
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'DrinkedInn',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#C8831F',
  });
}

/** Current OS-level permission state, without prompting. */
export async function getPermissionStatus() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status; // 'granted' | 'denied' | 'undetermined'
  } catch {
    return 'undetermined';
  }
}

/**
 * Ask for permission, obtain a token, and register it with the API.
 * @returns {Promise<{ok: boolean, reason?: string, token?: string}>}
 */
export async function enablePush() {
  if (!pushSupported()) return { ok: false, reason: 'simulator' };

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') return { ok: false, reason: 'denied' };

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    if (!token) return { ok: false, reason: 'no_token' };

    await api.post('/notifications/push/device', { token, platform: Platform.OS });
    return { ok: true, token };
  } catch (e) {
    return { ok: false, reason: e?.message || 'error' };
  }
}

/** Stop receiving push on this device. */
export async function disablePush() {
  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    if (token) await api.delete('/notifications/push/device', { data: { token } });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Route a notification tap to the right screen.
 * Returns an unsubscribe function.
 */
export function attachTapHandler(navigationRef) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data || {};
    const nav = navigationRef?.current;
    if (!nav?.isReady?.()) return;

    try {
      if (data.type === 'comment' || data.type === 'cheer' || data.type === 'repour') {
        if (data.postId) nav.navigate('PostDetail', { post: { id: Number(data.postId) } });
        else nav.navigate('Tabs', { screen: 'Home' });
      } else if (data.type === 'connect' || data.type === 'follow') {
        if (data.actorId) nav.navigate('User', { userId: Number(data.actorId) });
        else nav.navigate('Tabs', { screen: 'Home' });
      } else {
        nav.navigate('Tabs', { screen: 'Home' });
      }
    } catch {
      /* a bad payload must never crash the app on launch */
    }
  });
  return () => sub.remove();
}
