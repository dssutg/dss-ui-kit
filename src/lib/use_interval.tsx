import { useEffect, useRef } from 'react';

/**
 * Runs a callback every `delay` milliseconds, with the latest callback and a clean timer.
 *
 * `delay` is `null` to stop, which pauses the interval without unmounting anything. `deps` exists for
 * the interval itself: a callback whose period depends on something has to restart the timer when that
 * something changes, and the timer cannot be restarted by a callback it holds in a ref.
 */
export function useInterval(callback: () => void, delay: number | null, deps?: unknown[]) {
  const savedCallback = useRef<() => void>();

  // Store the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback, ...(deps ?? [])]);

  // Set up the interval
  useEffect(() => {
    function tick() {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }

    if (delay !== null) {
      const id = setInterval(tick, delay);

      return () => clearInterval(id);
    }

    return undefined;
  }, [delay, ...(deps ?? [])]);
}

/**
 * {@link useInterval}, but the first call happens immediately rather than after the first delay.
 *
 * For a poll whose first result is wanted now: waiting a whole period before the first call is a
 * second of a stale panel on every mount.
 */
export function useImmediateInterval(callback: () => void, delay: number | null, deps?: unknown[]) {
  const savedCallback = useRef<() => void>();

  // Store the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback, ...(deps ?? [])]);

  // Set up the interval
  useEffect(() => {
    function tick() {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }

    if (delay !== null) {
      tick(); // call the tick immediately

      const id = setInterval(tick, delay);

      return () => clearInterval(id);
    }

    return undefined;
  }, [delay, ...(deps ?? [])]);
}
