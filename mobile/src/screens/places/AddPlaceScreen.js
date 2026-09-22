// src/screens/places/AddPlaceScreen.js — modal, search-first.
//
// Most "add a place" taps are really "find a place": the venue already exists
// and typing its name is the fastest route to it. So the modal opens on a
// search field against GET /places?q= and only offers the create form once the
// person has looked and not found it.
//
// Route params:
//   initialQuery?: string            — prefills the search box
//   onPicked?: (place) => void       — called with the chosen or created row
//
// `onPicked` is a function param, which React Navigation warns about for state
// persistence. That is the interface the composer needs (it has to receive the
// place it asked for), and this modal is never a deep-link target, so the
// trade-off is deliberate. The alternative — a shared context — would be more
// machinery than one callback is worth.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Icon, Bounce, EmptyState, FadeIn, useToast } from '../../components/ui';
import { PlaceRow, PlaceSearchBar, PlaceRowSkeleton } from '../../components/places';
import { placeSubtitle } from '../../components/places/placeUtils';
import usePlaceSearch from './usePlaceSearch';
import useNearbyLocation from './useNearbyLocation';
import NewPlaceForm from './NewPlaceForm';
import { track } from '../../lib/track';
import { press } from '../../ui/haptics';

export default function AddPlaceScreen({ navigation, route }) {
  const { t } = useTheme();
  const toast = useToast();

  const onPicked = route?.params?.onPicked;
  const initialQuery = route?.params?.initialQuery || '';

  const [mode, setMode] = useState('search'); // 'search' | 'create'
  const [submitting, setSubmitting] = useState(false);

  const search = usePlaceSearch({ minChars: 1 });
  const location = useNearbyLocation();

  const formDirty = useRef(false);
  const handedBack = useRef(false);

  // Prefill from the caller (e.g. "nothing matches 'oporto' — add it").
  useEffect(() => {
    if (initialQuery) search.setQuery(initialQuery);
  }, [initialQuery, search.setQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // A stable identity: NewPlaceForm reports dirtiness from an effect, so a new
  // function each render would re-run it on every keystroke.
  const noteDirty = useCallback((v) => {
    formDirty.current = v;
  }, []);

  /**
   * Hand a place back to whoever opened this modal.
   * The modal is popped BEFORE the callback runs: callers typically navigate
   * onward, and dispatching that while this screen is still the top of the
   * stack pushes the next screen on top of a dismissing modal.
   */
  const handBack = useCallback(
    (place) => {
      if (!place?.id || handedBack.current) return;
      handedBack.current = true;
      Keyboard.dismiss();
      navigation.goBack();
      try {
        onPicked?.(place);
      } catch {
        /* a caller's own navigation failing must not take this modal with it */
      }
    },
    [navigation, onPicked]
  );

  const pick = useCallback(
    (place) => {
      track('place_picked', { id: place?.id, from: 'search' });
      handBack(place);
    },
    [handBack]
  );

  // Two-button Alerts only. Android's dialog drops anything past the third
  // button, so multi-choice always goes through showReportSheet elsewhere in
  // this module; a confirm is safe on both platforms.
  const confirmDiscard = useCallback((onDiscard) => {
    Alert.alert('Discard this place?', 'What you typed won’t be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onDiscard },
    ]);
  }, []);

  const close = useCallback(() => {
    Keyboard.dismiss();
    if (mode !== 'create' || !formDirty.current) {
      navigation.goBack();
      return;
    }
    confirmDiscard(() => navigation.goBack());
  }, [mode, navigation, confirmDiscard]);

  // Leaving the form for the search list unmounts it, which throws the typed
  // fields away just as surely as closing the modal does.
  const leaveCreate = useCallback(() => {
    Keyboard.dismiss();
    if (!formDirty.current) {
      setMode('search');
      return;
    }
    confirmDiscard(() => {
      formDirty.current = false;
      setMode('search');
    });
  }, [confirmDiscard]);

  const openCreate = useCallback(() => {
    Keyboard.dismiss();
    track('place_create_open');
    setMode('create');
  }, []);

  const createPlace = useCallback(
    async (payload) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const res = await api.post('/places', payload);
        const created = res.data;
        press();
        track('place_created', { has_coords: payload.lat != null });
        toast?.show('Place added. Good find.', 'success');
        formDirty.current = false;
        if (created?.id) {
          handBack(created);
        } else {
          navigation.goBack();
        }
        // Deliberately not clearing `submitting` on success — the screen is on
        // its way out and setting state on an unmounted screen is noise.
      } catch (e) {
        toast?.show(e?.safeMessage || 'Could not add that place.', 'error');
        setSubmitting(false);
      }
    },
    [submitting, toast, handBack, navigation]
  );

  const creating = mode === 'create';
  const showSkeleton = search.active && search.loading && search.results.length === 0;

  return (
    <Screen edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.divider }]}>
        <Bounce
          onPress={creating ? leaveCreate : close}
          haptic="light"
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityLabel={creating ? 'Back to search' : 'Close'}
        >
          <Icon name={creating ? 'chevron-back' : 'close'} size={creating ? 26 : 24} color={t.text} />
        </Bounce>
        <View style={{ flex: 1 }}>
          <Text style={[type.h2, { color: t.text }]} numberOfLines={1}>
            {creating ? 'New place' : 'Add place'}
          </Text>
        </View>
        {!creating && (
          <Bounce
            onPress={openCreate}
            haptic="light"
            hitSlop={10}
            accessibilityLabel="Add a place that isn't listed"
          >
            <Text style={[type.label, { color: t.accent }]}>New</Text>
          </Bounce>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {creating ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingBottom: 48 }}
          >
            <NewPlaceForm
              initialName={search.query.trim()}
              submitting={submitting}
              onSubmit={createPlace}
              onDirtyChange={noteDirty}
              location={location}
            />
          </ScrollView>
        ) : (
          <>
            <PlaceSearchBar
              value={search.query}
              onChangeText={search.setQuery}
              loading={search.loading && search.active}
              placeholder="Search for a place"
              autoFocus={!initialQuery}
              style={{ marginTop: 12, marginBottom: 12 }}
            />

            {showSkeleton ? (
              <View>
                {[0, 1, 2, 3].map((i) => (
                  <PlaceRowSkeleton key={i} />
                ))}
              </View>
            ) : (
              <FlatList
                data={search.results}
                keyExtractor={(item, index) => `place-${item?.id ?? index}`}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                renderItem={({ item, index }) => (
                  <FadeIn index={index}>
                    <PlaceRow
                      place={item}
                      onPress={pick}
                      chips={item?.saved ? [{ icon: 'bookmark', label: 'Saved', tone: 'accent' }] : []}
                      trailing={<Icon name="add-circle-outline" size={20} color={t.accent} />}
                      accessibilityHint={`Tags your moment at ${placeSubtitle(item) || item?.name || 'this place'}`}
                    />
                  </FadeIn>
                )}
                ListFooterComponent={
                  search.results.length > 0 ? (
                    <Bounce
                      onPress={openCreate}
                      haptic="light"
                      scaleTo={0.99}
                      accessibilityLabel="Add a new place instead"
                    >
                      <View style={[styles.newRow, { borderColor: t.border }]}>
                        <Icon name="add-circle-outline" size={18} color={t.accent} />
                        <Text style={[type.label, { color: t.accent }]}>Add a new place</Text>
                      </View>
                    </Bounce>
                  ) : null
                }
                contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
                ListEmptyComponent={
                  search.error ? (
                    <EmptyState
                      icon="cloud-offline-outline"
                      title="Can't reach the bar"
                      body={search.error}
                      actionLabel="Try again"
                      onAction={search.reload}
                    />
                  ) : search.active ? (
                    <EmptyState
                      icon="location-outline"
                      title={`Nothing called “${search.term}”`}
                      body="It isn't on DrinkedInn yet. Add it and everyone can tag their moments there."
                      actionLabel="Add a new place"
                      onAction={openCreate}
                    />
                  ) : (
                    <EmptyState
                      icon="search-outline"
                      title="Where was it?"
                      body="Search for the bar, café or rooftop you're thinking of — or add one that's missing."
                      actionLabel="Add a new place"
                      onAction={openCreate}
                    />
                  )
                }
              />
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    minHeight: 46,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { marginLeft: -6, padding: 4 },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
