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
import { useTheme } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const DAY = 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: DAY, retry: 2, networkMode: 'offlineFirst' },
  },
});

// Saved stories survive app restarts and are shown when offline.
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'fingist.cache.v1', throttleTime: 2000 });

// Refetch when the app comes back to the foreground.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (state) => {
    if (Platform.OS !== 'web') setFocused(state === 'active');
  });
  return () => sub.remove();
});
onlineManager.setOnline(true);

export default function App() {
  const t = useTheme();
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.bg).catch(() => {});
  }, [t.bg]);
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
