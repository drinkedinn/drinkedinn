// src/screens/taste/TasteScreen.js
// The user's own shelf. Three lists behind one segmented control:
//   • Ratings     — GET /ratings, DELETE /ratings/:id
//   • Collection  — GET /collection, DELETE /collection/:id
//   • Want to try — GET /bucketlist, PATCH /:id/check, DELETE /:id
//
// The framing is discovery, not consumption: this is about the drams you loved
// and the ones you keep meaning to try. Each list has its own empty state,
// pull-to-refresh, and menu-driven delete. All lists load lazily on first
// segment change so we don't wake three endpoints on mount.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Animated } from 'react-native';
import api from '../../api';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import { Screen, Header, Icon, Bounce, EmptyState, FadeIn, useToast } from '../../components/ui';
import Segmented from '../../components/home/Segmented';
import RatingCard from '../../components/taste/RatingCard';
import CollectionRow from '../../components/taste/CollectionRow';
import BucketRow from '../../components/taste/BucketRow';
import TasteSkeleton from '../../components/taste/TasteSkeleton';
import track from '../../lib/track';

const TABS = [
  { key: 'ratings', label: 'Ratings' },
  { key: 'collection', label: 'Collection' },
  { key: 'bucket', label: 'Want to try' },
];

const ENDPOINT = {
  ratings: '/ratings',
  collection: '/collection',
  bucket: '/bucketlist',
};

const ADD_LABEL = {
  ratings: 'Rate a drink',
  collection: 'Add a bottle',
  bucket: 'Add to list',
};

const EMPTY = {
  ratings: {
    icon: 'sparkles-outline',
    title: 'Notes worth keeping',
    body: 'The best pours are the ones you remember. Jot down what caught your nose.',
  },
  collection: {
    icon: 'library-outline',
    title: 'Nothing on your shelf yet',
    body: 'Save the bottles you’ve fallen for — the ones you want to come back to.',
  },
  bucket: {
    icon: 'bookmark-outline',
    title: 'Your list is empty',
    body: 'The dram you keep meaning to try. Add it here so you don’t forget.',
  },
};

export default function TasteScreen({ navigation }) {
  const { t } = useTheme();
  const toast = useToast();

  const [tab, setTab] = useState('ratings');
  const [data, setData] = useState({ ratings: null, collection: null, bucket: null });
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const changeTab = useCallback((next) => {
    if (next === tab) return;
    scrollY.setValue(0);
    setTab(next);
  }, [tab, scrollY]);

  const setList = (key, next) =>
    setData((d) => ({ ...d, [key]: typeof next === 'function' ? next(d[key]) : next }));

  const fetchTab = useCallback(
    async (key, { silent } = {}) => {
      try {
        const res = await api.get(ENDPOINT[key]);
        setList(key, Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (!silent) toast?.show(e?.safeMessage || 'Could not load your shelf.', 'error');
        // Keep whatever we had; if it was null, show it as empty rather than a
        // permanent spinner. Pull-to-refresh gives the user the retry.
        setList(key, (prev) => (prev == null ? [] : prev));
      }
    },
    [toast]
  );

  // Lazy load on first visit to each tab, and always load the initial tab.
  useEffect(() => {
    if (data[tab] === null) fetchTab(tab);
  }, [tab, data, fetchTab]);

  useEffect(() => {
    track('taste_tab_view', { tab });
  }, [tab]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      // Freshen the visible tab on focus; skip the others until visited.
      fetchTab(tab, { silent: true });
    });
    return unsub;
  }, [navigation, tab, fetchTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchTab(tab); } finally { setRefreshing(false); }
  }, [tab, fetchTab]);

  // Delete — optimistic, rolls back on failure.
  const deleteItem = useCallback(
    async (key, item) => {
      const prev = data[key] || [];
      setList(key, prev.filter((x) => x.id !== item.id));
      try {
        await api.delete(`${ENDPOINT[key]}/${item.id}`);
        toast?.show(
          key === 'ratings' ? 'Rating removed.' :
          key === 'collection' ? 'Bottle removed.' :
          'Removed from your list.',
          'success'
        );
        track('taste_item_delete', { tab: key });
      } catch (e) {
        setList(key, prev);
        toast?.show(e?.safeMessage || 'Could not remove that.', 'error');
      }
    },
    [data, toast]
  );

  // Bucket-list check — optimistic, rolls back on failure.
  const toggleChecked = useCallback(
    async (item) => {
      const prev = data.bucket || [];
      const next = prev.map((x) => (x.id === item.id ? { ...x, checked: !x.checked ? 1 : 0 } : x));
      setList('bucket', next);
      try {
        const res = await api.patch(`/bucketlist/${item.id}/check`);
        const server = !!res?.data?.checked;
        setList('bucket', (list) =>
          (list || []).map((x) => (x.id === item.id ? { ...x, checked: server ? 1 : 0 } : x))
        );
        if (server) track('taste_bucket_checked', { id: item.id });
      } catch (e) {
        setList('bucket', prev);
        toast?.show(e?.safeMessage || 'Could not update that.', 'error');
      }
    },
    [data.bucket, toast]
  );

  const openAdd = useCallback(() => {
    if (tab === 'ratings') {
      navigation.navigate('AddRating', {
        onCreated: (created) => setList('ratings', (list) => [created, ...(list || [])]),
      });
    } else {
      navigation.navigate('AddBottle', {
        initialMode: tab === 'bucket' ? 'bucket' : 'collection',
        onCreated: (created, mode) =>
          setList(mode, (list) => [created, ...(list || [])]),
      });
    }
  }, [tab, navigation]);

  const items = data[tab];
  const loading = items === null;

  const headerElevation = scrollY.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: 'clamp' });

  const AddButton = (
    <Bounce
      onPress={openAdd}
      haptic="medium"
      scaleTo={0.9}
      accessibilityLabel={ADD_LABEL[tab]}
      style={[styles.addBtn, { backgroundColor: t.accent }]}
    >
      <Icon name="add" size={22} color={t.textOnAccent} />
    </Bounce>
  );

  const renderItem = ({ item, index }) => {
    if (tab === 'ratings') {
      return (
        <FadeIn index={index}>
          <RatingCard item={item} onDelete={(x) => deleteItem('ratings', x)} />
        </FadeIn>
      );
    }
    if (tab === 'collection') {
      return (
        <FadeIn index={index}>
          <CollectionRow item={item} onDelete={(x) => deleteItem('collection', x)} />
        </FadeIn>
      );
    }
    return (
      <FadeIn index={index}>
        <BucketRow
          item={item}
          onToggle={toggleChecked}
          onDelete={(x) => deleteItem('bucket', x)}
        />
      </FadeIn>
    );
  };

  const listKey = tab; // remount FlatList when the tab changes so item heights recompute cleanly

  const bucketCounts = useMemo(() => {
    if (tab !== 'bucket' || !Array.isArray(items)) return null;
    const tried = items.filter((x) => x.checked).length;
    return { tried, total: items.length };
  }, [tab, items]);

  return (
    <Screen edges={['top']}>
      <Animated.View
        style={{
          backgroundColor: t.bg,
          borderBottomColor: t.divider,
          borderBottomWidth: headerElevation,
        }}
      >
        <Header
          title="Your taste"
          subtitle="A book of the pours you love"
          onBack={() => navigation.goBack()}
          large
          border={false}
          right={AddButton}
        />
        <View style={{ marginTop: 4, marginBottom: 12 }}>
          <Segmented options={TABS} value={tab} onChange={changeTab} />
        </View>
      </Animated.View>

      {loading ? (
        <TasteSkeleton rows={5} />
      ) : (
        <FlatList
          key={listKey}
          data={items || []}
          keyExtractor={(item, i) => String(item?.id ?? `${tab}-${i}`)}
          renderItem={renderItem}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 140 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
              progressBackgroundColor={t.surface}
            />
          }
          ListHeaderComponent={
            bucketCounts && bucketCounts.total > 0 ? (
              <View style={styles.counts}>
                <Text style={[type.caption, { color: t.textMuted }]}>
                  {bucketCounts.tried} of {bucketCounts.total} tried
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={EMPTY[tab].icon}
              title={EMPTY[tab].title}
              body={EMPTY[tab].body}
              actionLabel={ADD_LABEL[tab]}
              onAction={openAdd}
            />
          }
          ListFooterComponent={
            (items?.length || 0) > 0 ? (
              <Text style={[type.caption, { color: t.textMuted, textAlign: 'center', paddingVertical: 24, paddingHorizontal: 32 }]}>
                Kept for you. Only you can see this book.
              </Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counts: {
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
});
