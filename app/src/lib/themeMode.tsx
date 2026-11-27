import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeModeContext, type ThemeMode } from '../theme';

const KEY = 'fingist.themeMode.v1';

/** Remembers the Appearance choice (System / Light / Dark) on the phone. */
export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setModeState(v); })
      .catch(() => {});
  }, []);
  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}
