import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Story } from './types';

const KEY = 'fingist.bookmarks.v1';
const MAX = 300;

interface Bookmarks {
  saved: Story[];
  isSaved: (id: string) => boolean;
  toggle: (story: Story) => void;
  remove: (id: string) => void;
}

const Ctx = createContext<Bookmarks | null>(null);

/** Saved stories, kept on the phone (no account needed). */
export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<Story[]>([]);
  const loaded = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v) setSaved(JSON.parse(v) as Story[]); })
      .catch(() => {})
      .finally(() => { loaded.current = true; });
  }, []);

  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
  }, [saved]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    toastAnim.stopAnimation();
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
      Animated.delay(1100),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) setToast(null); });
  }, [toastAnim]);

  const toggle = useCallback((story: Story) => {
    setSaved((prev) => {
      const exists = prev.some((s) => s.id === story.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(exists ? 'Removed from Saved' : 'Saved to bookmarks');
      return exists ? prev.filter((s) => s.id !== story.id) : [story, ...prev].slice(0, MAX);
    });
  }, [showToast]);

  const remove = useCallback((id: string) => setSaved((prev) => prev.filter((s) => s.id !== id)), []);

  const value = useMemo<Bookmarks>(() => {
    const ids = new Set(saved.map((s) => s.id));
    return { saved, isSaved: (id) => ids.has(id), toggle, remove };
  }, [saved, toggle, remove]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.toast,
            { bottom: insets.bottom + 90, opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
          ]}
        >
          <Text style={s.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export function useBookmarks(): Bookmarks {
  const v = useContext(Ctx);
  if (!v) throw new Error('useBookmarks must be used inside BookmarksProvider');
  return v;
}

const s = StyleSheet.create({
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(15,23,42,0.92)', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
});
