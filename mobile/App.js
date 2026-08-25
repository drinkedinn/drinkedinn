// App.js — DrinkedInn mobile
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { ToastProvider } from './src/components/ui/Toast';
import RootNavigator from './src/navigation/RootNavigator';

function Shell() {
  const { t, mode } = useTheme();
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
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
    <NavigationContainer theme={navTheme}>
      <StatusBar style={t.statusBar} />
      <ToastProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ToastProvider>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
