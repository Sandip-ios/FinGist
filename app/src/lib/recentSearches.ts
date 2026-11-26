import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'fingist.recentSearches.v1';
const MAX = 8;

/** Last searches, kept on the phone. */
export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) setRecent(JSON.parse(v) as string[]); }).catch(() => {});
  }, []);
  const save = (list: string[]) => { setRecent(list); AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {}); };
  const add = useCallback((q: string) => {
    const v = q.trim();
    if (v.length < 2) return;
    setRecent((prev) => {
      const list = [v, ...prev.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, MAX);
      AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
      return list;
    });
  }, []);
  const remove = useCallback((q: string) => setRecent((prev) => { const list = prev.filter((x) => x !== q); AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {}); return list; }), []);
  const clear = useCallback(() => save([]), []);
  return { recent, add, remove, clear };
}
