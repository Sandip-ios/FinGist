import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBookmarks } from '../lib/bookmarks';
import { timeAgo } from '../lib/time';
import { BRAND, categoryMeta, useTheme } from '../theme';

export function SavedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { saved, remove } = useBookmarks();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.container, { backgroundColor: t.bg, paddingBottom: insets.bottom }]}>
        <View style={s.header}>
          <Text style={[s.h1, { color: t.text }]}>Saved</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close-circle" size={30} color={t.textMuted} />
          </Pressable>
        </View>
        <FlatList
          data={saved}
          keyExtractor={(st) => st.id}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="bookmark-outline" size={48} color={t.textMuted} />
              <Text style={[s.emptyTitle, { color: t.text }]}>No saved stories yet</Text>
              <Text style={[s.emptySub, { color: t.textMuted }]}>Tap the bookmark on any story to read it later.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cat = categoryMeta(item.category);
            return (
              <Pressable
                onPress={() => WebBrowser.openBrowserAsync(item.url, { controlsColor: BRAND.navy }).catch(() => {})}
                style={({ pressed }) => [s.row, { backgroundColor: t.card, borderColor: t.border }, pressed && { opacity: 0.85 }]}
              >
                {item.image ? (
                  <Image source={{ uri: item.image.url }} style={s.thumb} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <View style={[s.thumb, { backgroundColor: cat.colors[0], alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name={cat.icon} size={24} color="#fff" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: t.text }]} numberOfLines={3}>{item.title}</Text>
                  <Text style={[s.meta, { color: t.textMuted }]}>{item.source} · {timeAgo(item.publishedAt)}</Text>
                </View>
                <Pressable onPress={() => remove(item.id)} hitSlop={10} accessibilityLabel="Remove from saved">
                  <Ionicons name="bookmark" size={22} color={t.isDark ? BRAND.lime : BRAND.navy} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  h1: { fontSize: 24, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1 },
  thumb: { width: 64, height: 64, borderRadius: 10 },
  title: { fontSize: 14.5, fontWeight: '700', lineHeight: 19 },
  meta: { fontSize: 12, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center' },
});
