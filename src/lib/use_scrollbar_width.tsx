import { useEffect, useState } from 'react';

/**
 * How wide the scrollbar is in this browser and theme, re-measured on resize.
 *
 * Zero until the first measurement. A caller laying out a panel against the viewport needs it because
 * `width: 100%` of the document includes the scrollbar and `100vw` does not, so a sticky footer sized
 * with `vw` is scrollbar-width too wide.
 */
export function useScrollbarWidth() {
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  useEffect(() => {
    const measureScrollbarWidth = () => {
      setScrollbarWidth(getScrollbarWidth());
    };

    measureScrollbarWidth();

    // Handle window resize
    window.addEventListener('resize', measureScrollbarWidth);

    return () => window.removeEventListener('resize', measureScrollbarWidth);
  }, []);

  return scrollbarWidth;
}

/**
 * Measures the scrollbar width by rendering an element that always has one.
 *
 * The only way to measure it: it is the browser's own element, with a width that is zero on an overlay
 * scrollbar system and 15 pixels on a classic one.
 */
export function getScrollbarWidth() {
  const div = document.createElement('div');
  div.style.overflow = 'scroll'; // force scrollbar
  div.style.width = '100px';
  div.style.height = '100px';
  document.body.appendChild(div);

  const inner = document.createElement('div');
  inner.style.width = '100%';
  inner.style.height = '100%';
  div.appendChild(inner);

  const width = div.offsetWidth - inner.offsetWidth;

  div.remove();

  return width;
}
