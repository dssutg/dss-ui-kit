import { useEffect, useRef } from 'react';

type OnFullScreenChangeCallback = (isFullScreen: boolean) => void;

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
