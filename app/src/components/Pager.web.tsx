import { Children, forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';
import type { PagerHandle } from './Pager';

/** Browser preview only: vertical paging ScrollView (react-native-pager-view has no web support). */
export const Pager = forwardRef<PagerHandle, { children: React.ReactNode; onPageSelected: (e: { nativeEvent: { position: number } }) => void }>(
  function Pager({ children, onPageSelected }, ref) {
    const [h, setH] = useState(0);
    const sv = useRef<ScrollViewInstance>(null);
    const last = useRef(0);
    useImperativeHandle(ref, () => ({
      setPage: (p: number) => sv.current?.scrollTo({ y: p * h, animated: true }),
      setPageWithoutAnimation: (p: number) => sv.current?.scrollTo({ y: p * h, animated: false }),
    }));
    return (
      <View style={{ flex: 1 }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
        {h > 0 && (
          <ScrollView
            ref={sv}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={64}
            onScroll={(e) => {
              const p = Math.round(e.nativeEvent.contentOffset.y / h);
              if (p !== last.current) { last.current = p; onPageSelected({ nativeEvent: { position: p } }); }
            }}
          >
            {Children.map(children, (c) => <View style={{ height: h }}>{c}</View>)}
          </ScrollView>
        )}
      </View>
    );
  },
);
