import { cmp, wrapIndex } from '@/util/math';

/**
 * Splits an array into consecutive chunks of at most `chunkSize` elements.
 *
 * A non-positive or fractional `chunkSize` is truncated first, and a size below one yields no chunks
 * rather than one chunk per element repeatedly — there is no meaningful way to divide a list into
 * pieces smaller than one element.
 */
export function chunkArray<T>(array: readonly T[], chunkSize: number): T[][] {
  const step = Math.trunc(chunkSize);

  if (step <= 0) {
    return [];
  }

  let chunkList: T[][] = [];

  for (let i = 0; i < array.length; i += step) {
    chunkList = [...chunkList, array.slice(i, i + step)];
  }

  return chunkList;
}

/**
 * Compares two arrays element by element, and the shorter one sorts first when they share a prefix.
 *
 * The comparator `Array.prototype.sort` wants: `-1` when `a` sorts before `b`, `+1` after, `0` when
 * the same. Elements are compared with `<` and `>`, so this orders numbers and strings, and an array
 * of objects needs a comparator of the caller's instead.
 */
export function compareArrays<T>(a: readonly T[], b: readonly T[]): number {
  const shared = Math.min(a.length, b.length);
  const aEntries = a.entries();
  const bEntries = b.entries();

  // Both arrays are walked with their own iterator rather than indexed. An element of an array of
  // `T` may itself be `null` or `undefined` when `T` allows it, so a value read out of the array
  // cannot be told apart from a missing one; the iterator yields the element either way. The two
  // iterators are advanced in step, and the shorter array decides where the shared part ends.
  for (let i = 0; i < shared; i++) {
    const aNext = aEntries.next();
    const bNext = bEntries.next();

    if (aNext.done || bNext.done) {
      break;
    }

    if (aNext.value < bNext.value) {
      return -1;
    }
    if (aNext.value > bNext.value) {
      return +1;
    }
  }

  if (a.length < b.length) {
    return -1;
  }
  if (a.length > b.length) {
    return +1;
  }

  return 0;
}

/**
 * Lays a list of strings out in fixed-width columns, padded so each column lines up.
 *
 * Two widths are measured per column: the widest entry sets the column's width, and every line is
 * indented and double-spaced between columns. For rendering a picker or a help listing as plain text,
 * not for measuring with.
 */
export function getStringArrayAsColumnLines(strings: readonly string[], columnCount: number) {
  const columnWidths = new Array<number>(columnCount).fill(0);

  for (let i = 0; i < strings.length; i += columnCount) {
    const columns = strings.slice(i, i + columnCount);

    for (let j = 0; j < columnCount; j++) {
      const widestSoFar = columnWidths[j] ?? 0;
      columnWidths[j] = Math.max(columns[j]?.length ?? 0, widestSoFar);
    }
  }

  let lines: string[] = [];

  for (let i = 0; i < strings.length; i += columnCount) {
    let line = '';
    const columns = strings.slice(i, i + columnCount);

    for (let j = 0; j < columnCount; j++) {
      const width = columnWidths[j] ?? 0;

      line = `${line}${(columns[j] ?? '').padEnd(width, ' ')}  `;
    }
    lines = [...lines, `  ${line}`];
  }

  return lines;
}

/**
 * Groups the items of an array by a property, keeping every item of each group.
 *
 * Keys are whatever the getter returns, stringified as object keys are; two names that stringify
 * alike are one group. The grouped values keep their original order.
 */
export function groupArrayByProperty<T>(
  array: readonly T[],
  getPropertyValue: (item: T) => string | number,
) {
  const map: Record<string, T[]> = {};

  for (const item of array) {
    const value = getPropertyValue(item);
    const group = map[value];

    if (group === undefined) {
      map[value] = [item];
      continue;
    }

    group.push(item);
  }

  return map;
}

/**
 * Indexes the items of an array by a property, the last one winning where the property repeats.
 */
export function groupArrayByPropertyUnique<T>(
  array: readonly T[],
  getPropertyValue: (item: T) => string | number,
) {
  return Object.fromEntries(array.map((item) => [getPropertyValue(item), item]));
}

/**
 * Whether `childPath` equals `parentPath` or extends it, element for element.
 *
 * For arrays that name a position in a tree — a row's path in a table — where a child's path starts
 * with the parent's. An empty child path is a child of anything, because the root is.
 */
export function isChildArrayPath<T>(childPath: readonly T[], parentPath: readonly T[]): boolean {
  for (const [i, element] of childPath.entries()) {
    if (element !== parentPath[i]) {
      return false;
    }
  }

  return true;
}

/**
 * The largest number in the array, and `-Infinity` for an empty one.
 *
 * The empty case is `Math.max` of nothing, which is not an error to handle: it sorts below every real
 * value, so a caller starting an accumulator from it ends with the first element's value.
 */
export function maxInArray(array: readonly number[]): number {
  return Math.max(...array);
}

/**
 * The largest value the mapper produces, along with the element that produced it and where it sits.
 *
 * `null` for an empty array rather than `-Infinity`, because the caller is after an element and there
 * is none to name. One walk answers all three questions, which is why this is not a `maxInArray`
 * call plus an `indexOf`.
 */
export function maxInArrayMapped<T>(
  array: readonly T[],
  elementMapper: (element: T, index: number) => number,
) {
  // The winning value, the element it came from and where that element sits are carried together.
  // Reading the element back out of the array by index at the end would need the index to be
  // trusted, and this way every value in the result was read while it was certainly present.
  let best: { value: number; element: T; index: number } | undefined;

  for (const [index, element] of array.entries()) {
    const value = elementMapper(element, index);

    if (best === undefined || value > best.value) {
      best = { value, element, index };
    }
  }

  if (best === undefined) {
    return null;
  }

  return { max: best.value, maxElement: best.element, maxElementIndex: best.index };
}

/** Adds the elements up. An empty array sums to zero, which is what a total of nothing is. */
export function sumArray(array: readonly number[]) {
  let sum = 0;
  for (const element of array) {
    sum += element;
  }
  return sum;
}

/**
 * The mean, and `0` for an empty array.
 *
 * Zero rather than `NaN` because a panel showing an average over no rows wants a value it can render,
 * and `NaN` is not that. A caller that must tell the two apart checks the length first.
 */
export function averageArray(array: readonly number[]) {
  if (array.length === 0) {
    return 0;
  }
  return sumArray(array) / array.length;
}

/**
 * The middle value of the sorted array, or the mean of the two middle values for an even length.
 *
 * Throws on an empty array, unlike {@link averageArray}: there is no value to fall back to that would
 * not be mistaken for one, and an empty median is always a caller's bug.
 */
export function medianInArray(array: readonly number[]) {
  if (array.length === 0) {
    throw new Error('Array cannot be empty.');
  }

  const sorted = array.toSorted(cmp);

  return sorted.length % 2 === 0
    ? meanOfTwoMiddle(sorted)
    : (sorted[Math.floor(sorted.length / 2)] ?? 0);
}

/** The mean of the two values either side of the middle of an array of even length. */
function meanOfTwoMiddle(sorted: readonly number[]): number {
  const lower = sorted[sorted.length / 2 - 1];
  const upper = sorted[sorted.length / 2];

  if (lower === undefined || upper === undefined) {
    throw new Error('Array cannot be empty.');
  }

  return (lower + upper) / 2;
}

/**
 * The smallest number in the array, and `Infinity` for an empty one — the mirror of
 * {@link maxInArray}: `Math.min` of nothing already answers, so the empty case is not special.
 */
export function minInArray(array: readonly number[]): number {
  return Math.min(...array);
}

/**
 * The smallest value the mapper produces, along with the element that produced it and where it sits.
 *
 * `null` for an empty array, for the same reason {@link maxInArrayMapped} is.
 */
export function minInArrayMapped<T>(
  array: readonly T[],
  elementMapper: (element: T, index: number) => number,
) {
  // Carried together for the same reason as in `maxInArrayMapped` above.
  let best: { value: number; element: T; index: number } | undefined;

  for (const [index, element] of array.entries()) {
    const value = elementMapper(element, index);

    if (best === undefined || value < best.value) {
      best = { value, element, index };
    }
  }

  if (best === undefined) {
    return null;
  }

  return { min: best.value, minElement: best.element, minElementIndex: best.index };
}

/**
 * Every value that occurs most often in the array, which is more than one when there is a tie.
 *
 * An empty array answers with an empty one rather than nothing to name. Two values tie for most
 * frequent as often as not — a flag column of all zeroes and ones does — so the result is a list to
 * render rather than a single value to pick from.
 */
export function modeInArray(array: readonly number[]) {
  if (array.length === 0) {
    return [];
  }

  const frequencyMap: Record<number, number> = {};

  for (const element of array) {
    frequencyMap[element] = (frequencyMap[element] ?? 0) + 1;
  }

  const maxFrequency = maxInArray(Object.values(frequencyMap));

  const modes = Object.keys(frequencyMap)
    .filter((element) => frequencyMap[Number(element)] === maxFrequency)
    .map(Number);

  return modes;
}

/**
 * Moves one element a single position left or right, wrapping around the ends of the array.
 *
 * Moving the first element left lands it at the end and the last element right at the start, which is
 * the circular movement a list of options being stepped through wants; the index is wrapped the same
 * way, so a caller need not pre-clamp it.
 */
export function moveArrayElementLeftOrRightCircularly<T>(
  array: readonly T[] = [],
  index = 0,
  isLeft = true,
): T[] {
  if (array.length === 0) {
    return [];
  }

  const delta = isLeft ? -1 : 1;

  const oldIndex = wrapIndex(index, array.length);
  const newIndex = wrapIndex(oldIndex + delta, array.length);

  return moveArrayElement(array, oldIndex, newIndex);
}

/**
 * Moves an element from one position to another, both wrapped to the array's length.
 *
 * Returns a new array; the input is never rearranged. A negative or out-of-bounds index is wrapped, so
 * `moveArrayElement(list, -1, 0)` takes the last element — the caller writes the index it means
 * rather than the index the copy needs.
 */
export function moveArrayElement<T>(array: readonly T[] = [], from = 0, to = 0): T[] {
  if (array.length === 0) {
    return [];
  }

  const wrappedFrom = wrapIndex(from, array.length);
  const wrappedTo = wrapIndex(to, array.length);
  const element = array[wrappedFrom];

  if (element === undefined) {
    return [...array];
  }

  const newArray = [...array.slice(0, wrappedFrom), ...array.slice(wrappedFrom + 1)];

  return [...newArray.slice(0, wrappedTo), element, ...newArray.slice(wrappedTo)];
}

/** One element of the array, chosen uniformly at random. Undefined on an empty array. */
export function randomArrayElement<T>(array: readonly T[]) {
  return array[Math.floor(Math.random() * array.length)];
}

/** The array with repeats dropped, order kept from the first occurrence. Compared by `===`. */
export function removeDuplicatesFromArray<T>(array: readonly T[]) {
  return [...new Set(array)];
}

/**
 * The array with repeated objects dropped, comparing by their JSON shape rather than by reference.
 *
 * `===` would be useless here: two objects with the same contents are different references. JSON
 * comparison is the trade — two objects that stringify alike are duplicates whether or not they are,
 * and key order in an object literal matters.
 */
export function removeDuplicateObjectsFromArray<T>(array: readonly T[]) {
  let uniqueObjects: T[] = [];
  const seenObjects = new Set();

  for (const object of array) {
    const objectString = JSON.stringify(object);

    if (!seenObjects.has(objectString)) {
      seenObjects.add(objectString);
      uniqueObjects = [...uniqueObjects, object];
    }
  }

  return uniqueObjects;
}

/**
 * Finds `target` in a sorted array in logarithmic time, or reports where it would go.
 *
 * The array must already be sorted with `compareFunction`, which is what makes the halving valid; that
 * is not checked, and an unsorted array silently finds nothing. `returnInsertionIndex` answers the
 * "not present" case with the position the target belongs at instead of `-1`, which is how a sorted
 * array is inserted into in order.
 */
export function binarySearch<T>(
  array: readonly T[],
  target: T,
  compareFunction: (a: T, b: T) => number,
  { returnInsertionIndex = false } = {},
): number {
  let left = 0;
  let right = array.length - 1;

  while (left <= right) {
    const middle = left + Math.floor((right - left) / 2);
    const middleElement = array[middle];

    if (middleElement === undefined) {
      break;
    }

    const comparison = compareFunction(middleElement, target);

    if (comparison === 0) {
      // Target found
      return middle;
    }
    if (comparison < 0) {
      // Search in the right half
      left = middle + 1;
    } else {
      // Search in the left half
      right = middle - 1;
    }
  }

  return returnInsertionIndex ? left : -1;
}

/**
 * Shuffles the array in place with the Fisher–Yates walk, and hands the same array back.
 *
 * Mutating rather than copying because a shuffled copy of a large array costs the same walk; a caller
 * that wants its input kept copies first. Every ordering is equally likely, which is what sorting by
 * a random key does not give.
 */
export function shuffleArray<T>(array: T[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const other = Math.floor(Math.random() * (i + 1));

    const current = array[i];
    const picked = array[other];

    if (current === undefined || picked === undefined) {
      continue;
    }

    array[i] = picked;
    array[other] = current;
  }

  return array;
}
