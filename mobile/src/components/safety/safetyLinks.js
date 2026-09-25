// src/components/safety/safetyLinks.js
// Opening the published standards and the safety mailbox.
//
// Guidelines and the child-safety standard open in the in-app browser so the
// member never loses their place in the app. Mail leaves the app, so it goes
// through Linking. Both resolve to a boolean instead of throwing — a device
// with no browser or no mail client is a bad day, not a crash.

import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SAFETY_EMAIL, SAFETY_URLS } from './reportCatalog';

/** Opens a URL in the in-app browser. Returns false if it could not open. */
export async function openWeb(url) {
  if (!url) return false;
  try {
    await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'close' });
    return true;
  } catch {
    // Last resort: hand it to the system browser.
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  }
}

export const openGuidelines = () => openWeb(SAFETY_URLS.guidelines);
export const openChildSafetyStandards = () => openWeb(SAFETY_URLS.childSafety);

/** Opens the member's mail app addressed to the safety team. */
export async function openSafetyMail(subject = 'Safety') {
  const url = `mailto:${SAFETY_EMAIL}?subject=${encodeURIComponent(`DrinkedInn — ${subject}`)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
