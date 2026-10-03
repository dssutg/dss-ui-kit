import type { TargetedEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForceUpdate } from '@/lib/use_force_update';
import { useGranularEffect } from '@/lib/use_granular_effect';
import { useTimeout } from '@/lib/use_timeout';

/**
 * What a {@link VirtualizedList} row renderer is called with.
 *
 * `style` is the position and size of this one row and must be applied to the row's outermost element:
 * the list does not wrap what the renderer returns, because a wrapper would break a row that is a
 * table row.
 */
export interface VirtualizedListRowRendererProps {
  index: number;
  style: React.CSSProperties;
}

/**
 * A fixed-height list that renders only the rows in view.
 *
 * `rowRenderer` is called for the visible rows with an absolutely positioned `style`, so a row that
 * is not rendered costs nothing but its height. Fixed item height is what makes the offset
 * arithmetic possible; a list whose rows vary in height needs a measurement pass this does not do.
 */
/**
 * What {@link VirtualizedList} takes.
 *
 * `itemCount` and `itemSize` are the whole geometry — a list of ten thousand rows of a known height
 * needs nothing else, and no measurement pass. `containerRef` is required rather than created here
 * because the caller usually needs the scrolling element anyway, to observe it or to scroll it.
 */
export interface VirtualizedListProps {
  readonly itemCount: number;
  readonly itemSize: number;
  readonly rowRenderer: (props: VirtualizedListRowRendererProps) => React.ReactNode;
  readonly width: number | string;
  readonly height: number | string;
  // The handler is attached to the scrolling div, so it is that element's event it receives.
  readonly onScroll?: (event: TargetedEvent<HTMLDivElement, Event>) => void;
  /** Rows rendered beyond the viewport, to cover a fast scroll before the next paint. */
  readonly overScanCount?: number | undefined;
  readonly containerRef: React.MutableRefObject<HTMLDivElement | null>;
}

/**
 * A list that renders only the rows in view, for a count a caller would rather not put in the DOM.
 *
 * It renders a spacer of the full scroll height and positions the visible rows itself, so the scroll
 * geometry is correct and the DOM is not. Rows are therefore fixed height: a row taller or shorter
 * than `itemSize` makes the scroll position wrong in a way this component cannot detect.
 *
 * {@link useVirtualizedList} is the same arithmetic without the markup, for a caller whose rows are
 * not `<div>`s.
 */
export function VirtualizedList({
  itemCount,
  itemSize,
  rowRenderer,
  width,
  height,
  onScroll,
  overScanCount,
  containerRef,
}: VirtualizedListProps) {
  const { startIndex, endIndex, getItemStyle } = useVirtualizedList({
    // The default lives in the hook, so an absent count is passed on as absent.
    ref: containerRef,
    itemCount,
    itemSize,
    overScanCount,
  });

  const forceUpdate = useForceUpdate();

  // Make sure references get propagated to hooks
  useTimeout(forceUpdate, 0);

  return (
    <div
      ref={containerRef}
      style={{ width, height, overflow: 'auto', position: 'relative' }}
      onScroll={onScroll}
    >
      <div style={{ height: itemCount * itemSize, position: 'relative' }}>
        {Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => {
          const index = startIndex + offset;

          return rowRenderer({ index, style: getItemStyle(index) });
        })}
      </div>
    </div>
  );
}

/**
 * What {@link useVirtualizedList} needs to work out which rows are visible.
 *
 * `ref` is optional here and required by {@link VirtualizedList}: the hook falls back to listening on
 * the window when there is no element to measure, which is right for a page and wrong for a panel.
 */
export interface UseVirtualizedListOptions {
  readonly itemCount: number;
  readonly itemSize: number;
  readonly overScanCount?: number | undefined;
  /** The scrolling element to measure. Pass one to scroll it from outside the hook. */
  readonly ref?: React.MutableRefObject<HTMLDivElement | null> | undefined;
}

/** What {@link useVirtualizedList} reports about the visible range. */
export interface UseVirtualizedListResult {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly containerRef: React.MutableRefObject<HTMLDivElement | null>;
  /** The absolute position of a row, for a caller rendering it itself. */
  readonly getItemStyle: (index: number) => React.CSSProperties;
}

/**
 * The visible range of a fixed-height list, recomputed on scroll and on resize.
 *
 * Use this to render rows in something other than {@link VirtualizedList} — a table body, say — where
 * the scrolling element is not the list's own container. Attach `containerRef` to that element.
 */
export function useVirtualizedList({
  itemCount,
  itemSize,
  overScanCount = 0,
  ref,
}: UseVirtualizedListOptions): UseVirtualizedListResult {
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  let actualRef = containerRef;
  if (ref !== undefined) {
    actualRef = ref;
  }

  const actualContainerElement = actualRef.current;

  const updateVisibleItems = useCallback(() => {
    if (!actualContainerElement) {
      return;
    }

    const { scrollTop, clientHeight } = actualContainerElement;

    let startIndex = Math.floor(scrollTop / itemSize) - overScanCount;

    if (startIndex < 0) {
      startIndex = 0;
    }

    // Prevent the element change their look based on if they're odd or even.
    // Make the lower boundary always even number to preserve the odd-even order
    // when scrolling. Even position is becase zero is even, so when the start of the
    // list is visible, the order is still preserved.
    if (startIndex % 2 !== 0) {
      startIndex = startIndex - 1;
    }

    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + clientHeight) / itemSize) + overScanCount - 1,
    );

    setStartIndex(startIndex);
    setEndIndex(endIndex);
  }, [actualContainerElement, itemCount, itemSize, overScanCount]);

  useGranularEffect(
    () => {
      // Initial calculation
      updateVisibleItems();

      function handleScroll() {
        if (overScanCount < itemCount) {
          updateVisibleItems();
        }
      }

      actualContainerElement?.addEventListener('scroll', handleScroll);

      return () => {
        actualContainerElement?.removeEventListener('scroll', handleScroll);
      };
    },
    [itemCount, itemSize, overScanCount, actualContainerElement, updateVisibleItems],
    [],
  );

  useEffect(() => {
    // lock element in closure
    const element = actualContainerElement;

    if (element === null) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(updateVisibleItems);

    resizeObserver.observe(element);

    return () => {
      resizeObserver.unobserve(element);
    };
  }, [actualContainerElement, updateVisibleItems]);

  const getItemStyle = useCallback(
    (index: number): React.CSSProperties => ({
      position: 'absolute',
      top: index * itemSize,
      height: itemSize,
      boxSizing: 'border-box',
      width: '100%',
    }),
    [itemSize],
  );

  return {
    startIndex,
    endIndex,
    containerRef: ref !== undefined ? ref : containerRef,
    getItemStyle,
  };
}
