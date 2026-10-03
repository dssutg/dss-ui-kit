import { useEffect, useState } from 'react';

/**
 * Whether something should be shown yet: true only once `trigger` has been true for the given time.
 *
 * For a control that should not appear the moment it becomes relevant — a spinner shown while a
 * request is already on its way. Hiding again is immediate, so nothing lingers after the trigger is
 * gone.
 */
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
