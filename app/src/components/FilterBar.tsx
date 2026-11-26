import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import type { RegionFilter } from '../lib/types';
import { CATEGORIES, useTheme } from '../theme';

const REGIONS: { id: RegionFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'india', label: '🇮🇳 India' },
  { id: 'global', label: '🌐 Global' },
];

// Category tabs, in swipe order (other categories still appear in Top stories).
const TAB_CATEGORIES = ['markets', 'stocks', 'earnings', 'ipo', 'economy', 'policy', 'banking', 'commodities', 'corporate_action', 'global'];
export const TABS: { id: string | null; label: string }[] = [
  { id: null, label: 'Top stories' },
  ...TAB_CATEGORIES.map((id) => ({ id, label: CATEGORIES.find((c) => c.id === id)!.label })),
];

export function FilterBar(props: { region: RegionFilter; tab: number; onRegion: (r: RegionFilter) => void; onTab: (i: number) => void }) {
  const t = useTheme();
  const tap = () => Haptics.selectionAsync().catch(() => {});
  const scroller = useRef<ScrollViewInstance>(null);
  const positions = useRef<{ x: number; w: number }[]>([]);

  // Keep the active chip in view when the user swipes between categories.
  useEffect(() => {
    const p = positions.current[props.tab];
    if (p) scroller.current?.scrollTo({ x: Math.max(0, p.x - 40), animated: true });
  }, [props.tab]);

  return (
    <View>
      <View style={[s.segment, { backgroundColor: t.tabIdle }]}>
        {REGIONS.map((r) => {
          const active = props.region === r.id;
          return (
            <Pressable
              key={r.id}
              onPress={() => { tap(); props.onRegion(r.id); }}
              style={[s.segItem, active && { backgroundColor: t.tabActive }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.segText, { color: active ? t.tabActiveText : t.tabIdleText }]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {TABS.map((c, i) => {
          const active = props.tab === i;
          return (
            <Pressable
              key={c.id ?? 'top'}
              onLayout={(e) => { positions.current[i] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width }; }}
              onPress={() => { tap(); props.onTab(i); }}
              style={[s.chip, { borderColor: active ? t.tabActive : t.border, backgroundColor: active ? t.tabActive : 'transparent' }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.chipText, { color: active ? t.tabActiveText : t.textMuted }]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  segment: { flexDirection: 'row', marginHorizontal: 14, borderRadius: 12, padding: 3 },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segText: { fontWeight: '700', fontSize: 14 },
  chips: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, borderWidth: 1 },
  chipText: { fontWeight: '600', fontSize: 13 },
});
