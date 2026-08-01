import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

// ---------------------------------------------------------------------------
// Scroll-to-end consent gates, and the case that keeps breaking them.
//
// **A gate that cannot be satisfied locks the player out of the app.** There
// are two of these: the legal gate blocks the entire funnel, and the safety
// card blocks starting any round. Both must accept "there was nothing to
// scroll" as satisfied, because on a wide or tall viewport the content fits and
// `onScroll` never fires.
//
// This is the fourth time this bug has been fixed. The history is worth keeping
// because each fix was correct about the previous cause and wrong about the
// next one:
//
//   1. Session 1: the safety card's Modal would not scroll at all.
//   2. Session 2: the fits-entirely guard lived inside `onContentSizeChange`
//      and read `viewerH` while it was still 0, so it never re-evaluated.
//      Moved into an effect keyed on both measurements.
//   3. Session 3: that effect never ran either, because on
//      **react-native-web neither `onLayout` nor `onContentSizeChange` fires
//      on a ScrollView**, so both values stayed 0 forever. Confirmed by
//      logging: `viewer=0 content=0`.
//
// So the web path cannot use the React Native measurement callbacks at all. It
// reads the DOM node instead, which is the thing that actually knows whether
// the content overflows. Native keeps the callback path, which does work there.
//
// If a third gate is ever added, use this hook rather than reimplementing it.
// ---------------------------------------------------------------------------

/** How close to the bottom counts as the end, in px. */
const END_SLOP = 40;
/** Content within this of the viewport height counts as "fits entirely". */
const FIT_SLOP = 8;

export interface ScrollGate {
  reachedEnd: boolean;
  /** Spread onto the ScrollView. */
  scrollProps: {
    ref: (node: unknown) => void;
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onContentSizeChange: (w: number, h: number) => void;
    onLayout: (e: { nativeEvent: { layout: { height: number } } }) => void;
    scrollEventThrottle: number;
  };
}

export function useScrollGate(): ScrollGate {
  const [reachedEnd, setReachedEnd] = useState(false);
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const nodeRef = useRef<any>(null);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - END_SLOP) {
      setReachedEnd(true);
    }
  }, []);

  // Native path. Kept because it is correct there, and because a future RN Web
  // release fixing its callbacks would make this the primary path again.
  useEffect(() => {
    if (viewH > 0 && contentH > 0 && contentH <= viewH + FIT_SLOP) setReachedEnd(true);
  }, [viewH, contentH]);

  // Web path. Polls briefly rather than measuring once: fonts, images, and the
  // FadeIn animations all change the content height after first paint, and a
  // single measurement taken too early reports a shorter page than the player
  // will actually see, which would satisfy the gate when it should not.
  useEffect(() => {
    if (Platform.OS !== 'web' || reachedEnd) return;
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      const raw = nodeRef.current;
      const el: HTMLElement | null =
        raw && typeof raw.getScrollableNode === 'function' ? raw.getScrollableNode() : raw;
      if (el && typeof el.scrollHeight === 'number' && el.clientHeight > 0) {
        if (el.scrollHeight <= el.clientHeight + FIT_SLOP) setReachedEnd(true);
      }
      // About two seconds. Past that the layout has settled, and if it still
      // overflows then scrolling is genuinely required, which is the gate
      // working as intended.
      if (tries > 8) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [reachedEnd]);

  return {
    reachedEnd,
    scrollProps: {
      ref: (node: unknown) => {
        nodeRef.current = node;
      },
      onScroll,
      onContentSizeChange: (_w: number, h: number) => setContentH((p) => Math.max(p, h)),
      onLayout: (e) => setViewH(e.nativeEvent.layout.height),
      scrollEventThrottle: 16,
    },
  };
}
