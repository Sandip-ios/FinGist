import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { HostInstance } from 'react-native';

type View = HostInstance;

const KEY = 'fingist.tourDone.v1';

export type TourTargetId = 'tabs' | 'region' | 'card' | 'readMore' | 'actions' | 'search' | 'saved' | 'menu';

export interface TourStep {
  target: TourTargetId;
  title: string;
  text: string;
  /** Extra space around the highlighted area. */
  pad?: number;
  radius?: number;
}

export const TOUR_STEPS: TourStep[] = [
  { target: 'tabs', title: 'Pick a topic', text: 'Tap a category, or swipe the news left and right to move between Top stories, Markets, Stocks, Earnings and more.', pad: 4, radius: 12 },
  { target: 'region', title: 'India, Global or both', text: 'Choose which markets you want to follow. You can change it any time.', pad: 6, radius: 20 },
  { target: 'card', title: 'One story, one card', text: 'Read the headline and a 60-word summary. Swipe up for the next story; on the first card, pull down to refresh.', pad: 0, radius: 26 },
  { target: 'readMore', title: 'Want the full story?', text: 'Open the original article from the publisher.', pad: 6, radius: 30 },
  { target: 'actions', title: 'Save or share', text: 'Bookmark stories to read later, or share them with friends.', pad: 6, radius: 30 },
  { target: 'search', title: 'Search & discover', text: 'Find news about any company or topic, and see what is trending today.', pad: 8, radius: 22 },
  { target: 'saved', title: 'Your saved stories', text: 'Everything you bookmark is kept here, on your phone.', pad: 8, radius: 22 },
  { target: 'menu', title: 'Alerts and more', text: 'Turn on the morning market mood, market open update and breaking news alerts. Share FinGist, send feedback and more.', pad: 8, radius: 22 },
];

interface Tour {
  active: boolean;
  step: number;
  /** Components call this with their ref so the tour can find them on screen. */
  register: (id: TourTargetId, ref: View | null) => void;
  target: (id: TourTargetId) => View | null;
  startIfFirstTime: () => void;
  start: () => void;
  next: () => void;
  finish: () => void;
}

const Ctx = createContext<Tour | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const refs = useRef(new Map<TourTargetId, View | null>());
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const checked = useRef(false);

  const register = useCallback((id: TourTargetId, ref: View | null) => { if (ref) refs.current.set(id, ref); }, []);
  const target = useCallback((id: TourTargetId) => refs.current.get(id) ?? null, []);
  const start = useCallback(() => { setStep(0); setActive(true); }, []);
  const finish = useCallback(() => { setActive(false); AsyncStorage.setItem(KEY, '1').catch(() => {}); }, []);
  const next = useCallback(() => setStep((s) => { if (s + 1 >= TOUR_STEPS.length) { finish(); return s; } return s + 1; }), [finish]);
  const startIfFirstTime = useCallback(() => {
    if (checked.current) return;
    checked.current = true;
    AsyncStorage.getItem(KEY).then((v) => { if (!v) setTimeout(start, 600); }).catch(() => {});
  }, [start]);

  const value = useMemo<Tour>(() => ({ active, step, register, target, startIfFirstTime, start, next, finish }), [active, step, register, target, startIfFirstTime, start, next, finish]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTour(): Tour {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTour must be used inside TourProvider');
  return v;
}

/** Ref callback that registers a view as a tour target. */
export function useTourRef(id: TourTargetId) {
  const { register } = useTour();
  return useCallback((r: View | null) => register(id, r), [id, register]);
}
