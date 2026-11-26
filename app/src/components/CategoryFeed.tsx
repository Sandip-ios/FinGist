import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { fetchFeed } from '../lib/api';
import { useTour } from '../lib/tour';
import type { RegionFilter, Story } from '../lib/types';
import { BRAND, useTheme } from '../theme';
import { NewsCard } from './NewsCard';
import { StackedCard } from './StackedCard';

const PAGE_SIZE = 30;

/** One category's stories as full-height cards that snap one at a time; pull down on the first card to refresh. */
export function CategoryFeed({ region, category }: { region: RegionFilter; category: string | null }) {
  const t = useTheme();
  const [h, setH] = useState(0);
  const [index, setIndex] = useState(0);
  const [pulling, setPulling] = useState(false);
  const list = useRef<FlatList<Story>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const tour = useTour();
  const topSeenId = useRef<string | null>(null);
  const currentId = useRef<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: ['feed', region, category],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) => fetchFeed({ region, category, before: pageParam, limit: PAGE_SIZE, signal }),
    getNextPageParam: (last) => last.nextBefore,
    refetchInterval: 120_000,
  });

  const items: Story[] = useMemo(() => {
    const seen = new Set<string>();
    const out: Story[] = [];
    for (const p of query.data?.pages ?? []) for (const s of p.items) if (!seen.has(s.id)) { seen.add(s.id); out.push(s); }
    return out;
  }, [query.data]);

  // Newest story the reader has seen; anything above it after a refresh counts as "new".
  useEffect(() => {
    if (items[0] && (topSeenId.current === null || index === 0)) topSeenId.current = items[0].id;
  }, [items, index]);
  // Keep the reader on the story they were reading when the list changes (refresh, new stories).
  // If that story is gone, go back to the newest one, so the screen is never left on an empty spot.
  useEffect(() => {
    if (!h || items.length === 0) return;
    const id = currentId.current;
    const idx = id ? items.findIndex((x) => x.id === id) : 0;
    const target = idx >= 0 ? idx : 0;
    if (target !== index || idx < 0) {
      list.current?.scrollToOffset({ offset: target * h, animated: false });
      setIndex(target);
      currentId.current = items[target]?.id ?? null;
    }
  }, [items, h]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start the first-launch tour once Top stories has a card on screen.
  useEffect(() => {
    if (category === null && h > 0 && items.length > 0) tour.startIfFirstTime();
  }, [category, h, items.length, tour]);

  const newCount = topSeenId.current ? Math.max(0, items.findIndex((s) => s.id === topSeenId.current)) : 0;

  const goTop = useCallback(() => {
    list.current?.scrollToOffset({ offset: 0, animated: true });
    setIndex(0);
    currentId.current = items[0]?.id ?? null;
    if (items[0]) topSeenId.current = items[0].id;
  }, [items]);

  const onRefresh = useCallback(async () => {
    setPulling(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await query.refetch().catch(() => {});
    setPulling(false);
    goTop();
  }, [query, goTop]);

  const onSettled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!h) return;
    const i = Math.max(0, Math.min(items.length, Math.round(e.nativeEvent.contentOffset.y / h)));
    currentId.current = items[i]?.id ?? currentId.current;
    if (i !== index) {
      setIndex(i);
      Haptics.selectionAsync().catch(() => {});
    }
  };

  if (query.isPending) {
    return <Centered><ActivityIndicator size="large" color={t.isDark ? BRAND.lime : BRAND.navy} /><Text style={[s.msg, { color: t.textMuted }]}>Loading the latest market news…</Text></Centered>;
  }
  if (query.isError && items.length === 0) {
    return (
      <Centered>
        <Ionicons name="cloud-offline-outline" size={48} color={t.textMuted} />
        <Text style={[s.msg, { color: t.text }]}>Couldn't load news</Text>
        <Text style={[s.sub, { color: t.textMuted }]}>Check your internet connection and try again.</Text>
        <Pressable style={s.btn} onPress={() => query.refetch()}><Text style={s.btnText}>Try again</Text></Pressable>
      </Centered>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={(e) => { const v = Math.round(e.nativeEvent.layout.height); if (v > 0) setH(v); }}>
      {query.isError && (
        <View style={[s.offline, { backgroundColor: t.tabIdle }]}>
          <Ionicons name="cloud-offline-outline" size={14} color={t.textMuted} />
          <Text style={[s.offlineText, { color: t.textMuted }]}>Offline · showing saved stories</Text>
        </View>
      )}
      {h === 0 && (
        <Centered><ActivityIndicator color={t.isDark ? BRAND.lime : BRAND.navy} /></Centered>
      )}
      {h > 0 && (
        <Animated.FlatList
          ref={list as unknown as React.Ref<FlatList<Story>>}
          data={items}
          keyExtractor={(s: Story) => s.id}
          renderItem={({ item, index: i }: { item: Story; index: number }) => (
            <StackedCard index={i} height={h} scrollY={scrollY} last={i === items.length - 1}>
              <NewsCard story={item} showCategory={category === null} tourAnchor={category === null && i === 0} />
            </StackedCard>
          )}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: Platform.OS !== 'web' })}
          scrollEventThrottle={16}
          removeClippedSubviews={false}
          getItemLayout={(_: unknown, i: number) => ({ length: h, offset: h * i, index: i })}
          snapToInterval={h}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={onSettled}
          onScrollEndDrag={(e) => { if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.05) onSettled(e); }}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={t.isDark ? BRAND.lime : BRAND.navy} colors={[BRAND.navy]} />}
          onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage(); }}
          onEndReachedThreshold={3}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
          ListEmptyComponent={
            <View style={{ height: h, backgroundColor: t.bg }}>
              <Centered>
                <Ionicons name="newspaper-outline" size={48} color={t.textMuted} />
                <Text style={[s.msg, { color: t.text }]}>No stories here yet</Text>
                <Text style={[s.sub, { color: t.textMuted }]}>Pull down to refresh, or check back in a few minutes.</Text>
              </Centered>
            </View>
          }
          ListFooterComponent={
            items.length > 0 ? (
              <View style={{ height: h, backgroundColor: t.bg }}>
                <Centered>
                  {query.hasNextPage || query.isFetchingNextPage ? (
                    <ActivityIndicator size="large" color={t.isDark ? BRAND.lime : BRAND.navy} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done-circle" size={56} color={BRAND.lime} />
                      <Text style={[s.msg, { color: t.text }]}>You're all caught up!</Text>
                      <Text style={[s.sub, { color: t.textMuted }]}>New stories arrive every few minutes.</Text>
                      <Pressable style={s.btn} onPress={goTop}><Text style={s.btnText}>Back to latest</Text></Pressable>
                    </>
                  )}
                </Centered>
              </View>
            ) : undefined
          }
        />
      )}
      {newCount > 0 && index > 0 && (
        <Pressable style={s.newPill} onPress={goTop}>
          <Ionicons name="arrow-up" size={14} color="#fff" />
          <Text style={s.newPillText}>{newCount} new news</Text>
        </Pressable>
      )}
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={s.centered}>{children}</View>;
}

const s = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  msg: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  sub: { fontSize: 14, textAlign: 'center' },
  btn: { marginTop: 14, backgroundColor: BRAND.navy, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
  offline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 14, borderRadius: 10, paddingVertical: 5 },
  offlineText: { fontSize: 12, fontWeight: '600' },
  newPill: { position: 'absolute', top: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BRAND.navy, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  newPillText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
