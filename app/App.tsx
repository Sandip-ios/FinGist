import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FeedScreen } from './src/components/FeedScreen';
import { IntroSplash } from './src/components/IntroSplash';
import { AlertsProvider } from './src/lib/alerts';
import { BookmarksProvider } from './src/lib/bookmarks';
import { TourProvider } from './src/lib/tour';
import { NEWS_CACHE_KEY } from './src/lib/cache';
import { ThemeModeProvider } from './src/lib/themeMode';
import { useTheme } from './src/theme';
import { Image } from 'expo-image';
import AsyncStorageAuto from '@react-native-async-storage/async-storage';

SplashScreen.preventAutoHideAsync().catch(() => {});

const DAY = 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: DAY, retry: 2, networkMode: 'offlineFirst' },
  },
});

// Saved stories survive app restarts and are shown when offline.
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: NEWS_CACHE_KEY, throttleTime: 2000 });

// Refetch when the app comes back to the foreground.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (state) => {
    if (Platform.OS !== 'web') setFocused(state === 'active');
  });
  return () => sub.remove();
});
onlineManager.setOnline(true);

export default function App() {
  return (
    <ThemeModeProvider>
      <AppContent />
    </ThemeModeProvider>
  );
}

const IMAGE_CLEAN_KEY = 'fingist.imageCacheCleanedAt';

function AppContent() {
  const t = useTheme();
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.bg).catch(() => {});
  }, [t.bg]);
  // Keep downloaded card photos from piling up: clear the photo cache once a week.
  useEffect(() => {
    AsyncStorageAuto.getItem(IMAGE_CLEAN_KEY)
      .then((v) => {
        const week = 7 * DAY;
        if (!v || Date.now() - Number(v) > week) {
          Image.clearDiskCache().catch(() => {});
          AsyncStorageAuto.setItem(IMAGE_CLEAN_KEY, String(Date.now())).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: DAY, buster: 'v1' }}
        onSuccess={() => setRestored(true)}
        onError={() => setRestored(true)}
      >
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <BookmarksProvider>
          <AlertsProvider>
            <TourProvider>
              <FeedScreen />
            </TourProvider>
          </AlertsProvider>
        </BookmarksProvider>
        <IntroSplash ready={restored} />
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
