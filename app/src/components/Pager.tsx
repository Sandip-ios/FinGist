import { forwardRef } from 'react';
import PagerView from 'react-native-pager-view';

/** Horizontal pager used to swipe between categories (native). See Pager.web.tsx for the browser preview. */
export type PagerHandle = { setPage: (p: number) => void; setPageWithoutAnimation: (p: number) => void };

export interface PagerProps {
  children: React.ReactNode;
  initialPage?: number;
  onPageSelected: (page: number) => void;
}

export const Pager = forwardRef<PagerHandle, PagerProps>(function Pager({ children, initialPage = 0, onPageSelected }, ref) {
  return (
    <PagerView
      ref={ref as unknown as React.Ref<PagerView>}
      style={{ flex: 1 }}
      orientation="horizontal"
      initialPage={initialPage}
      offscreenPageLimit={1}
      onPageSelected={(e) => onPageSelected(e.nativeEvent.position)}
    >
      {children}
    </PagerView>
  );
});
