// src/components/onboarding-v2/CountryPicker.js
// A field that opens a searchable, full-height country list.
//
// A modal list rather than a native picker: the app has no picker dependency,
// and a ~190-row wheel is unusable on Android anyway. Search is a plain
// case-insensitive prefix/substring match — no fuzzy library needed.

import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, Modal, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon } from '../ui';
import { COUNTRIES, countryByCode } from '../../screens/onboarding-v2/countries';

export default function CountryPicker({ value, onChange, label = 'Country or region' }) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = countryByCode(value);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    // Names that start with the query come first — typing "ind" should land on
    // India before Indonesia, and never behind "British Indian Ocean".
    const starts = [];
    const contains = [];
    for (const c of COUNTRIES) {
      if (c.search.startsWith(q)) starts.push(c);
      else if (c.search.includes(q) || c.code.toLowerCase() === q) contains.push(c);
    }
    return [...starts, ...contains];
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const choose = useCallback(
    (code) => {
      onChange?.(code);
      close();
    },
    [onChange, close]
  );

  return (
    <View>
      <Text style={[type.caption, { color: t.textMuted, marginBottom: 6, marginLeft: 4 }]}>{label}</Text>

      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: pressed ? t.surfacePress : t.surface,
            borderColor: t.border,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={selected ? `Country: ${selected.name}. Change it.` : 'Choose your country or region'}
      >
        <Icon name="earth-outline" size={18} color={selected ? t.accent : t.textMuted} />
        <Text
          style={[type.body, { color: selected ? t.text : t.textMuted, flex: 1 }]}
          numberOfLines={1}
        >
          {selected ? selected.name : 'Choose a country'}
        </Text>
        {!!selected && (
          <View style={[styles.code, { backgroundColor: t.surfaceAlt }]}>
            <Text style={[type.caption, { color: t.textSecondary }]}>{selected.code}</Text>
          </View>
        )}
        <Icon name="chevron-down" size={17} color={t.textMuted} />
      </Pressable>

      {/* A plain full-screen modal rather than a pageSheet: pageSheet is iOS-only
          and its swipe-to-dismiss does not reliably report back on every RN
          version, which would strand `open` at true. */}
      <Modal visible={open} animationType="slide" onRequestClose={close} onDismiss={close}>
        <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'bottom']}>
          <View style={[styles.sheetHead, { borderBottomColor: t.divider }]}>
            <Text style={[type.h2, { color: t.text, flex: 1 }]}>Where's home?</Text>
            <Pressable onPress={close} hitSlop={14} accessibilityRole="button" accessibilityLabel="Close country list">
              <Icon name="close" size={24} color={t.text} />
            </Pressable>
          </View>

          <View style={[styles.search, { backgroundColor: t.surfaceAlt }]}>
            <Icon name="search-outline" size={17} color={t.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search countries"
              placeholderTextColor={t.textMuted}
              style={[type.body, { color: t.text, flex: 1, paddingVertical: 0 }]}
              autoCorrect={false}
              autoCapitalize="none"
              selectionColor={t.accent}
              accessibilityLabel="Search countries"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
                <Icon name="close-circle" size={17} color={t.textMuted} />
              </Pressable>
            )}
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={18}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              <Text style={[type.body, { color: t.textMuted, textAlign: 'center', paddingTop: 48 }]}>
                No match for "{query.trim()}".
              </Text>
            }
            renderItem={({ item }) => {
              const active = item.code === value;
              return (
                <Pressable
                  onPress={() => choose(item.code)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderBottomColor: t.divider, backgroundColor: pressed ? t.surfacePress : 'transparent' },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={item.name}
                >
                  <Text style={[type.body, { color: active ? t.accentText : t.text, flex: 1 }]}>
                    {item.name}
                  </Text>
                  {active ? (
                    <Icon name="checkmark-circle" size={20} color={t.accent} />
                  ) : (
                    <Text style={[type.caption, { color: t.textMuted }]}>{item.code}</Text>
                  )}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  code: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.xs },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
