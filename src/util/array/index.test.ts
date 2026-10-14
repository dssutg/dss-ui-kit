// SPDX-License-Identifier: MIT
/**
 * The array helpers carry the bulk of the library's list arithmetic, including the path comparison
 * tree navigation and the reordering drag-and-drop build on, so the suite pins both the numeric
 * results and the edge behaviour (`Infinity` sentinels, index wrapping, refused empty inputs) the
 * callers above them rely on.
 */
import { describe, expect, test, vi } from 'vitest';
import {
  averageArray,
  binarySearch,
  chunkArray,
  compareArrays,
  getStringArrayAsColumnLines,
  groupArrayByProperty,
  groupArrayByPropertyUnique,
  isChildArrayPath,
  maxInArray,
  maxInArrayMapped,
  medianInArray,
  minInArray,
  minInArrayMapped,
  modeInArray,
  moveArrayElement,
  moveArrayElementLeftOrRightCircularly,
  randomArrayElement,
  removeDuplicateObjectsFromArray,
  removeDuplicatesFromArray,
  shuffleArray,
  sumArray,
  sumFrom,
} from './';

/**
 * An element whose coercion runs a caller's side effect, so a test can shorten one of the arrays
 * *during* the element comparison of {@link compareArrays}. The iterators were built before
 * `shared` was read; shortening an array between two `next()` calls is the only way a live Array
 * iterator then answers `done` inside the shared loop, and the guard exists for exactly that.
 * Every element must coerce to the same string, or an earlier comparison decides `a < b` first.
 */
class CoercingElement {
  readonly onCoerce: () => void;

  constructor(onCoerce: () => void) {
    this.onCoerce = onCoerce;
  }

  [Symbol.toPrimitive](_hint: 'number' | 'string' | 'default'): number {
    this.onCoerce();

    return 0;
  }
}

describe('compareArrays', () => {
  test('returns zero for two equal arrays', () => {
    expect(compareArrays([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  test('reports which array sorts first', () => {
    expect(compareArrays([1, 2], [1, 3])).toBe(-1);
    expect(compareArrays([1, 3], [1, 2])).toBe(1);
  });

  test('a prefix sorts before the longer array', () => {
    expect(compareArrays([1, 2], [1, 2, 3])).toBe(-1);
    expect(compareArrays([1, 2, 3], [1, 2])).toBe(1);
  });

  test('compares only the shared part', () => {
    expect(compareArrays([1, 9, 9], [1, 2, 9])).toBe(1);
  });

  test('an empty array compares as a prefix of a non-empty one', () => {
    expect(compareArrays([], [1])).toBe(-1);
    expect(compareArrays([], [])).toBe(0);
  });

  test('compares paths element by element, which is what the tree navigation relies on', () => {
    expect(compareArrays(['a', 'b', 'c'], ['a', 'b'])).toBe(1);
    expect(compareArrays(['a', 'b'], ['a', 'b', 'c'])).toBe(-1);
    expect(compareArrays(['a', 'b'], ['a', 'b'])).toBe(0);
  });

  // Shortening an array while its entries are being compared is the only honest way to reach
  // `done` inside the shared loop: the iterators were built before `shared` was computed, and an
  // Array iterator reads the live length on every `next()`. Both arrays need two or more entries,
  // or `shared` ends the loop before the shortened iterator is ever read again. No mocks — the
  // arrays are real Arrays mutated from inside the elements' own coercion.
  test('reports the shorter array after the first iterator is exhausted mid-comparison', () => {
    const a: CoercingElement[] = [new CoercingElement(() => {}), new CoercingElement(() => {})];
    const b = [new CoercingElement(() => {}), new CoercingElement(() => {})];

    // The first element is the one the comparison coerces, and shortening `a` inside it is what
    // makes `a`'s own iterator answer `done` on the next read.
    a[0] = new CoercingElement(() => {
      a.length = 0;
    });

    expect(compareArrays(a, b)).toBe(-1);
  });

  test('reports the shorter array after the second iterator is exhausted mid-comparison', () => {
    const a = [new CoercingElement(() => {}), new CoercingElement(() => {})];
    const b: CoercingElement[] = [new CoercingElement(() => {}), new CoercingElement(() => {})];

    b[0] = new CoercingElement(() => {
      b.length = 0;
    });

    expect(compareArrays(a, b)).toBe(1);
  });
});

/**
 * The min/max over a number list answer the identity elements (`±Infinity`) for an empty array so a
 * running extremum starts at a value any real element replaces.
 */
describe('maxInArray', () => {
  test('finds the largest number', () => {
    expect(maxInArray([3, 9, 2])).toBe(9);
  });

  test('returns negative infinity for an empty array', () => {
    expect(maxInArray([])).toBe(-Infinity);
  });
});

describe('minInArray', () => {
  test('finds the smallest number', () => {
    expect(minInArray([3, 9, 2])).toBe(2);
  });

  test('returns infinity for an empty array', () => {
    expect(minInArray([])).toBe(Infinity);
  });
});

/**
 * The mapped variants answer the element and its index alongside the extreme, which is what makes
 * them usable for highlighting a row rather than a value.
 */
describe('maxInArrayMapped', () => {
  test('returns the element with the largest mapped value', () => {
    const words = ['alpha', 'be', 'charlie'];

    expect(maxInArrayMapped(words, (word) => word.length)).toEqual({
      max: 7,
      maxElement: 'charlie',
      maxElementIndex: 2,
    });
  });

  test('returns null for an empty array', () => {
    expect(maxInArrayMapped([], () => 0)).toBeNull();
  });

  // The element is carried alongside its index, so an element that is itself `undefined` is a
  // result rather than being mistaken for an empty array.
  test('reports an element that is undefined as a result of its own', () => {
    const withAbsent = [undefined, 1];

    expect(maxInArrayMapped(withAbsent, () => 1)).toEqual({
      max: 1,
      maxElement: undefined,
      maxElementIndex: 0,
    });
  });

  test('keeps the first of two equal values', () => {
    expect(maxInArrayMapped([5, 5], () => 1)).toEqual({
      max: 1,
      maxElement: 5,
      maxElementIndex: 0,
    });
  });
});

describe('minInArrayMapped', () => {
  test('returns the element with the smallest mapped value', () => {
    const words = ['alpha', 'be', 'charlie'];

    expect(minInArrayMapped(words, (word) => word.length)).toEqual({
      min: 2,
      minElement: 'be',
      minElementIndex: 1,
    });
  });

  test('returns null for an empty array', () => {
    expect(minInArrayMapped([], () => 0)).toBeNull();
  });
});

/**
 * The average of nothing is refused rather than guessed, because a wrong median presented as a
 * number is worse than a loud failure.
 */
describe('medianInArray', () => {
  test('takes the middle value of an odd-length array', () => {
    expect(medianInArray([3, 1, 2])).toBe(2);
  });

  test('averages the two middle values of an even-length array', () => {
    expect(medianInArray([1, 2, 3, 4])).toBe(2.5);
  });

  test('refuses an empty array rather than returning a wrong number', () => {
    expect(() => medianInArray([])).toThrow(/cannot be empty/i);
  });

  test('refuses an even-length array whose middles are not numbers', () => {
    // A hole sorts as an undefined value, and `toSorted` moves undefineds to the end, so both
    // values either side of the middle can be missing from an even-length array of holes.
    const sparse: number[] = new Array(2);
    sparse[0] = 5;

    expect(() => medianInArray(sparse)).toThrow(/cannot be empty/i);

    const allHoles: number[] = new Array(2);

    expect(() => medianInArray(allHoles)).toThrow(/cannot be empty/i);
  });

  test('answers zero when the middle of an odd-length array is not a number', () => {
    // Every element of an odd-length array of holes is missing, middle included; the middle value
    // falls back to zero rather than NaN, which is what a panel wants to render.
    const allHoles: number[] = new Array(3);

    expect(medianInArray(allHoles)).toBe(0);
  });
});

describe('modeInArray', () => {
  test('reports every value that occurs most often', () => {
    expect(modeInArray([1, 2, 2, 3]).toSorted()).toEqual([2]);
    expect(modeInArray([1, 1, 2, 2, 3]).toSorted()).toEqual([1, 2]);
  });

  test('returns nothing for an empty array', () => {
    expect(modeInArray([])).toEqual([]);
  });
});

describe('chunkArray', () => {
  test('splits into chunks of the given size', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('returns nothing for a size of zero or less', () => {
    expect(chunkArray([1, 2, 3], 0)).toEqual([]);
    expect(chunkArray([1, 2, 3], -1)).toEqual([]);
  });

  test('truncates a fractional size before reading it', () => {
    expect(chunkArray([1, 2, 3], 1.9)).toEqual([[1], [2], [3]]);
    expect(chunkArray([1, 2, 3], -0.5)).toEqual([]);
  });
});

/**
 * Column layout is read by operators as text, so the padding widths are pinned exactly rather than
 * compared loosely: a column that lost a character still has to line up with the one beside it.
 */
describe('getStringArrayAsColumnLines', () => {
  test('pads every column to the widest entry in it', () => {
    expect(getStringArrayAsColumnLines(['a', 'bb', 'c'], 2)).toEqual(['  a  bb  ', '  c      ']);
  });

  test('answers a column of spaces where the last row has no entry', () => {
    expect(getStringArrayAsColumnLines(['x'], 3)).toEqual(['  x      ']);
  });

  test('answers nothing for an empty list', () => {
    expect(getStringArrayAsColumnLines([], 2)).toEqual([]);
    expect(getStringArrayAsColumnLines([], 0)).toEqual([]);
  });

  // A column count below one cannot stride anywhere: a stride of zero stepped the cursor nowhere
  // and looped forever, and a negative or fractional count threw from `new Array`. The rule
  // `chunkArray` already applies is the rule here too — truncate first, nothing below one.
  test('answers nothing for a column count below one, like chunkArray does', () => {
    expect(getStringArrayAsColumnLines(['a', 'b', 'c'], 0)).toEqual([]);
    expect(getStringArrayAsColumnLines(['a', 'b', 'c'], -2)).toEqual([]);
  });

  test('truncates a fractional column count before reading it', () => {
    expect(getStringArrayAsColumnLines(['a', 'b', 'c'], 1.5)).toEqual(['  a  ', '  b  ', '  c  ']);
  });
});

describe('groupArrayByProperty', () => {
  test('keeps every item of each group, in encounter order', () => {
    const items = [
      { kind: 'a', name: 'first' },
      { kind: 'b', name: 'one' },
      { kind: 'a', name: 'second' },
    ];

    expect(groupArrayByProperty(items, (item) => item.kind)).toEqual({
      a: [items[0], items[2]],
      b: [items[1]],
    });
  });

  test('stringifies a numeric key like object keys do', () => {
    const items = [
      { id: 7, name: 'first' },
      { id: 7, name: 'second' },
      { id: 8, name: 'other' },
    ];

    expect(groupArrayByProperty(items, (item) => item.id)).toEqual({
      7: [items[0], items[1]],
      8: [items[2]],
    });
  });
});

describe('groupArrayByPropertyUnique', () => {
  test('the last item wins where the property repeats', () => {
    const items = [
      { id: 1, name: 'first' },
      { id: 1, name: 'second' },
      { id: 2, name: 'other' },
    ];

    expect(groupArrayByPropertyUnique(items, (item) => item.id)).toEqual({
      1: { id: 1, name: 'second' },
      2: { id: 2, name: 'other' },
    });
  });
});

describe('sumArray and averageArray', () => {
  test('add up the elements', () => {
    expect(sumArray([1, 2, 3])).toBe(6);
    expect(sumArray([])).toBe(0);
  });

  test('divide by the length', () => {
    expect(averageArray([1, 2, 3])).toBe(2);
  });

  test('average nothing is zero rather than a division by zero', () => {
    expect(averageArray([])).toBe(0);
  });
});

/**
 * Reordering is what the drag-and-drop list reports, and the wrap-instead-of-clamp index behaviour
 * it builds on is spelled out rather than left as an implementation detail.
 */
describe('moveArrayElement', () => {
  test('moves an element to another position', () => {
    expect(moveArrayElement([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
  });

  test('wraps an index that is out of bounds', () => {
    // `wrapIndex` wraps rather than clamps: an index of 4 in an array of 3 is index 1, and a
    // negative index counts back from the end, so -1 is the last element. The tree reordering
    // relies on that, so it is spelled out here rather than left as an implementation detail.
    expect(moveArrayElement([1, 2, 3], 0, 4)).toEqual([2, 1, 3]);
    expect(moveArrayElement([1, 2, 3], 0, -1)).toEqual([2, 3, 1]);
  });

  test('an index one past the end wraps to the start', () => {
    expect(moveArrayElement([1, 2, 3], 3, 0)).toEqual([1, 2, 3]);
  });

  test('returns nothing for an empty array', () => {
    expect(moveArrayElement([], 0, 1)).toEqual([]);
  });

  test('copies the array when the wrapped start names a hole', () => {
    // A hole is an element the move cannot lift, so the array is handed back unchanged instead.
    const sparse: string[] = new Array(2);

    sparse[1] = 'b';

    const result = moveArrayElement(sparse, 0, 1);

    expect(result).not.toBe(sparse);
    expect(result).toEqual(sparse);
  });
});

/**
 * The one-position move a list of options steps through, built on the same wrapped indices as
 * {@link moveArrayElement}; the circular wrap at both ends is what a caller relies on.
 */
describe('moveArrayElementLeftOrRightCircularly', () => {
  test('moves one element one position right', () => {
    expect(moveArrayElementLeftOrRightCircularly(['a', 'b', 'c'], 1, false)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });

  test('wraps the first element to the end when moved left', () => {
    expect(moveArrayElementLeftOrRightCircularly(['a', 'b', 'c'], 0, true)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  test('wraps the last element to the start when moved right', () => {
    expect(moveArrayElementLeftOrRightCircularly(['a', 'b', 'c'], 2, false)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  test('wraps an out-of-range index like moveArrayElement does', () => {
    // -1 counts back from the end, so the element moved is the last one, taken one position left.
    expect(moveArrayElementLeftOrRightCircularly(['a', 'b', 'c'], -1, true)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });

  test('answers an empty array for an empty array', () => {
    expect(moveArrayElementLeftOrRightCircularly()).toEqual([]);
  });

  test('defaults to moving the first element left', () => {
    expect(moveArrayElementLeftOrRightCircularly(['a', 'b'])).toEqual(['b', 'a']);
  });
});

/** The path relation the tree navigation walks a selection with. */
describe('isChildArrayPath', () => {
  test('a path is a child of itself', () => {
    expect(isChildArrayPath(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  test('a longer path is not a child of a shorter one', () => {
    expect(isChildArrayPath(['a', 'b', 'c'], ['a', 'b'])).toBe(false);
  });

  test('unrelated paths are not children of each other', () => {
    expect(isChildArrayPath(['a'], ['b'])).toBe(false);
  });
});

describe('binarySearch', () => {
  const sorted = [1, 3, 5, 7, 9];
  const compare = (a: number, b: number) => a - b;

  test('finds a value that is present', () => {
    expect(binarySearch(sorted, 5, compare)).toBe(2);
  });

  test('returns minus one for a value that is not present', () => {
    expect(binarySearch(sorted, 4, compare)).toBe(-1);
  });

  test('can return where the value would go instead', () => {
    expect(binarySearch(sorted, 4, compare, { returnInsertionIndex: true })).toBe(2);
  });

  test('answers the insertion point at either end of the range', () => {
    expect(binarySearch(sorted, 0, compare, { returnInsertionIndex: true })).toBe(0);
    expect(binarySearch(sorted, 99, compare, { returnInsertionIndex: true })).toBe(5);
  });

  test('breaks out when a hole in a sparse array is the middle element', () => {
    const sparse: number[] = new Array(3);
    const expected: number[] = new Array(3);
    expected[1] = 1;

    expect(binarySearch(expected, 1, compare)).toBe(1);
    expect(binarySearch(sparse, 1, compare, { returnInsertionIndex: true })).toBe(0);
    expect(binarySearch(sparse, 1, compare, { returnInsertionIndex: false })).toBe(-1);
  });

  test('handles an empty array', () => {
    expect(binarySearch([], 1, compare)).toBe(-1);
  });
});

describe('randomArrayElement', () => {
  test('picks the element the random draw lands on', () => {
    const randomSpy = vi.spyOn(Math, 'random');

    randomSpy.mockReturnValue(0);
    expect(randomArrayElement(['a', 'b', 'c'])).toBe('a');

    randomSpy.mockReturnValue(0.5);
    expect(randomArrayElement(['a', 'b', 'c'])).toBe('b');

    randomSpy.mockRestore();
  });

  test('answers undefined for an empty array', () => {
    expect(randomArrayElement([])).toBeUndefined();
  });
});

describe('removeDuplicatesFromArray', () => {
  test('drops repeats and keeps the first occurrence order', () => {
    expect(removeDuplicatesFromArray([1, 2, 1, 3, 2])).toEqual([1, 2, 3]);
  });
});

describe('removeDuplicateObjectsFromArray', () => {
  test('drops repeated objects by their JSON shape rather than by reference', () => {
    const first = { id: 1 };
    const sameShape = { id: 1 };
    const other = { id: 2 };

    expect(removeDuplicateObjectsFromArray([first, sameShape, other, other])).toEqual([
      first,
      other,
    ]);
  });

  test('keeps objects that merely stringify in a different key order', () => {
    const a = { first: 1, second: 2 };
    const b = { second: 2, first: 1 };

    expect(removeDuplicateObjectsFromArray([a, b])).toEqual([a, b]);
  });
});

/** The in-place shuffle hands the same array back; a hole cannot be swapped and stays put. */
describe('shuffleArray', () => {
  test('swaps each position with the drawn one, in place', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const array = [1, 2, 3, 4];

    expect(shuffleArray(array)).toBe(array);
    expect(array).toEqual([2, 3, 4, 1]);

    randomSpy.mockRestore();
  });

  test('leaves a hole in place where it cannot name the value it would swap', () => {
    const sparse: number[] = new Array(2);
    sparse[1] = 9;
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    shuffleArray(sparse);

    expect(sparse.length).toBe(2);
    expect(sparse[1]).toBe(9);

    randomSpy.mockRestore();
  });
});

/**
 * `sumFrom` is the spec-level definition the LemmaScript contract names, and both walks read
 * `xs[i]` only while `i` is inside the array — a hole is the one real zero case.
 */
describe('sumFrom', () => {
  test('sums the tail from an offset into the array', () => {
    expect(sumFrom([1, 2, 3], 1)).toBe(5);
    expect(sumFrom([1, 2, 3], 3)).toBe(0);
  });

  test('treats a hole as zero, like the running sum does', () => {
    const sparse: number[] = new Array(2);
    sparse[0] = 3;

    expect(sumFrom(sparse, 0)).toBe(3);
    expect(sumArray(sparse)).toBe(3);
  });
});
