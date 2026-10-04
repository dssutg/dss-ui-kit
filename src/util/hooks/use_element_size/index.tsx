import { useEffect, useState } from 'react';

/**
 * The size of an element, measured on mount and on every resize, from a `ResizeObserver`.
 *
 * The size starts at zero, because nothing has been measured before the first effect runs. The value
 * is a content-box size as the observer reports it, which is the size to draw a canvas at and not the
 * size of the element with its padding.
 */
export function useElementSize<T extends HTMLElement>(
  elementRef: React.RefObject<T | null>,
): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (elementRef.current === null) {
      return;
    }

    const boundingRect = elementRef.current.getBoundingClientRect();

    setSize({
      width: boundingRect.width,
      height: boundingRect.height,
    });

    const resizeObserver = new ResizeObserver((entries) => {
      const [wrapperEntry] = entries;

      if (wrapperEntry === undefined) {
        return;
      }

      const { width, height } = wrapperEntry.contentRect;

      setSize({ width, height });
    });

    resizeObserver.observe(elementRef.current);
  }, [elementRef.current]);

  return size;
}
