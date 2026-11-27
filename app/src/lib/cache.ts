import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

/** Key of the saved news cache (stories kept for offline reading). */
export const NEWS_CACHE_KEY = 'fingist.cache.v1';

/**
 * Clears downloaded card photos and saved news, then reloads fresh news.
 * Bookmarks, recent searches, alert and appearance settings are kept.
 */
export async function clearAppCache(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    Image.clearDiskCache().catch(() => false),
    Image.clearMemoryCache().catch(() => false),
    AsyncStorage.removeItem(NEWS_CACHE_KEY).catch(() => {}),
  ]);
  queryClient.clear();
  await queryClient.refetchQueries({ type: 'active' }).catch(() => {});
}
