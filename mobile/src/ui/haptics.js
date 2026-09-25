// src/ui/haptics.js — safe wrappers (no-op if the module/platform can't vibrate)
import * as Haptics from 'expo-haptics';

export const tap = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} };
export const press = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {} };
export const pop = () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {} };
export const warn = () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {} };
