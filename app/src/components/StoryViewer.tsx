import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Story } from '../lib/types';
import { useTheme } from '../theme';
import { NewsCard } from './NewsCard';
import { StackedCard } from './StackedCard';

/** Full-screen swipeable cards for a list of stories (search results, saved), starting at `start`. */
export function StoryViewer({ stories, start, title, onClose }: { stories: Story[] | null; start: number; title: string; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [h, setH] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  return (
    <Modal visible={!!stories} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[s.root, { backgroundColor: t.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={28} color={t.text} />
          </Pressable>
          <Text style={[s.title, { color: t.text }]} numberOfLines={1}>{title}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={{ flex: 1 }} onLayout={(e) => { const v = Math.round(e.nativeEvent.layout.height); if (v > 0) setH(v); }}>
          {stories && h > 0 && (
            <Animated.FlatList
              data={stories}
              keyExtractor={(x: Story) => x.id}
              renderItem={({ item, index }: { item: Story; index: number }) => (
                <StackedCard index={index} height={h} scrollY={scrollY} last={index === stories.length - 1}>
                  <NewsCard story={item} />
                </StackedCard>
              )}
              getItemLayout={(_: unknown, i: number) => ({ length: h, offset: h * i, index: i })}
              initialScrollIndex={Math.min(start, stories.length - 1)}
              snapToInterval={h}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              showsVerticalScrollIndicator={false}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: Platform.OS !== 'web' })}
              scrollEventThrottle={16}
              removeClippedSubviews={false}
              windowSize={5}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
});
