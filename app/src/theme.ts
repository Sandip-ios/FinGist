import { useColorScheme } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';
import type { Relevance, Sentiment } from './lib/types';

export const BRAND = {
  navy: '#01208e',
  blue: '#1d4ed8',
  lime: '#9be22d',
};

const light = {
  bg: '#eef1f7',
  card: '#ffffff',
  text: '#0f172a',
  textMuted: '#55627a',
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

export function useTheme(): Theme {
  const isDark = useColorScheme() === 'dark';
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

export const SENTIMENT: Record<Sentiment, { label: string; icon: IconName; color: string }> = {
  positive: { label: 'Positive', icon: 'arrow-up-circle', color: '#16a34a' },
  negative: { label: 'Negative', icon: 'arrow-down-circle', color: '#dc2626' },
  neutral: { label: 'Neutral', icon: 'remove-circle', color: '#64748b' },
  mixed: { label: 'Mixed', icon: 'swap-vertical', color: '#d97706' },
};

export const RELEVANCE: Record<Relevance, { label: string; dots: number }> = {
  high: { label: 'High relevance', dots: 3 },
  medium: { label: 'Medium relevance', dots: 2 },
  low: { label: 'Low relevance', dots: 1 },
};
