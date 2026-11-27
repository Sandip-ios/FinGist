import { View, type ViewProps } from 'react-native';

/**
 * List cell with a fixed stacking order: a later story is always drawn above an earlier one.
 * Without this, the order depends on when cells were created while scrolling, and a fading
 * previous card could end up drawn on top of the current card.
 */
export function StackedCell({ index, style, ...rest }: ViewProps & { index: number }) {
  return <View {...rest} style={[style, { zIndex: index, elevation: 0 }]} />;
}
