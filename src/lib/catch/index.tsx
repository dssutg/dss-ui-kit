/**
 * Runs something that can fail and hands back the value or the error, never a thrown exception.
 *
 * A tuple rather than a rejected promise because the call site has to deal with the failure anyway: a
 * rejected promise that is never caught is a failure with a stack trace pointing at the wrong line. Use
 * it where the failure is an expected outcome — a probe, a fallback chain — and not where an error
 * should stop the caller.
 */
export async function tryCatchAsync<T>(
  getter: () => Promise<T>,
): Promise<[T | null, unknown | null]> {
  try {
    return [await getter(), null];
  } catch (error) {
    return [null, error];
  }
}

/** {@link tryCatchAsync} for something synchronous. Returns `[value, null]` or `[null, error]`. */
export function tryCatch<T>(getter: () => T): [T, null] | [null, unknown] {
  try {
    return [getter(), null];
  } catch (error) {
    return [null, error];
  }
}
