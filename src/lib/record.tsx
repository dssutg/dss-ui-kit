export function getListAsCountMap<T, K extends string>(
  items: readonly T[],
  getCounterField: (item: T) => K,
  initial = {} as Record<K, number>,
) {
  const map = { ...initial };

  for (const item of items) {
    const field = getCounterField(item);
    map[field] = (map[field] ?? 0) + 1;
  }

  return map;
}

export function substituteStringByMap(
  originalString = '',
  substitutionMap: Readonly<Record<string, string>> = {},
) {
  let result = originalString;

  for (const key in substitutionMap) {
    result = result.split(key).join(substitutionMap[key]);
  }

  return result;
}

export function deepEqual(object1: unknown, object2: unknown): boolean {
  if (object1 === object2) {
    return true;
  }

  if (!isRecord(object1) || !isRecord(object2)) {
    return false;
  }

  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(object1[key], object2[key])) {
      return false;
    }
  }

  return true;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function hasRecordKey(record: Record<string, unknown>, key: string) {
  return Object.hasOwn(record, key);
}
// Performs a deep clone of a given value.
// Supports primitives, Array, Object, Date, RegExp, Map, Set, and handles circular references.

export function deepClone<T>(value: T, seen = new WeakMap()): T {
  // Primitives (including null, undefined, boolean, number, string, symbol, bigint) are returned as is
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Handle circular references
  if (seen.has(value)) {
    return seen.get(value);
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags) as T;
  }
  if (value instanceof Map) {
    const cloned = new Map();
    seen.set(value, cloned);
    for (const [k, v] of value.entries()) {
      cloned.set(deepClone(k, seen), deepClone(v, seen));
    }
    return cloned as T;
  }
  if (value instanceof Set) {
    const cloned = new Set();
    seen.set(value, cloned);
    for (const v of value) {
      cloned.add(deepClone(v, seen));
    }
    return cloned as T;
  }
  if (Array.isArray(value)) {
    const cloned: unknown[] = [];
    seen.set(value, cloned);
    for (const [index, item] of value.entries()) {
      cloned[index] = deepClone(item, seen);
    }
    return cloned as T;
  }
  const cloned = {} as Record<string, unknown>;
  seen.set(value, cloned);
  // Copy own enumerable properties (including symbol keys)
  for (const key of Reflect.ownKeys(value)) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (desc) {
      // Preserve getters/setters?
      if (desc.get || desc.set) {
        Object.defineProperty(cloned, key, desc);
      } else {
        cloned[key.toString()] = deepClone(
          (value as Record<string, unknown>)[key.toString()],
          seen,
        );
      }
    }
  }
  return cloned as T;
}
