import { Animated } from 'react-native';

/**
 * Card transition while swiping: the card you are leaving moves away with your finger and
 * shrinks and fades slightly, and the next card grows into place. Cards never overlap, so
 * the previous story can never show through the current one.
 */
export function StackedCard({ index, height, scrollY, children }: { index: number; height: number; scrollY: Animated.Value; children: React.ReactNode; last?: boolean }) {
  const start = index * height;
  const range = [start - height, start, start + height];
  const scale = scrollY.interpolate({ inputRange: range, outputRange: [0.96, 1, 0.94], extrapolate: 'clamp' });
  const opacity = scrollY.interpolate({ inputRange: range, outputRange: [0.85, 1, 0.6], extrapolate: 'clamp' });
  return <Animated.View style={{ height, opacity, transform: [{ scale }] }}>{children}</Animated.View>;
}
