// src/components/ErrorBoundary.js
// Catches render errors, which React otherwise turns into a blank white screen
// with no explanation — the single worst failure mode a mobile app has.
//
// A class component because React only exposes componentDidCatch here; there is
// no hook equivalent.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { reportError } from '../lib/errorReporting';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportError(error, { route: this.props.name || 'render' });
    // componentStack points at the component that broke — worth having.
    if (info?.componentStack) {
      reportError(
        { message: `Render failed in ${this.props.name || 'app'}`, stack: info.componentStack },
        { route: 'componentStack' }
      );
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    // Deliberately theme-free: the theme provider may be what crashed.
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          That's on us, not you. We've been told about it. Try again — and if it keeps
          happening, reopening the app usually clears it.
        </Text>
        <Pressable style={styles.button} onPress={() => this.setState({ hasError: false })}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FBF8F2' },
  title: { fontSize: 20, fontWeight: '700', color: '#1E1913', marginBottom: 10, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, color: '#5D5343', textAlign: 'center', marginBottom: 24, maxWidth: 320 },
  button: { backgroundColor: '#C8831F', borderRadius: 14, paddingHorizontal: 26, paddingVertical: 13 },
  buttonText: { color: '#2A1B05', fontWeight: '600', fontSize: 15 },
});
