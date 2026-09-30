import { useCallback, useEffect, useRef } from 'react';
import { useGranularEffect } from '@/lib/use_granular_effect';

export function useTimeout(callback: () => void, delay: number | null) {
  const callbackRef = useRef<() => void>(callback);
  const timeoutRef = useRef<number | undefined>(undefined);

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
