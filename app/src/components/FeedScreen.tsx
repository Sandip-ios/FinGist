import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBookmarks } from '../lib/bookmarks';
import type { RegionFilter } from '../lib/types';
import { BRAND, useTheme } from '../theme';
import { AboutSheet } from './AboutSheet';
import { CategoryFeed } from './CategoryFeed';
import { FilterBar, TABS } from './FilterBar';
import { Pager, type PagerHandle } from './Pager';
import { SavedSheet } from './SavedSheet';

export function FeedScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState<RegionFilter>('all');
  const [tab, setTab] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const pager = useRef<PagerHandle>(null);
  const { saved } = useBookmarks();

  const selectTab = (i: number) => {
    setTab(i);
    pager.current?.setPage(i);
  };

  return (
    <View style={[s.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={[s.logo, { color: t.isDark ? '#fff' : BRAND.navy }]}>
          Fin<Text style={{ color: t.isDark ? BRAND.lime : '#5fa80f' }}>Gist</Text>
        </Text>
        <View style={s.headerIcons}>
          <Pressable onPress={() => setSavedOpen(true)} hitSlop={10} accessibilityLabel={`Saved stories (${saved.length})`}>
            <Ionicons name={saved.length ? 'bookmarks' : 'bookmarks-outline'} size={23} color={t.text} />
            {saved.length > 0 && (
              <View style={[s.badge, { backgroundColor: t.isDark ? BRAND.lime : BRAND.navy }]}>
                <Text style={[s.badgeText, { color: t.isDark ? '#0b1222' : '#fff' }]}>{saved.length > 99 ? '99+' : saved.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => setAboutOpen(true)} hitSlop={10} accessibilityLabel="About FinGist">
            <Ionicons name="information-circle-outline" size={26} color={t.text} />
          </Pressable>
        </View>
      </View>

      <FilterBar region={region} tab={tab} onRegion={setRegion} onTab={selectTab} />

      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {/* Swipe left/right to change category; up/down for the next story. */}
        <Pager ref={pager} onPageSelected={setTab}>
          {TABS.map((c, i) => (
            <View key={c.id ?? 'top'} collapsable={false} style={{ flex: 1 }}>
              {Math.abs(i - tab) <= 1 ? <CategoryFeed key={region} region={region} category={c.id} /> : null}
            </View>
          ))}
        </Pager>

      </View>

      <AboutSheet visible={aboutOpen} onClose={() => setAboutOpen(false)} />
      <SavedSheet visible={savedOpen} onClose={() => setSavedOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  logo: { fontSize: 28, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  badge: { position: 'absolute', top: -6, right: -9, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, fontWeight: '800' },
});
