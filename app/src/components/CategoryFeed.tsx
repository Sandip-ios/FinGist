import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { fetchFeed } from '../lib/api';
import type { RegionFilter, Story } from '../lib/types';
import { BRAND, useTheme } from '../theme';
import { NewsCard } from './NewsCard';

const PAGE_SIZE = 30;

/** One category's stories as full-height cards that snap one at a time; pull down on the first card to refresh. */
export function CategoryFeed({ region, category, onFirstSwipe }: { region: RegionFilter; category: string | null; onFirstSwipe?: () => void }) {
  const t = useTheme();
  const [h, setH] = useState(0);
  const [index, setIndex] = useState(0);
  const [pulling, setPulling] = useState(false);
  const list = useRef<FlatList<Story>>(null);
  const topSeenId = useRef<string | null>(null);

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
  const newCount = topSeenId.current ? Math.max(0, items.findIndex((s) => s.id === topSeenId.current)) : 0;

  const goTop = useCallback(() => {
    list.current?.scrollToOffset({ offset: 0, animated: true });
    setIndex(0);
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
    const i = Math.round(e.nativeEvent.contentOffset.y / h);
    if (i !== index) {
      setIndex(i);
      Haptics.selectionAsync().catch(() => {});
      if (i > 0) onFirstSwipe?.();
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
    <View style={{ flex: 1 }} onLayout={(e) => setH(Math.round(e.nativeEvent.layout.height))}>
      {query.isError && (
        <View style={[s.offline, { backgroundColor: t.tabIdle }]}>
          <Ionicons name="cloud-offline-outline" size={14} color={t.textMuted} />
          <Text style={[s.offlineText, { color: t.textMuted }]}>Offline · showing saved stories</Text>
        </View>
      )}
      {h > 0 && (
        <FlatList
          ref={list}
          data={items}
          keyExtractor={(s) => s.id}
          renderItem={({ item, index: i }) => (
            <View style={{ height: h }}>
              <NewsCard story={item} index={i} total={items.length} showCategory={category === null} />
            </View>
          )}
          getItemLayout={(_, i) => ({ length: h, offset: h * i, index: i })}
          snapToInterval={h}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={onSettled}
          onScrollEndDrag={(e) => { if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.05) onSettled(e); }}
          // Keep the reader on the same story when new ones arrive at the top.
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={t.isDark ? BRAND.lime : BRAND.navy} colors={[BRAND.navy]} />}
          onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage(); }}
          onEndReachedThreshold={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={5}
          ListEmptyComponent={
            <View style={{ height: h }}>
              <Centered>
                <Ionicons name="newspaper-outline" size={48} color={t.textMuted} />
                <Text style={[s.msg, { color: t.text }]}>No stories here yet</Text>
                <Text style={[s.sub, { color: t.textMuted }]}>Pull down to refresh, or check back in a few minutes.</Text>
              </Centered>
            </View>
          }
          ListFooterComponent={
            items.length > 0 ? (
              <View style={{ height: h }}>
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
          <Text style={s.newPillText}>{newCount} new {newCount === 1 ? 'story' : 'stories'}</Text>
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
