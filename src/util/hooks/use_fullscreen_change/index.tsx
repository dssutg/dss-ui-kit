import { useEffect, useRef } from 'react';

/** Called with whether the document is in fullscreen. */
export type OnFullScreenChangeCallback = (isFullScreen: boolean) => void;

/**
 * Reports whether the document is in fullscreen, now and on every change.
 *
 * The document's own state rather than the element's: a caller whose chart goes fullscreen has to
 * redraw when it leaves again whatever element went in, and the browser reports that on the document.
 */
export function useFullScreenChange(onFullScreenChange: OnFullScreenChangeCallback) {
  const callbackRef = useRef<OnFullScreenChangeCallback>(onFullScreenChange);

  useEffect(() => {
    callbackRef.current = onFullScreenChange;
  }, [onFullScreenChange]);

  useEffect(() => {
    const handleFullScreenChange = () => {
      const isFullScreen = Boolean(document.fullscreenElement);

      callbackRef.current(isFullScreen);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);
}
