import { useEffect, useRef } from 'react';
import { useGranularEffect } from './use_granular_effect';
import { useTimeout } from './use_timeout';

// For calling a function when the tracked state stopped changing after a timeout
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
