import { forwardRef } from 'react';
import PagerView from 'react-native-pager-view';

/** Vertical full-screen pager (native). See Pager.web.tsx for the browser preview. */
export type PagerHandle = Pick<PagerView, 'setPage' | 'setPageWithoutAnimation'>;

export const Pager = forwardRef<PagerHandle, { children: React.ReactNode; onPageSelected: (e: { nativeEvent: { position: number } }) => void }>(
  function Pager({ children, onPageSelected }, ref) {
    return (
      <PagerView ref={ref as React.Ref<PagerView>} style={{ flex: 1 }} orientation="vertical" initialPage={0} offscreenPageLimit={2} onPageSelected={onPageSelected}>
        {children}
      </PagerView>
    );
  },
);
