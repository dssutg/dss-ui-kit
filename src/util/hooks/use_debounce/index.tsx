import { useEffect, useRef } from 'react';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';
import { useTimeout } from '@/util/hooks/use_timeout';

/**
 * Calls a callback once the tracked state has stopped changing for `delay` milliseconds.
 *
 * `dependencies` is what is tracked, and it is the caller's rather than an automatic comparison of
 * everything the callback closes over: a debounce that watched the callback would restart on every
 * render, because a callback is a new function every render. Pass `null` as the delay to never call,
 * which is how a caller disables a debounced action without removing it.
 *
 * `shouldCallOnUnmount` exists for a caller that would otherwise lose the last change — a search field
 * unmounted while its debounce was still pending.
 */
export function useDebounce(
  callback: () => void,
  delay: number | null,
  dependencies: unknown[],
  {
    shouldCallOnUnmount = false,
  }: {
    readonly shouldCallOnUnmount?: boolean | undefined;
  } = {},
) {
  const { reset, clear } = useTimeout(callback, delay);
  const hasMounted = useRef(false);

  const callbackRef = useRef<() => void>();

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (hasMounted.current) {
      reset();
    } else {
      // Set to true after the first render
      hasMounted.current = true;
    }
  }, [...dependencies, reset]);

  useGranularEffect(
    () => {
      clear();
    },
    [],
    [clear],
  );

  useGranularEffect(
    () => {
      return () => {
        if (shouldCallOnUnmount) {
          callbackRef.current?.();
        }
      };
    },
    [],
    [shouldCallOnUnmount],
  );

  return { reset, clear };
}
