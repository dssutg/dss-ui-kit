import { useEffect, useState } from 'react';

/**
 * The window's inner size, updated on resize.
 *
 * The size is read during the first render, so it is correct immediately rather than after a resize
 * that may never come. This is the window and not the screen: a caller laying out against the space an
 * application actually has wants the inner size.
 */
export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    function handleResize() {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}
