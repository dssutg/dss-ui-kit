import { useEffect, useState } from 'react';

export function useDelayedVisibility(trigger: boolean, delayMilliseconds: number) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!trigger) {
      setIsVisible(false);

      return undefined;
    }

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delayMilliseconds);

    return () => {
      clearTimeout(timer);
      setIsVisible(false);
    };
  }, [trigger, delayMilliseconds]);

  return isVisible;
}
