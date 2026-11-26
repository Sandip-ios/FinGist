import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RegionFilter } from '../lib/types';
import { BRAND, useTheme } from '../theme';
import { AboutSheet } from './AboutSheet';
import { CategoryFeed } from './CategoryFeed';
import { FilterBar, TABS } from './FilterBar';
import { Pager, type PagerHandle } from './Pager';

const HINT_KEY = 'fingist.swipeHintSeen.v2';

export function FeedScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState<RegionFilter>('all');
  const [tab, setTab] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const pager = useRef<PagerHandle>(null);

  useEffect(() => {
    AsyncStorage.getItem(HINT_KEY).then((v) => { if (!v) setShowHint(true); }).catch(() => {});
  }, []);

  const hideHint = useCallback(() => {
    if (!showHint) return;
    setShowHint(false);
    AsyncStorage.setItem(HINT_KEY, '1').catch(() => {});
  }, [showHint]);

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
        <Pressable onPress={() => setAboutOpen(true)} hitSlop={10} accessibilityLabel="About FinGist">
          <Ionicons name="information-circle-outline" size={26} color={t.text} />
        </Pressable>
      </View>

      <FilterBar region={region} tab={tab} onRegion={setRegion} onTab={selectTab} />

      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {/* Swipe left/right to change category; up/down for the next story. */}
        <Pager ref={pager} onPageSelected={(i) => { setTab(i); if (i > 0) hideHint(); }}>
          {TABS.map((c, i) => (
            <View key={c.id ?? 'top'} collapsable={false} style={{ flex: 1 }}>
              {Math.abs(i - tab) <= 1 ? <CategoryFeed key={region} region={region} category={c.id} onFirstSwipe={hideHint} /> : null}
            </View>
          ))}
        </Pager>

        {showHint && (
          <View pointerEvents="none" style={[s.hint, { top: '48%' }]}>
            <Ionicons name="swap-vertical" size={16} color="#fff" />
            <Text style={s.hintText}>Swipe up for next story · sideways for categories</Text>
          </View>
        )}
      </View>

      <AboutSheet visible={aboutOpen} onClose={() => setAboutOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  logo: { fontSize: 28, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5 },
  hint: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(1,32,142,0.92)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18 },
  hintText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
});
