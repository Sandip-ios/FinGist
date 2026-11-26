import { Animated } from 'react-native';

/**
 * Inshorts-style stack: while the next card slides up over this one, this card stays in place,
 * shrinks slightly and fades, so the new story appears to land on top of the old one.
 */
export function StackedCard({ index, height, scrollY, children, last = false }: { index: number; height: number; scrollY: Animated.Value; children: React.ReactNode; last?: boolean }) {
  // The last card has nothing to slide over it, so it simply scrolls away.
  if (last) return <Animated.View style={{ height }}>{children}</Animated.View>;
  const start = index * height;
  const range = [start - height, start, start + height];
  const translateY = scrollY.interpolate({ inputRange: range, outputRange: [0, 0, height], extrapolate: 'clamp' });
  const scale = scrollY.interpolate({ inputRange: range, outputRange: [1, 1, 0.92], extrapolate: 'clamp' });
  const opacity = scrollY.interpolate({ inputRange: range, outputRange: [1, 1, 0.5], extrapolate: 'clamp' });
  return <Animated.View style={{ height, opacity, transform: [{ translateY }, { scale }] }}>{children}</Animated.View>;
}

