import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchTrending, searchStories } from '../lib/api';
import { useRecentSearches } from '../lib/recentSearches';
import { timeAgo } from '../lib/time';
import type { Story } from '../lib/types';
import { BRAND, categoryMeta, useTheme, type Theme } from '../theme';
import { TABS } from './FilterBar';
import { StoryViewer } from './StoryViewer';

const POPULAR = ['Nifty', 'Sensex', 'RBI', 'Gold', 'Crude oil', 'Rupee', 'IPO', 'Results', 'Fed', 'Inflation'];

/** Search & Discover: search box, recent and popular searches, trending companies, topics. */
export function SearchScreen({ visible, onClose, onOpenTab }: { visible: boolean; onClose: () => void; onOpenTab: (tabIndex: number) => void }) {
  const t = useTheme();
  const st = styles(t);
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [viewer, setViewer] = useState<{ start: number } | null>(null);
  const recent = useRecentSearches();

  // Search as you type, after a short pause.
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(id);
  }, [text]);

  const trending = useQuery({ queryKey: ['trending'], queryFn: ({ signal }) => fetchTrending(signal), enabled: visible, staleTime: 5 * 60_000 });

  const results = useInfiniteQuery({
    queryKey: ['search', q],
    enabled: visible && q.length >= 2,
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) => searchStories({ q, before: pageParam, signal }),
    getNextPageParam: (last) => last.nextBefore,
    staleTime: 60_000,
  });
  const items: Story[] = useMemo(() => results.data?.pages.flatMap((p) => p.items) ?? [], [results.data]);

  const runSearch = (v: string) => {
    setText(v);
    setQ(v.trim());
    recent.add(v);
    Keyboard.dismiss();
  };

  const close = () => {
    setText('');
    setQ('');
    onClose();
  };

  const Chip = ({ label, icon, onPress, onRemove }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; onRemove?: () => void }) => (
    <Pressable onPress={onPress} style={({ pressed }) => [st.chip, pressed && { opacity: 0.7 }]}>
      {icon && <Ionicons name={icon} size={14} color={t.textMuted} />}
      <Text style={st.chipText}>{label}</Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${label}`}>
          <Ionicons name="close" size={14} color={t.textMuted} />
        </Pressable>
      )}
    </Pressable>
  );

  const searching = q.length >= 2;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={[st.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={st.header}>
          <View style={st.inputWrap}>
            <Ionicons name="search" size={18} color={t.textMuted} />
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={() => runSearch(text)}
              placeholder="Search news, companies, topics"
              placeholderTextColor={t.textMuted}
              style={st.input}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="never"
            />
            {text.length > 0 && (
              <Pressable onPress={() => { setText(''); setQ(''); }} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={t.textMuted} />
              </Pressable>
            )}
          </View>
          <Pressable onPress={close} hitSlop={10}>
            <Text style={st.cancel}>Cancel</Text>
          </Pressable>
        </View>

        {searching ? (
          <FlatList
            data={items}
            keyExtractor={(x) => x.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
            onEndReached={() => { if (results.hasNextPage && !results.isFetchingNextPage) results.fetchNextPage(); }}
            ListHeaderComponent={items.length ? <Text style={st.resultCount}>Latest news for “{q}”</Text> : undefined}
            ListEmptyComponent={
              results.isFetching ? (
                <View style={st.center}><ActivityIndicator color={t.isDark ? BRAND.lime : BRAND.navy} /></View>
              ) : results.isError ? (
                <View style={st.center}><Text style={st.emptyText}>Couldn't search right now. Check your connection.</Text></View>
              ) : (
                <View style={st.center}>
                  <Ionicons name="search-outline" size={44} color={t.textMuted} />
                  <Text style={st.emptyTitle}>No news found for “{q}”</Text>
                  <Text style={st.emptyText}>Try a company name, a ticker or a topic like “RBI” or “gold”.</Text>
                </View>
              )
            }
            ListFooterComponent={results.isFetchingNextPage ? <ActivityIndicator style={{ marginTop: 8 }} /> : undefined}
            renderItem={({ item, index }) => {
              const cat = categoryMeta(item.category);
              return (
                <Pressable
                  onPress={() => { recent.add(q); setViewer({ start: index }); }}
                  style={({ pressed }) => [st.row, pressed && { opacity: 0.85 }]}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image.url }} style={st.thumb} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <View style={[st.thumb, { backgroundColor: cat.colors[0], alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name={cat.icon} size={22} color="#fff" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={st.rowTitle} numberOfLines={3}>{item.title}</Text>
                    <Text style={st.rowMeta}>{cat.label} · {item.source} · {timeAgo(item.publishedAt)}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 22 }}>
            {recent.recent.length > 0 && (
              <View>
                <View style={st.sectionHead}>
                  <Text style={st.sectionTitle}>Recent searches</Text>
                  <Pressable onPress={recent.clear} hitSlop={8}><Text style={st.link}>Clear</Text></Pressable>
                </View>
                <View style={st.chips}>
                  {recent.recent.map((r) => <Chip key={r} label={r} icon="time-outline" onPress={() => runSearch(r)} onRemove={() => recent.remove(r)} />)}
                </View>
              </View>
            )}

            {(trending.data?.length ?? 0) > 0 && (
              <View>
                <Text style={st.sectionTitle}>🔥 Trending companies</Text>
                <View style={st.chips}>
                  {trending.data!.map((c) => (
                    <Pressable key={c.name} onPress={() => runSearch(c.name)} style={({ pressed }) => [st.company, pressed && { opacity: 0.7 }]}>
                      <Text style={st.companyName} numberOfLines={1}>{c.name}</Text>
                      {c.symbol ? <Text style={st.companySym}>{c.symbol}</Text> : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View>
              <Text style={st.sectionTitle}>Popular searches</Text>
              <View style={st.chips}>
                {POPULAR.map((p) => <Chip key={p} label={p} icon="trending-up" onPress={() => runSearch(p)} />)}
              </View>
            </View>

            <View>
              <Text style={st.sectionTitle}>Topics</Text>
              <View style={st.grid}>
                {TABS.map((tab, i) => {
                  const meta = tab.id ? categoryMeta(tab.id) : { label: 'Top stories', icon: 'flash' as const, colors: [BRAND.blue, BRAND.navy] as [string, string] };
                  return (
                    <Pressable key={tab.id ?? 'top'} style={({ pressed }) => [st.tile, pressed && { transform: [{ scale: 0.97 }] }]} onPress={() => { close(); onOpenTab(i); }}>
                      <LinearGradient colors={meta.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.tileBg}>
                        <Ionicons name={meta.icon} size={22} color="#fff" />
                        <Text style={st.tileText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{tab.label}</Text>
                      </LinearGradient>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        )}
      </View>

      <StoryViewer stories={viewer ? items : null} start={viewer?.start ?? 0} title={`“${q}”`} onClose={() => setViewer(null)} />
    </Modal>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
    inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.card, borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: t.border },
    input: { flex: 1, color: t.text, fontSize: 16 },
    cancel: { color: t.isDark ? BRAND.lime : BRAND.navy, fontWeight: '600', fontSize: 15 },
    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { color: t.text, fontWeight: '800', fontSize: 16, marginBottom: 10 },
    link: { color: t.textMuted, fontWeight: '600', marginBottom: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
    chipText: { color: t.text, fontWeight: '600', fontSize: 13.5 },
    company: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.chip, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, maxWidth: '100%' },
    companyName: { color: t.chipText, fontWeight: '700', fontSize: 13.5, flexShrink: 1 },
    companySym: { color: t.textMuted, fontSize: 11, fontWeight: '700' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: { width: '31%', flexGrow: 1 },
    tileBg: { height: 78, borderRadius: 14, padding: 12, justifyContent: 'space-between' },
    tileText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
    resultCount: { color: t.textMuted, fontWeight: '600', marginBottom: 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: t.card, borderWidth: 1, borderColor: t.border },
    thumb: { width: 72, height: 72, borderRadius: 10 },
    rowTitle: { color: t.text, fontSize: 14.5, fontWeight: '700', lineHeight: 19 },
    rowMeta: { color: t.textMuted, fontSize: 12, marginTop: 4 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, paddingBottom: 80 },
    emptyTitle: { color: t.text, fontWeight: '700', fontSize: 16, textAlign: 'center' },
    emptyText: { color: t.textMuted, fontSize: 14, textAlign: 'center' },
  });
