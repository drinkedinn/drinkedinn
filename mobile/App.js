// App.js — DrinkedInn mobile
import React, { useRef, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { attachTapHandler } from './src/lib/pushNotifications';
import { initAnalytics } from './src/lib/track';
import { installGlobalHandler } from './src/lib/errorReporting';
import ErrorBoundary from './src/components/ErrorBoundary';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { ToastProvider } from './src/components/ui/Toast';
import { ReportSheetProvider } from './src/lib/reportSheet';
import CreateSheetProvider from './src/components/composer/CreateSheet';
import RootNavigator from './src/navigation/RootNavigator';

function Shell() {
  const { t, mode } = useTheme();
  const navigationRef = useRef(null);
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;

  // Route notification taps to the post or profile they refer to.
  useEffect(() => attachTapHandler(navigationRef), []);

  // Batched, first-party product analytics.
  useEffect(() => initAnalytics(), []);

  // Catch errors thrown outside React's render cycle.
  useEffect(() => installGlobalHandler(), []);
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: t.bg,
      card: t.surface,
      text: t.text,
      primary: t.accent,
      border: t.border,
      notification: t.accent,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <StatusBar style={t.statusBar} />
      <ToastProvider>
        <ReportSheetProvider>
          <CreateSheetProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </CreateSheetProvider>
        </ReportSheetProvider>
      </ToastProvider>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary name="app">
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
