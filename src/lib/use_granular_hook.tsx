import { useRef } from 'react';

export type HookWithDependencies<C, R> = (callback: C, deps: unknown[]) => R;

export function useGranularHook<T extends HookWithDependencies<C, ReturnType<T>>, C>(
  hook: T,
  callback: C,
  primaryDeps: unknown[],
  secondaryDeps: unknown[],
) {
  const ref = useRef<unknown[] | undefined>(undefined);
  const current = ref.current;

  if (
    current === undefined ||
    !primaryDeps.every((dependency, index) => Object.is(dependency, current[index]))
  ) {
    const next = [...primaryDeps, ...secondaryDeps];
    ref.current = next;

    return hook(callback, next);
  }

  return hook(callback, current);
}
