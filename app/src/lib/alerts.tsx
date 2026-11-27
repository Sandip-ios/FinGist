import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { removeDevice, saveDevice, sendTestAlert, type TestAlertResult } from './api';
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

/** Rejects with `message` if `work` takes longer than `ms`, so a stuck step can't hang the app. */
function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    work.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

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
  /**
   * First launch only: ask for notification permission and switch all alert types on if allowed.
   * Resolves when the person has answered (or straight away on later launches).
   */
  firstRunPermission: () => Promise<void>;
  /** Registers this phone again and sends a test alert; returns what happened. */
  test: () => Promise<TestAlertResult>;
}

const Ctx = createContext<Alerts | null>(null);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<AlertPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Always the newest settings, so a quick second tap never works from an old copy.
  const latest = useRef<AlertPrefs>(DEFAULTS);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Applies a change on top of the newest settings and saves it on the phone. */
  const change = useCallback((fn: (prev: AlertPrefs) => AlertPrefs) => {
    const next = fn(latest.current);
    latest.current = next;
    setPrefs(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    return next;
  }, []);

  /** Sends the newest settings to the server, once the user stops tapping. */
  const syncSoon = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const p = latest.current;
      if (p.enabled && p.token) {
        saveDevice({ token: p.token, platform: Platform.OS, ...devicePrefs(p) }).catch(() => setError('Could not save. Check your connection.'));
      }
    }, 500);
  }, []);

  // Load saved settings, count app opens, and refresh the token on every start (tokens can change).
  useEffect(() => {
    let done: () => void = () => {};
    loaded.current = new Promise<void>((r) => { done = r; });
    AsyncStorage.getItem(KEY)
      .catch(() => null)
      .then(async (v) => {
        const saved: AlertPrefs = { ...DEFAULTS, ...(v ? (JSON.parse(v) as Partial<AlertPrefs>) : {}) };
        const p = change(() => ({ ...saved, opens: saved.opens + 1 }));
        done();
        if (p.enabled) {
          try {
            const token = await getToken();
            // Only the token changes here; switches the user moved meanwhile are kept.
            const now = change((prev) => ({ ...prev, token }));
            await saveDevice({ token, platform: Platform.OS, ...devicePrefs(now) });
          } catch {
            // Keep the setting; we retry on next start.
          }
        }
      });
  }, [change]);

  const setEnabled = useCallback(async (on: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (on) {
        const token = await getToken();
        const p = change((prev) => ({ ...prev, enabled: true, token, promptSeen: true }));
        await saveDevice({ token, platform: Platform.OS, ...devicePrefs(p) });
      } else {
        const token = latest.current.token;
        change((prev) => ({ ...prev, enabled: false, promptSeen: true }));
        if (token) await removeDevice(token).catch(() => {});
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }, [change]);

  const update = useCallback(async (patch: Partial<Pick<AlertPrefs, 'region' | 'quietHours' | 'morning' | 'marketOpen' | 'breaking'>>) => {
    setError(null);
    change((prev) => ({ ...prev, ...patch }));
    syncSoon();
  }, [change, syncSoon]);

  const markPromptSeen = useCallback(() => { change((prev) => ({ ...prev, promptSeen: true })); }, [change]);

  const test = useCallback(async (): Promise<TestAlertResult> => {
    let token: string;
    try {
      token = await withTimeout(getToken(), 20_000, 'TokenTimeout');
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'TokenTimeout') return { ok: false, stage: 'phone', error: 'TokenTimeout' };
      return { ok: false, stage: 'phone', error: 'Phone', message: msg };
    }
    try {
      const p = change((prev) => ({ ...prev, enabled: true, token }));
      await withTimeout(saveDevice({ token, platform: Platform.OS, ...devicePrefs(p) }), 20_000, 'ServerTimeout');
      return await withTimeout(sendTestAlert(token), 30_000, 'ServerTimeout');
    } catch (e) {
      const msg = (e as Error).message;
      return { ok: false, stage: 'server', error: msg === 'ServerTimeout' ? 'ServerTimeout' : 'Network', message: msg };
    }
  }, [change]);

  const loaded = useRef<Promise<void> | null>(null);
  const firstRunPermission = useCallback(async () => {
    await loaded.current;
    const p = latest.current;
    if (p.promptSeen || p.enabled) return;
    // Alerts are on by default: one system question on first launch, then all types are on.
    change((prev) => ({ ...prev, promptSeen: true }));
    try {
      const token = await getToken();
      const next = change((prev) => ({ ...prev, enabled: true, token }));
      await saveDevice({ token, platform: Platform.OS, ...devicePrefs(next) }).catch(() => {});
    } catch {
      // Not allowed (or no network): leave alerts off; they can be turned on in More.
    }
  }, [change]);

  const value = useMemo<Alerts>(() => ({ prefs: prefs ?? DEFAULTS, busy, error, setEnabled, update, markPromptSeen, firstRunPermission, test }), [prefs, busy, error, setEnabled, update, markPromptSeen, firstRunPermission, test]);
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
