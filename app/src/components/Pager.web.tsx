import { Children, forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';
import type { PagerHandle, PagerProps } from './Pager';

/** Browser preview only: horizontal paging ScrollView (react-native-pager-view has no web support). */
export const Pager = forwardRef<PagerHandle, PagerProps>(function Pager({ children, onPageSelected }, ref) {
  const [w, setW] = useState(0);
  const sv = useRef<ScrollViewInstance>(null);
  const last = useRef(0);
  useImperativeHandle(ref, () => ({
    setPage: (p: number) => sv.current?.scrollTo({ x: p * w, animated: true }),
    setPageWithoutAnimation: (p: number) => sv.current?.scrollTo({ x: p * w, animated: false }),
  }));
  return (
    <View style={{ flex: 1 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <ScrollView
          ref={sv}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={64}
          onScroll={(e) => {
            const p = Math.round(e.nativeEvent.contentOffset.x / w);
            if (p !== last.current) { last.current = p; onPageSelected(p); }
          }}
        >
          {Children.map(children, (c) => <View style={{ width: w, flex: 1 }}>{c}</View>)}
        </ScrollView>
      )}
    </View>
  );
});
