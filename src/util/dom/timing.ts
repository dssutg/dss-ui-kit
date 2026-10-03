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
