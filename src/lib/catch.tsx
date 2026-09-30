export async function tryCatchAsync<T>(
  getter: () => Promise<T>,
): Promise<[T | null, unknown | null]> {
  try {
    return [await getter(), null];
  } catch (error) {
    return [null, error];
  }
}

export function tryCatch<T>(getter: () => T): [T, null] | [null, unknown] {
  try {
    return [getter(), null];
  } catch (error) {
    return [null, error];
  }
}
