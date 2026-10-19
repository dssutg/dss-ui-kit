// SPDX-License-Identifier: MIT
/**
 * Framework-agnostic helpers over plain records and objects: counting a list into a map,
 * string substitution, deep equality and deep cloning.
 *
 * These are the pieces both the components and the non-DOM infrastructure modules reach for, so the
 * directory holds no rendering, no locale and no CSS assumptions — only the shapes the runtime
 * already gives us.
 */

/**
 * Counts the items of a list by a key of their own and folds the result into an initial map.
 *
 * The map is a copy of `initial` rather than the argument itself, so callers can seed counts
 * ({ a: 1 }) and still get a fresh object back; an absent key is treated as starting from zero
 * rather than being skipped.
 */
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

/**
 * Replaces every occurrence of each map key in a string with the key's value.
 *
 * The keys are literal substrings, not patterns, so there is nothing to escape — and this is also why
 * the result depends on the order the keys appear in the map: an earlier replacement's output is
 * scanned by later keys. Callers whose keys can contain each other's text must order accordingly.
 */
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

/**
 * Structural equality: two records are equal when they have the same keys and every value is
 * `deepEqual` too.
 *
 * `===` short-circuits the comparison, so identical references stay cheap; primitives are unequal to
 * objects and objects with a different key count are unequal without a walk. What it is not: a
 * comparison of class identity, getters, or non-enumerable properties — plain own keys decide, and
 * anything more exotic (functions, symbols as values) is compared by reference.
 */
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

/**
 * Narrows `unknown` to a plain record.
 *
 * Its contract is loose on purpose: any non-null `object` passes, including arrays, `Date`, `Map` and
 * class instances — the callers that need a real dictionary apply the further checks they care about
 * ({@link hasRecordKey}, `Array.isArray`). It exists so every one of those callers starts from one
 * narrowing instead of writing `typeof x === 'object' && x !== null` again.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Whether `record` has `key` as an own property — inherited or missing keys read as absent. */
export function hasRecordKey(record: Record<string, unknown>, key: string) {
  return Object.hasOwn(record, key);
}

/**
 * Deep clone of primitives, arrays, plain objects, `Date`, `RegExp`, `Map` and `Set`, with circular
 * references preserved as shared references in the copy, and object keys kept as they are — a
 * symbol-keyed property comes back under the same symbol, never under its string form.
 *
 * The registry (`seen`) is what makes a cycle terminate — it is also why two mentions of the same
 * sub-object come back as one: identity is cloned, not just shape. Accessors are copied rather than
 * invoked, a getter cloned by hand would have already run by the time its value was stored. What this
 * is not: a structured clone. Prototypes are lost (a class instance comes back as a plain object),
 * keyed collections other than `Map`/`Set` are thrown away, and functions return as themselves.
 */
export function deepClone<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  // The walk answers `unknown`, because what it builds is decided by what it meets; the single cast
  // is the caller's claim about `T`, the one thing the walk itself cannot prove.
  return deepCloneUnknown(value, seen) as T;
}

/** The clone walk proper, typed over `unknown` so every branch narrows instead of casting. */
function deepCloneUnknown(value: unknown, seen: WeakMap<object, unknown>): unknown {
  // Primitives (including null, undefined, boolean, number, string, symbol, bigint) are returned as is
  if (!isRecord(value)) {
    return value;
  }

  // Handle circular references
  const known = seen.get(value);
  if (known !== undefined) {
    return known;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags);
  }
  if (value instanceof Map) {
    const cloned = new Map<unknown, unknown>();
    seen.set(value, cloned);
    for (const [k, v] of value.entries()) {
      cloned.set(deepCloneUnknown(k, seen), deepCloneUnknown(v, seen));
    }
    return cloned;
  }
  if (value instanceof Set) {
    return cloneSet(value, seen);
  }
  if (Array.isArray(value)) {
    return cloneArray(value, seen);
  }
  return cloneObject(value, seen);
}

function cloneSet(value: Set<unknown>, seen: WeakMap<object, unknown>): Set<unknown> {
  const cloned = new Set<unknown>();
  seen.set(value, cloned);
  for (const v of value) {
    cloned.add(deepCloneUnknown(v, seen));
  }
  return cloned;
}

function cloneArray(value: readonly unknown[], seen: WeakMap<object, unknown>): unknown[] {
  const cloned: unknown[] = [];
  seen.set(value, cloned);
  for (const [index, item] of value.entries()) {
    cloned[index] = deepCloneUnknown(item, seen);
  }
  return cloned;
}

function cloneObject(
  value: Record<string | symbol, unknown>,
  seen: WeakMap<object, unknown>,
): Record<string | symbol, unknown> {
  const cloned: Record<string | symbol, unknown> = {};
  seen.set(value, cloned);
  // Copy own properties, string and symbol keys alike, each under the key it has on the source
  for (const key of Reflect.ownKeys(value)) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (desc) {
      // Preserve getters/setters?
      if (desc.get || desc.set) {
        Object.defineProperty(cloned, key, desc);
      } else {
        cloned[key] = deepCloneUnknown(value[key], seen);
      }
    }
  }
  return cloned;
}
