/**
 * Collapses a burst of calls into the last one, run after a quiet period of `delay`.
 *
 * The quiet period restarts on every call, so trailing calls push the timer back rather than queue
 * behind it — the behaviour resizers and search inputs need, where only the final state matters.
 * There is no cancel or flush handle by design: the only way to stop a pending call is another
 * (empty) call, and a component that must not fire after unmount should reach for the hook
 * counterpart (`useDebounce`), which owns the lifecycle. The returned function is also not the
 * wrapped callback under another name — its `this` is the debounced wrapper's own, so the original
 * `this` must be handed through the explicit `thisObject` argument.
 */
export function debounce<T extends (...args: readonly unknown[]) => void>(
  callback: T,
  delay: number,
): (thisObject: unknown, ...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (thisObject: unknown, ...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      callback.apply(thisObject, args);
    }, delay);
  };
}
