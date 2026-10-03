import { useCallback, useEffect, useRef } from 'react';
import { useGranularEffect } from '@/lib/hooks/use_granular_effect';

/**
 * Runs a callback once, `delay` milliseconds after it was last set.
 *
 * Returns `set` and `clear`, which is what makes it usable as the mechanism under a debounce: a
 * debounce restarts the timer on every change and cancels it on unmount, neither of which an effect
 * that schedules a timeout can do. `delay` is `null` to never run it.
 */
export function useTimeout(callback: () => void, delay: number | null) {
  const callbackRef = useRef<() => void>(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const set = useCallback(() => {
    if (delay !== null) {
      timeoutRef.current = setTimeout(() => callbackRef.current(), delay);
    }
  }, [delay]);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useGranularEffect(
    () => {
      set();
      return clear;
    },
    [delay, set, clear],
    [],
  );

  const reset = useCallback(() => {
    clear();
    set();
  }, [clear, set]);

  return { reset, clear };
}
