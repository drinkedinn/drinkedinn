// src/screens/places/NewPlaceForm.js
// The "this isn't on DrinkedInn yet" form inside Add place.
//
// Fields map 1:1 onto POST /api/places, which accepts
// { name, category?, city?, country?, lat?, lng?, cover_url? } and silently
// drops a country that is not a two-letter ISO code — so that rule is enforced
// here, where it can be explained, instead of failing quietly on the server.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Icon, Bounce, Button } from '../../components/ui';
import { countryFlag, countryName } from '../../components/places/placeUtils';

export const LIMITS = { name: 100, category: 40, city: 60 };

function Field({
  icon,
  label,
  required,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  maxLength,
  autoCapitalize = 'sentences',
  autoFocus,
  accessibilityLabel,
}) {
  const { t } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.labelRow}>
        <Icon name={icon} size={13} color={t.textMuted} />
        <Text style={[type.overline, { color: t.textMuted, textTransform: 'uppercase' }]}>
          {label}
          {required ? ' *' : ''}
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel || label}
        style={[
          styles.input,
          {
            backgroundColor: t.surface,
            borderColor: error ? t.danger : t.border,
            color: t.text,
          },
        ]}
      />
      {!!error && (
        <Text style={[type.caption, { color: t.danger, marginTop: 6 }]}>{error}</Text>
      )}
      {!error && !!hint && (
        <Text style={[type.caption, { color: t.textMuted, marginTop: 6 }]}>{hint}</Text>
      )}
    </View>
  );
}

export default function NewPlaceForm({
  initialName = '',
  submitting,
  onSubmit,
  onDirtyChange,
  location,
}) {
  const { t } = useTheme();

  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [coords, setCoords] = useState(null);
  const [errors, setErrors] = useState({});
  const [fixing, setFixing] = useState(false);

  const dirty =
    !!name.trim() || !!category.trim() || !!city.trim() || !!country.trim() || !!coords;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const code = country.trim().toUpperCase();
  const countryValid = !code || /^[A-Z]{2}$/.test(code);
  const countryHint = useMemo(() => {
    if (!countryValid) return null;
    const resolved = countryName(code);
    if (!resolved || resolved === code) return 'Two-letter country code, like PT or JP.';
    return [countryFlag(code), resolved].filter(Boolean).join(' ');
  }, [code, countryValid]);

  const useMyLocation = useCallback(async () => {
    if (!location?.supported || fixing) return;
    setFixing(true);
    try {
      const fix = await location.request();
      if (fix) setCoords(fix);
    } finally {
      setFixing(false);
    }
  }, [location, fixing]);

  const submit = useCallback(() => {
    const trimmed = name.trim();
    const next = {};
    if (!trimmed) next.name = 'A place needs a name.';
    if (!countryValid) next.country = 'Use a two-letter country code, like PT.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = {
      name: trimmed.slice(0, LIMITS.name),
      category: category.trim().slice(0, LIMITS.category),
      city: city.trim().slice(0, LIMITS.city),
      country: countryValid ? code : '',
    };
    if (coords) {
      payload.lat = coords.lat;
      payload.lng = coords.lng;
    }
    onSubmit?.(payload);
  }, [name, category, city, code, countryValid, coords, onSubmit]);

  return (
    <View style={styles.wrap}>
      <Text style={[type.body, { color: t.textSecondary, lineHeight: 21, marginBottom: 20 }]}>
        Add it once and everyone can tag their moments here.
      </Text>

      <Field
        icon="business-outline"
        label="Name"
        required
        value={name}
        onChangeText={(v) => {
          setName(v);
          if (errors.name) setErrors((e) => ({ ...e, name: null }));
        }}
        placeholder="What's it called?"
        maxLength={LIMITS.name}
        autoCapitalize="words"
        autoFocus={!initialName}
        error={errors.name}
      />

      <Field
        icon="pricetag-outline"
        label="Category"
        value={category}
        onChangeText={setCategory}
        placeholder="Wine bar, café, rooftop…"
        maxLength={LIMITS.category}
        autoCapitalize="sentences"
      />

      <Field
        icon="map-outline"
        label="City"
        value={city}
        onChangeText={setCity}
        placeholder="Lisbon"
        maxLength={LIMITS.city}
        autoCapitalize="words"
      />

      <Field
        icon="earth-outline"
        label="Country"
        value={country}
        onChangeText={(v) => {
          setCountry(v.toUpperCase());
          if (errors.country) setErrors((e) => ({ ...e, country: null }));
        }}
        placeholder="PT"
        maxLength={2}
        autoCapitalize="characters"
        error={errors.country}
        hint={countryHint}
        accessibilityLabel="Two letter country code"
      />

      {/* Coordinates are optional and only offered when the build can take a
          fix — an always-disabled button would be noise. */}
      {!!location?.supported && (
        <Bounce
          onPress={coords ? () => setCoords(null) : useMyLocation}
          haptic="light"
          scaleTo={0.99}
          disabled={fixing}
          accessibilityLabel={coords ? 'Remove coordinates' : 'Use my current location'}
        >
          <View style={[styles.locationRow, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Icon
              name={coords ? 'checkmark-circle' : 'navigate-outline'}
              size={18}
              color={coords ? t.success : t.accent}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[type.bodyStrong, { color: t.text }]}>
                {coords ? 'Coordinates added' : fixing ? 'Finding you…' : 'Use my current location'}
              </Text>
              <Text style={[type.caption, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
                {coords
                  ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                  : 'Helps other people find it in Nearby'}
              </Text>
            </View>
            {!!coords && <Icon name="close" size={16} color={t.textMuted} />}
          </View>
        </Bounce>
      )}

      <View style={{ marginTop: 24 }}>
        <Button
          label="Add this place"
          icon="add"
          onPress={submit}
          loading={submitting}
          disabled={submitting || !name.trim()}
          full
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
