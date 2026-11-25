import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RegionFilter } from '../lib/types';
import { CATEGORIES, useTheme } from '../theme';

const REGIONS: { id: RegionFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'india', label: '🇮🇳 India' },
  { id: 'global', label: '🌐 Global' },
];

// Category chips shown in the bar (others still appear in the feed).
const CHIP_CATEGORIES = ['markets', 'stocks', 'earnings', 'ipo', 'economy', 'policy', 'banking', 'commodities', 'corporate_action', 'global'];

export function FilterBar(props: {
  region: RegionFilter;
  category: string | null;
  onRegion: (r: RegionFilter) => void;
  onCategory: (c: string | null) => void;
}) {
  const t = useTheme();
  const tap = () => Haptics.selectionAsync().catch(() => {});
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {[{ id: null as string | null, label: 'Top stories' }, ...CATEGORIES.filter((c) => CHIP_CATEGORIES.includes(c.id))].map((c) => {
          const active = props.category === c.id;
          return (
            <Pressable
              key={c.id ?? 'all'}
              onPress={() => { tap(); props.onCategory(c.id); }}
              style={[s.chip, { borderColor: active ? t.tabActive : t.border, backgroundColor: active ? t.tabActive : 'transparent' }]}
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
