import { useRef } from 'react';

/**
 * The shape of the React hooks this module wraps: a callback and a dependency list.
 */
export type HookWithDependencies<C, R> = (callback: C, deps: unknown[]) => R;

/**
 * Builds a hook with the same two dependency lists as {@link useGranularEffect}, out of another hook.
 *
 * The hook must accept a dependency list as its second argument — `useEffect`, `useMemo`, `useCallback`
 * — because that is how the dependencies are passed through. This is the mechanism behind
 * {@link useGranularEffect}, which is what most callers want; reach for this one to wrap a hook this
 * library does not export.
 */
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
