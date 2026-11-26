import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBookmarks } from '../lib/bookmarks';
import { OpenSearchContext } from '../lib/openSearch';
import { useTourRef } from '../lib/tour';
import type { RegionFilter } from '../lib/types';
import { BRAND, useTheme } from '../theme';
import { fetchStory } from '../lib/api';
import { useAlertTaps } from '../lib/alerts';
import type { Story } from '../lib/types';
import { AlertsPrompt } from './AlertsPrompt';
import { MoreSheet } from './MoreSheet';
import { StoryViewer } from './StoryViewer';
import { TourOverlay } from './TourOverlay';
import { CategoryFeed } from './CategoryFeed';
import { FilterBar, TABS } from './FilterBar';
import { Pager, type PagerHandle } from './Pager';
import { SavedSheet } from './SavedSheet';
import { SearchScreen } from './SearchScreen';

export function FeedScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState<RegionFilter>('all');
  const [tab, setTab] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [alertStory, setAlertStory] = useState<Story[] | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<{ q: string; n: number } | undefined>(undefined);
  // Company tags on cards open Search for that company (also from alert and search cards).
  const openSearch = useCallback((q: string) => {
    const show = () => {
      setSearchQuery((prev) => ({ q, n: (prev?.n ?? 0) + 1 }));
      setSearchOpen(true);
    };
    // iOS cannot open one full-screen view while another is closing, so wait for the alert card to close.
    setAlertStory((open) => { if (open) setTimeout(show, 450); else show(); return null; });
  }, []);
  const pager = useRef<PagerHandle>(null);
  const { saved } = useBookmarks();
  // After the app has been in the background for a while, rebuild the news area and start from the
  // newest story. Long background periods can leave iOS pages undrawn (blank screen).
  const [resumeKey, setResumeKey] = useState(0);
  const backgroundAt = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active' && backgroundAt.current && Date.now() - backgroundAt.current > 60_000) setResumeKey((k) => k + 1);
      if (state === 'active') backgroundAt.current = null;
    });
    return () => sub.remove();
  }, []);
  const searchRef = useTourRef('search');
  const savedRef = useTourRef('saved');
  const menuRef = useTourRef('menu');

  // Tapping a news alert opens that story.
  const openStory = useCallback((id: string) => {
    fetchStory(id).then((st) => { if (st) setAlertStory([st]); }).catch(() => {});
  }, []);
  useAlertTaps(openStory);

  const selectTab = (i: number) => {
    setTab(i);
    pager.current?.setPage(i);
  };

  return (
    <OpenSearchContext.Provider value={openSearch}>
    <View style={[s.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={s.header}>
        <View>
          <Text style={[s.logo, { color: t.isDark ? '#fff' : BRAND.navy }]}>
            Fin<Text style={{ color: t.isDark ? BRAND.lime : '#5fa80f' }}>Gist</Text>
          </Text>
          <Text style={[s.date, { color: t.textMuted }]}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <View style={s.headerIcons}>
          <Pressable ref={searchRef} onPress={() => setSearchOpen(true)} hitSlop={10} accessibilityLabel="Search news">
            <Ionicons name="search" size={24} color={t.text} />
          </Pressable>
          <Pressable ref={savedRef} onPress={() => setSavedOpen(true)} hitSlop={10} accessibilityLabel={`Saved stories (${saved.length})`}>
            <Ionicons name={saved.length ? 'bookmarks' : 'bookmarks-outline'} size={23} color={t.text} />
            {saved.length > 0 && (
              <View style={[s.badge, { backgroundColor: t.isDark ? BRAND.lime : BRAND.navy }]}>
                <Text style={[s.badgeText, { color: t.isDark ? '#0b1222' : '#fff' }]}>{saved.length > 99 ? '99+' : saved.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable ref={menuRef} onPress={() => setMoreOpen(true)} hitSlop={10} accessibilityLabel="More: alerts, share, feedback, terms, privacy">
            <Ionicons name="menu" size={27} color={t.text} />
          </Pressable>
        </View>
      </View>

      <FilterBar region={region} tab={tab} onRegion={setRegion} onTab={selectTab} />

      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {/* Swipe left/right to change category; up/down for the next story. */}
        <Pager key={resumeKey} ref={pager} initialPage={tab} onPageSelected={setTab}>
          {TABS.map((c, i) => (
            <View key={c.id ?? 'top'} collapsable={false} style={{ flex: 1 }}>
              {Math.abs(i - tab) <= 1 ? <CategoryFeed key={`${region}-${resumeKey}`} region={region} category={c.id} /> : null}
            </View>
          ))}
        </Pager>
        <AlertsPrompt />

      </View>

      <MoreSheet visible={moreOpen} onClose={() => setMoreOpen(false)} onShowTour={() => { setMoreOpen(false); selectTab(0); }} />
      <TourOverlay />
      <StoryViewer stories={alertStory} start={0} title="Breaking news" onClose={() => setAlertStory(null)} />
      <SavedSheet visible={savedOpen} onClose={() => setSavedOpen(false)} />
      <SearchScreen visible={searchOpen} onClose={() => { setSearchOpen(false); setSearchQuery(undefined); }} onOpenTab={selectTab} initialQuery={searchQuery} />
    </View>
    </OpenSearchContext.Provider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  date: { fontSize: 12, fontWeight: '600', marginTop: -2 },
  logo: { fontSize: 27, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  badge: { position: 'absolute', top: -6, right: -9, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, fontWeight: '800' },
});
