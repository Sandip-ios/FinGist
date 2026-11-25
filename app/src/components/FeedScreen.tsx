import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInfiniteQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchFeed } from '../lib/api';
import type { RegionFilter, Story } from '../lib/types';
import { BRAND, useTheme } from '../theme';
import { AboutSheet } from './AboutSheet';
import { FilterBar } from './FilterBar';
import { NewsCard } from './NewsCard';
import { Pager, type PagerHandle } from './Pager';

const PAGE_SIZE = 30;
const RENDER_WINDOW = 2; // cards rendered on each side of the current one
const HINT_KEY = 'fingist.swipeHintSeen';

export function FeedScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState<RegionFilter>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const pager = useRef<PagerHandle>(null);
  const currentId = useRef<string | null>(null);
  const topSeenId = useRef<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: ['feed', region, category],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) => fetchFeed({ region, category, before: pageParam, limit: PAGE_SIZE, signal }),
    getNextPageParam: (last) => last.nextBefore,
    // Refresh often while summaries are still being written, otherwise every 2 minutes.
    refetchInterval: (q) => (q.state.data?.pages[0]?.items.some((s) => s.summaryStatus === 'pending') ? 45_000 : 120_000),
  });

  const items: Story[] = useMemo(() => {
    const seen = new Set<string>();
    const out: Story[] = [];
    for (const p of query.data?.pages ?? []) for (const s of p.items) if (!seen.has(s.id)) { seen.add(s.id); out.push(s); }
    return out;
  }, [query.data]);

  // Reset to the first card when filters change.
  useEffect(() => {
    setPage(0);
    currentId.current = null;
    topSeenId.current = null;
  }, [region, category]);

  // Remember the newest story the reader has seen, to count "new stories" after a refresh.
  useEffect(() => {
    if (items[0] && (topSeenId.current === null || page === 0)) topSeenId.current = items[0].id;
  }, [items, page]);

  // When new stories arrive at the top, keep the reader on the card they were reading.
  useEffect(() => {
    if (!currentId.current) return;
    const idx = items.findIndex((s) => s.id === currentId.current);
    if (idx >= 0 && idx !== page) {
      pager.current?.setPageWithoutAnimation(idx);
      setPage(idx);
    }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    AsyncStorage.getItem(HINT_KEY).then((v) => { if (!v) setShowHint(true); }).catch(() => {});
  }, []);

  const newCount = topSeenId.current ? Math.max(0, items.findIndex((s) => s.id === topSeenId.current)) : 0;

  const onPageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const pos = e.nativeEvent.position;
      setPage(pos);
      currentId.current = items[pos]?.id ?? null;
      Haptics.selectionAsync().catch(() => {});
      if (showHint && pos > 0) {
        setShowHint(false);
        AsyncStorage.setItem(HINT_KEY, '1').catch(() => {});
      }
      if (pos >= items.length - 5 && query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
    [items, query, showHint],
  );

  const goTop = () => {
    pager.current?.setPage(0);
    setPage(0);
    currentId.current = items[0]?.id ?? null;
  };

  const refresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    query.refetch().then(() => goTop());
  };

  return (
    <View style={[s.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={[s.logo, { color: t.isDark ? '#fff' : BRAND.navy }]}>
          Fin<Text style={{ color: t.isDark ? BRAND.lime : '#5fa80f' }}>Gist</Text>
        </Text>
        <View style={s.headerIcons}>
          <Pressable onPress={refresh} hitSlop={10} accessibilityLabel="Refresh">
            {query.isRefetching ? <ActivityIndicator color={t.textMuted} /> : <Ionicons name="refresh" size={24} color={t.text} />}
          </Pressable>
          <Pressable onPress={() => setAboutOpen(true)} hitSlop={10} accessibilityLabel="About FinGist">
            <Ionicons name="information-circle-outline" size={26} color={t.text} />
          </Pressable>
        </View>
      </View>

      <FilterBar region={region} category={category} onRegion={setRegion} onCategory={setCategory} />

      {query.isError && items.length > 0 && (
        <View style={[s.offline, { backgroundColor: t.tabIdle }]}>
          <Ionicons name="cloud-offline-outline" size={14} color={t.textMuted} />
          <Text style={[s.offlineText, { color: t.textMuted }]}>Offline · showing saved stories</Text>
        </View>
      )}

      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {query.isPending ? (
          <Centered><ActivityIndicator size="large" color={t.isDark ? BRAND.lime : BRAND.navy} /><Text style={[s.msg, { color: t.textMuted }]}>Loading the latest market news…</Text></Centered>
        ) : query.isError && items.length === 0 ? (
          <Centered>
            <Ionicons name="cloud-offline-outline" size={48} color={t.textMuted} />
            <Text style={[s.msg, { color: t.text }]}>Couldn't load news</Text>
            <Text style={[s.sub, { color: t.textMuted }]}>Check your internet connection and try again.</Text>
            <Pressable style={s.btn} onPress={() => query.refetch()}><Text style={s.btnText}>Try again</Text></Pressable>
          </Centered>
        ) : items.length === 0 ? (
          <Centered>
            <Ionicons name="newspaper-outline" size={48} color={t.textMuted} />
            <Text style={[s.msg, { color: t.text }]}>No stories here yet</Text>
            <Text style={[s.sub, { color: t.textMuted }]}>Try another filter, or check back in a few minutes.</Text>
          </Centered>
        ) : (
          <Pager key={`${region}-${category ?? 'all'}`} ref={pager} onPageSelected={onPageSelected}>
            {items.map((story, i) => (
              <View key={story.id} collapsable={false} style={{ flex: 1 }}>
                {Math.abs(i - page) <= RENDER_WINDOW ? <NewsCard story={story} index={i} total={items.length} /> : null}
              </View>
            ))}
            <View key="__end" collapsable={false} style={{ flex: 1 }}>
              <Centered>
                {query.isFetchingNextPage || query.hasNextPage ? (
                  <ActivityIndicator size="large" color={t.isDark ? BRAND.lime : BRAND.navy} />
                ) : (
                  <>
                    <Ionicons name="checkmark-done-circle" size={56} color={BRAND.lime} />
                    <Text style={[s.msg, { color: t.text }]}>You're all caught up!</Text>
                    <Text style={[s.sub, { color: t.textMuted }]}>New stories arrive every few minutes.</Text>
                    <Pressable style={s.btn} onPress={refresh}><Text style={s.btnText}>Back to latest</Text></Pressable>
                  </>
                )}
              </Centered>
            </View>
          </Pager>
        )}

        {newCount > 0 && page > 0 && (
          <Pressable style={[s.newPill, { top: 8 }]} onPress={goTop}>
            <Ionicons name="arrow-up" size={14} color="#fff" />
            <Text style={s.newPillText}>{newCount} new {newCount === 1 ? 'story' : 'stories'}</Text>
          </Pressable>
        )}

        {showHint && items.length > 1 && page === 0 && (
          <View pointerEvents="none" style={[s.hint, { bottom: insets.bottom - 6 }]}>
            <Ionicons name="chevron-up" size={18} color="#fff" />
            <Text style={s.hintText}>Swipe up for the next story</Text>
          </View>
        )}
      </View>

      <AboutSheet visible={aboutOpen} onClose={() => setAboutOpen(false)} />
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={s.centered}>{children}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  logo: { fontSize: 28, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5 },
  headerIcons: { flexDirection: 'row', gap: 18, alignItems: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  msg: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  sub: { fontSize: 14, textAlign: 'center' },
  btn: { marginTop: 14, backgroundColor: BRAND.navy, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
  offline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 14, borderRadius: 10, paddingVertical: 5 },
  offlineText: { fontSize: 12, fontWeight: '600' },
  newPill: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BRAND.navy, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  newPillText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  hint: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(1,32,142,0.92)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18 },
  hintText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
});
