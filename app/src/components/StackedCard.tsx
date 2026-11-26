import { Animated } from 'react-native';

/**
 * Inshorts-style stack: while the next card slides up over this one, this card stays in place,
 * shrinks slightly and fades, so the new story appears to land on top of the old one.
 */
export function StackedCard({ index, height, scrollY, children }: { index: number; height: number; scrollY: Animated.Value; children: React.ReactNode }) {
  const start = index * height;
  const range = [start - height, start, start + height];
  const translateY = scrollY.interpolate({ inputRange: range, outputRange: [0, 0, height], extrapolate: 'clamp' });
  const scale = scrollY.interpolate({ inputRange: range, outputRange: [1, 1, 0.9], extrapolate: 'clamp' });
  const opacity = scrollY.interpolate({ inputRange: range, outputRange: [1, 1, 0.35], extrapolate: 'clamp' });
  return <Animated.View style={{ height, opacity, transform: [{ translateY }, { scale }] }}>{children}</Animated.View>;
}

