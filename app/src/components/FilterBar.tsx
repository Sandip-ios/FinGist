import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import type { RegionFilter } from '../lib/types';
import { BRAND, CATEGORIES, useTheme } from '../theme';

const REGIONS: { id: RegionFilter; label: string; short: string; hint: string }[] = [
  { id: 'all', label: '🌐 All markets', short: '🌐 All', hint: 'India and global news' },
  { id: 'india', label: '🇮🇳 India', short: '🇮🇳 India', hint: 'NSE, BSE, RBI, SEBI and Indian economy' },
  { id: 'global', label: '🌍 Global', short: '🌍 Global', hint: 'US, Europe, Asia and world economy' },
];

// Category tabs, in swipe order (other categories still appear in Top stories).
const TAB_CATEGORIES = ['markets', 'stocks', 'earnings', 'ipo', 'economy', 'policy', 'banking', 'commodities', 'corporate_action', 'global'];
export const TABS: { id: string | null; label: string }[] = [
  { id: null, label: 'Top stories' },
  ...TAB_CATEGORIES.map((id) => ({ id, label: CATEGORIES.find((c) => c.id === id)!.label })),
];

/** Region menu button + scrollable category tabs with an underline on the active tab. */
export function FilterBar(props: { region: RegionFilter; tab: number; onRegion: (r: RegionFilter) => void; onTab: (i: number) => void }) {
  const t = useTheme();
  const tap = () => Haptics.selectionAsync().catch(() => {});
  const scroller = useRef<ScrollViewInstance>(null);
  const positions = useRef<{ x: number; w: number }[]>([]);
  const [menu, setMenu] = useState(false);
  const accent = t.isDark ? BRAND.lime : BRAND.navy;
  const region = REGIONS.find((r) => r.id === props.region)!;

  // Keep the previous tab fully visible (start at 0 for the first tabs).
  useEffect(() => {
    const prev = positions.current[props.tab - 1];
    const x = props.tab <= 1 || !prev ? 0 : prev.x - 10;
    scroller.current?.scrollTo({ x, animated: true });
  }, [props.tab]);

  return (
    <View style={[s.bar, { borderBottomColor: t.border }]}>
      <Pressable
        onPress={() => { tap(); setMenu(true); }}
        style={({ pressed }) => [s.regionBtn, { backgroundColor: t.isDark ? t.tabIdle : '#ffffff', borderColor: t.border }, pressed && { opacity: 0.8 }]}
        accessibilityLabel={`Region: ${region.label}. Change region`}
      >
        <Text style={[s.regionText, { color: t.text }]}>{region.short}</Text>
        <Ionicons name="chevron-down" size={14} color={t.textMuted} />
      </Pressable>

      <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {TABS.map((c, i) => {
          const active = props.tab === i;
          return (
            <Pressable
              key={c.id ?? 'top'}
              onLayout={(e) => { positions.current[i] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width }; }}
              onPress={() => { tap(); props.onTab(i); }}
              style={s.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.tabText, { color: active ? t.text : t.textMuted, fontWeight: active ? '800' : '600' }]}>{c.label}</Text>
              <View style={[s.underline, { backgroundColor: active ? accent : 'transparent' }]} />
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={s.backdrop} onPress={() => setMenu(false)}>
          <View style={[s.menu, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[s.menuTitle, { color: t.textMuted }]}>Show news from</Text>
            {REGIONS.map((r) => {
              const active = r.id === props.region;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => { tap(); props.onRegion(r.id); setMenu(false); }}
                  style={({ pressed }) => [s.menuItem, active && { backgroundColor: t.tabIdle }, pressed && { opacity: 0.8 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.menuLabel, { color: t.text }]}>{r.label}</Text>
                    <Text style={[s.menuHint, { color: t.textMuted }]}>{r.hint}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={22} color={accent} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  regionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 32, borderRadius: 16, borderWidth: 1, marginRight: 4 },
  regionText: { fontWeight: '700', fontSize: 13 },
  tabs: { paddingHorizontal: 8, gap: 4 },
  tab: { paddingHorizontal: 8, paddingTop: 10, alignItems: 'center' },
  tabText: { fontSize: 14.5 },
  underline: { height: 3, borderRadius: 2, alignSelf: 'stretch', marginTop: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'flex-start', paddingTop: 150, paddingHorizontal: 16 },
  menu: { borderRadius: 18, padding: 8, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  menuTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 10, paddingVertical: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12 },
  menuLabel: { fontSize: 16, fontWeight: '700' },
  menuHint: { fontSize: 12.5, marginTop: 2 },
});
