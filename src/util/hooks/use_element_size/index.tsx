// SPDX-License-Identifier: MIT
// The size of an element, on mount and on resize.

import { useLayoutEffect, useState } from 'react';

/**
 * The size of an element, measured on mount and on every resize, from a `ResizeObserver`.
 *
 * The size starts at zero, because nothing has been measured before the first effect runs. The value
 * is a content-box size as the observer reports it, which is the size to draw a canvas at and not the
 * size of the element with its padding.
 *
 * A ref is attached after the render that produced it and moved by a later render of this component
 * when the element is swapped, so an `elementRef.current` read during render is always the value of
 * the render before — null on the mount. The element is copied into state by a layout effect that
 * runs after every render of this component, and the observer effect keys off that state: its
 * cleanup runs exactly when the element changes or the component goes away, and never for a render
 * that left the element alone.
 */
export function useElementSize<T extends HTMLElement>(
  elementRef: React.RefObject<T | null>,
): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [element, setElement] = useState<T | null>(null);

  useLayoutEffect(() => {
    const attached = elementRef.current;

    if (attached !== element) {
      setElement(attached);
    }
  });

  useLayoutEffect(() => {
    if (element === null) {
      return;
    }

    const boundingRect = element.getBoundingClientRect();

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

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [element]);

  return size;
}
