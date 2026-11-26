import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { removeDevice, saveDevice } from './api';
import { config } from './config';
import type { RegionFilter } from './types';

const KEY = 'fingist.alerts.v1';
const TAP_KEY = 'fingist.lastAlertTap';

export interface AlertPrefs {
  enabled: boolean;
  region: RegionFilter;
  quietHours: boolean;
  /** Alert types */
  morning: boolean;
  marketOpen: boolean;
  breaking: boolean;
  token: string | null;
  /** Whether the one-time "turn on alerts?" card was already shown. */
  promptSeen: boolean;
  opens: number;
}

const DEFAULTS: AlertPrefs = { enabled: false, region: 'all', quietHours: true, morning: true, marketOpen: true, breaking: true, token: null, promptSeen: false, opens: 0 };

const devicePrefs = (p: AlertPrefs) => ({ region: p.region, quietHours: p.quietHours, morning: p.morning, marketOpen: p.marketOpen, breaking: p.breaking });

// Show alerts as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function getToken(): Promise<string> {
  if (!Device.isDevice) throw new Error('Alerts need a real phone (not a simulator).');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('breaking', {
      name: 'Breaking market news',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#01208e',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) throw new Error('Notifications are turned off for FinGist. You can allow them in your phone Settings.');
  if (!config.projectId) throw new Error('Push is not set up yet (missing EAS project ID).');
  return (await Notifications.getExpoPushTokenAsync({ projectId: config.projectId })).data;
}

interface Alerts {
  prefs: AlertPrefs;
  busy: boolean;
  error: string | null;
  /** Turn alerts on (asks for permission) or off. */
  setEnabled: (on: boolean) => Promise<boolean>;
  update: (p: Partial<Pick<AlertPrefs, 'region' | 'quietHours' | 'morning' | 'marketOpen' | 'breaking'>>) => Promise<void>;
  markPromptSeen: () => void;
}

const Ctx = createContext<Alerts | null>(null);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<AlertPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback((p: AlertPrefs) => {
    setPrefs(p);
    AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
  }, []);

  // Load saved settings, count app opens, and refresh the token on every start (tokens can change).
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .catch(() => null)
      .then(async (v) => {
        const p: AlertPrefs = { ...DEFAULTS, ...(v ? (JSON.parse(v) as Partial<AlertPrefs>) : {}) };
        p.opens += 1;
        persist(p);
        if (p.enabled) {
          try {
            const token = await getToken();
            await saveDevice({ token, platform: Platform.OS, ...devicePrefs(p) });
            if (token !== p.token) persist({ ...p, token });
          } catch {
            // Keep the setting; we retry on next start.
          }
        }
      });
  }, [persist]);

  const setEnabled = useCallback(async (on: boolean) => {
    if (!prefs) return false;
    setBusy(true);
    setError(null);
    try {
      if (on) {
        const token = await getToken();
        await saveDevice({ token, platform: Platform.OS, ...devicePrefs(prefs) });
        persist({ ...prefs, enabled: true, token, promptSeen: true });
      } else {
        if (prefs.token) await removeDevice(prefs.token).catch(() => {});
        persist({ ...prefs, enabled: false, promptSeen: true });
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }, [prefs, persist]);

  const update = useCallback(async (change: Partial<Pick<AlertPrefs, 'region' | 'quietHours' | 'morning' | 'marketOpen' | 'breaking'>>) => {
    if (!prefs) return;
    const next = { ...prefs, ...change };
    persist(next);
    if (next.enabled && next.token) {
      await saveDevice({ token: next.token, platform: Platform.OS, ...devicePrefs(next) }).catch(() => setError('Could not save. Check your connection.'));
    }
  }, [prefs, persist]);

  const markPromptSeen = useCallback(() => { if (prefs) persist({ ...prefs, promptSeen: true }); }, [prefs, persist]);

  const value = useMemo<Alerts>(() => ({ prefs: prefs ?? DEFAULTS, busy, error, setEnabled, update, markPromptSeen }), [prefs, busy, error, setEnabled, update, markPromptSeen]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAlerts(): Alerts {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAlerts must be used inside AlertsProvider');
  return v;
}

/** Opens a story when the user taps an alert (also when the tap launched the app). */
export function useAlertTaps(onStory: (storyId: string) => void) {
  useEffect(() => {
    // The "last response" survives restarts, so remember which tap we already handled.
    const handle = async (r: Notifications.NotificationResponse | null) => {
      const id = r?.notification.request.content.data?.storyId;
      const tapId = r?.notification.request.identifier;
      if (typeof id !== 'string' || !tapId) return;
      const last = await AsyncStorage.getItem(TAP_KEY).catch(() => null);
      if (last === tapId) return;
      AsyncStorage.setItem(TAP_KEY, tapId).catch(() => {});
      onStory(id);
    };
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [onStory]);
}
