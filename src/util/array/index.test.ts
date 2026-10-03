/**
 * The array helpers carry the bulk of the library's list arithmetic, including the path comparison
 * tree navigation and the reordering drag-and-drop build on, so the suite pins both the numeric
 * results and the edge behaviour (`Infinity` sentinels, index wrapping, refused empty inputs) the
 * callers above them rely on.
 */
import { describe, expect, test } from 'vitest';
import {
  averageArray,
  binarySearch,
  chunkArray,
  compareArrays,
  isChildArrayPath,
  maxInArray,
  maxInArrayMapped,
  medianInArray,
  minInArray,
  minInArrayMapped,
  modeInArray,
  moveArrayElement,
  sumArray,
} from './';

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

  test('handles an empty array', () => {
    expect(binarySearch([], 1, compare)).toBe(-1);
  });
});
