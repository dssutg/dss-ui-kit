import { useRef } from 'react';

type HookWithDependencies<C, R> = (callback: C, deps: unknown[]) => R;

export function useGranularHook<T extends HookWithDependencies<C, ReturnType<T>>, C>(
  hook: T,
  callback: C,
  primaryDeps: unknown[],
  secondaryDeps: unknown[],
) {
  const ref = useRef<unknown[]>();

  if (
    !ref.current ||
    !primaryDeps.every((dependency, index) => Object.is(dependency, ref.current![index]))
  ) {
    ref.current = [...primaryDeps, ...secondaryDeps];
  }

  return hook(callback, ref.current);
}
