import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';
import type { Relevance, Sentiment } from './lib/types';

export const BRAND = {
  navy: '#01208e',
  blue: '#1d4ed8',
  lime: '#9be22d',
};

const light = {
  bg: '#eef2f8',
  card: '#ffffff',
  text: '#0b1530',
  textBody: '#334155',
  textMuted: '#64748b',
  border: '#e2e8f0',
  chip: '#eef2ff',
  chipText: '#1e3a8a',
  headerBg: '#ffffff',
  tabActive: BRAND.navy,
  tabActiveText: '#ffffff',
  tabIdle: '#e8ecf5',
  tabIdleText: '#334155',
  shimmer: '#e5e9f2',
};

const dark: typeof light = {
  bg: '#060b18',
  card: '#101827',
  text: '#f1f5f9',
  textBody: '#cbd5e1',
  textMuted: '#94a3b8',
  border: '#1f2a3d',
  chip: '#1b2744',
  chipText: '#bfd3ff',
  headerBg: '#0b1222',
  tabActive: BRAND.lime,
  tabActiveText: '#0b1222',
  tabIdle: '#18223a',
  tabIdleText: '#cbd5e1',
  shimmer: '#1c2638',
};

export type Theme = typeof light & { isDark: boolean };

export type ThemeMode = 'system' | 'light' | 'dark';

/** The person's Appearance choice (More → Appearance); 'system' follows the phone. */
export const ThemeModeContext = createContext<{ mode: ThemeMode; setMode: (m: ThemeMode) => void }>({ mode: 'system', setMode: () => {} });
export const useThemeMode = () => useContext(ThemeModeContext);

export function useTheme(): Theme {
  const system = useColorScheme();
  const { mode } = useContext(ThemeModeContext);
  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
  return { ...(isDark ? dark : light), isDark };
}

type IconName = keyof typeof Ionicons.glyphMap;

export const CATEGORIES: { id: string; label: string; icon: IconName; colors: [string, string] }[] = [
  { id: 'markets', label: 'Markets', icon: 'stats-chart', colors: ['#1d4ed8', '#01208e'] },
  { id: 'stocks', label: 'Stocks', icon: 'trending-up', colors: ['#0d9488', '#065f46'] },
  { id: 'earnings', label: 'Earnings', icon: 'cash', colors: ['#16a34a', '#14532d'] },
  { id: 'ipo', label: 'IPO', icon: 'rocket', colors: ['#db2777', '#831843'] },
  { id: 'economy', label: 'Economy', icon: 'globe', colors: ['#7c3aed', '#3b0764'] },
  { id: 'policy', label: 'Policy & RBI', icon: 'business', colors: ['#475569', '#0f172a'] },
  { id: 'banking', label: 'Banking', icon: 'card', colors: ['#0284c7', '#0c4a6e'] },
  { id: 'global', label: 'Global', icon: 'earth', colors: ['#2563eb', '#1e1b4b'] },
  { id: 'commodities', label: 'Commodities', icon: 'flame', colors: ['#d97706', '#78350f'] },
  { id: 'currency', label: 'Currency', icon: 'swap-horizontal', colors: ['#059669', '#064e3b'] },
  { id: 'corporate_action', label: 'Corporate', icon: 'briefcase', colors: ['#9333ea', '#4c1d95'] },
  { id: 'mutual_funds', label: 'Mutual Funds', icon: 'pie-chart', colors: ['#0891b2', '#164e63'] },
  { id: 'crypto', label: 'Crypto', icon: 'logo-bitcoin', colors: ['#f59e0b', '#7c2d12'] },
  { id: 'other', label: 'Business', icon: 'newspaper', colors: ['#334155', '#0f172a'] },
];

export function categoryMeta(id: string | null) {
  return CATEGORIES.find((c) => c.id === id) ?? { id: 'news', label: 'News', icon: 'newspaper' as IconName, colors: ['#1e3a8a', '#01208e'] as [string, string] };
}

export const SENTIMENT: Record<Sentiment, { label: string; icon: IconName; color: string; bg: string; bgDark: string }> = {
  positive: { label: 'Positive', icon: 'trending-up', color: '#15803d', bg: '#dcfce7', bgDark: 'rgba(34,197,94,0.16)' },
  negative: { label: 'Negative', icon: 'trending-down', color: '#b91c1c', bg: '#fee2e2', bgDark: 'rgba(239,68,68,0.16)' },
  neutral: { label: 'Neutral', icon: 'remove', color: '#475569', bg: '#eef2f6', bgDark: 'rgba(148,163,184,0.16)' },
  mixed: { label: 'Mixed', icon: 'swap-vertical', color: '#b45309', bg: '#fef3c7', bgDark: 'rgba(245,158,11,0.16)' },
};

/** A stable colour per news source, used for its small initial badge. */
export function sourceColor(name: string): string {
  const palette = ['#1d4ed8', '#0f766e', '#7c3aed', '#be123c', '#c2410c', '#0369a1', '#4d7c0f', '#a21caf'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length]!;
}

export const RELEVANCE: Record<Relevance, { label: string; dots: number }> = {
  high: { label: 'High relevance', dots: 3 },
  medium: { label: 'Medium relevance', dots: 2 },
  low: { label: 'Low relevance', dots: 1 },
};
