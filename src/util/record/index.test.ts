/**
 * The record helpers are what component code narrows `unknown` data with, so the suite pins the
 * type-guard edges (`isRecord`, `hasRecordKey`), the helpers that keep caller-owned data intact
 * (`getListAsCountMap`, `deepClone`), and the comparison and substitution the library compares state
 * and renders notes with.
 */
import { describe, expect, test } from 'vitest';
import {
  deepClone,
  deepEqual,
  getListAsCountMap,
  hasRecordKey,
  isRecord,
  substituteStringByMap,
} from './';

describe('isRecord', () => {
  test('accepts objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ key: 'value' })).toBe(true);
    expect(isRecord([])).toBe(true);
  });

  test('rejects null and everything that is not an object', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord('text')).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
  });
});

/**
 * Own-key only: a key inherited from the prototype would let a read through the guard reach data the
 * object itself does not carry, which is exactly the confusion the guard is consulted to prevent.
 */
describe('hasRecordKey', () => {
  test('is true for an own key', () => {
    expect(hasRecordKey({ key: 1 }, 'key')).toBe(true);
  });

  test('is false for a missing key', () => {
    expect(hasRecordKey({}, 'key')).toBe(false);
  });

  test('is false for a key only the prototype has', () => {
    expect(hasRecordKey(Object.create({ inherited: 1 }), 'inherited')).toBe(false);
  });
});

/**
 * Counting is used for fold-up displays over a list, and it must never mutate the initial counts a
 * caller may be reusing.
 */
describe('getListAsCountMap', () => {
  test('counts occurrences of each key', () => {
    expect(getListAsCountMap(['a', 'b', 'a'], (item) => item)).toEqual({ a: 2, b: 1 });
  });

  test('starts from the initial counts the caller supplies', () => {
    expect(getListAsCountMap(['a'], (item) => item, { b: 5 })).toEqual({ a: 1, b: 5 });
  });

  test('returns the initial counts unchanged for an empty list', () => {
    expect(getListAsCountMap([], (item) => item, { a: 1 })).toEqual({ a: 1 });
  });

  test('does not mutate the initial record', () => {
    const initial = { a: 1 };

    getListAsCountMap(['a'], (item) => item, initial);

    expect(initial).toEqual({ a: 1 });
  });
});

/** Plain substitution, with no escaping and no word awareness: both ends are the caller's. */
describe('substituteStringByMap', () => {
  test('replaces every occurrence of each key', () => {
    expect(substituteStringByMap('a b a', { a: 'x', b: 'y' })).toBe('x y x');
  });

  test('leaves a string without the keys alone', () => {
    expect(substituteStringByMap('nothing to swap', { key: 'x' })).toBe('nothing to swap');
  });

  test('handles key text that appears inside words', () => {
    expect(substituteStringByMap('catcar', { cat: 'dog' })).toBe('dogcar');
  });

  test('substitutes empty replacements', () => {
    expect(substituteStringByMap('aXbXc', { X: '' })).toBe('abc');
  });

  test('does nothing with an empty map', () => {
    expect(substituteStringByMap('text', {})).toBe('text');
  });
});

/**
 * Deep equality stands in for reference equality where state is rebuilt every render, so the edges
 * that matter are: key order does not matter, nesting is followed, and mismatched shapes are never
 * equal.
 */
describe('deepEqual', () => {
  test('accepts identical primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
  });

  test('rejects different primitives', () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual(null, 0)).toBe(false);
  });

  test('compares objects by their keys and values', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  test('compares nested structures', () => {
    expect(deepEqual({ a: { b: [1, { c: 3 }] } }, { a: { b: [1, { c: 3 }] } })).toBe(true);
    expect(deepEqual({ a: { b: [1, { c: 3 }] } }, { a: { b: [1, { c: 4 }] } })).toBe(false);
  });

  test('rejects a primitive against an object with a different key set', () => {
    expect(deepEqual('text', { 0: 't' })).toBe(false);
    expect(deepEqual({ a: 1 }, 1)).toBe(false);
  });

  test('compares arrays as objects with index keys', () => {
    expect(deepEqual([1, 2], [1, 2])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });
});

/**
 * The clone has to be safe to mutate — that is the point of calling it — and to survive the shapes
 * the library's own state takes, including the circular references a list holding itself would trip
 * a naive walker over.
 */
describe('deepClone', () => {
  test('clones objects so the copy can be changed without changing the original', () => {
    const original = { a: { b: 1 } };
    const copy = deepClone(original);

    copy.a.b = 2;

    expect(original.a.b).toBe(1);
    expect(copy).toEqual({ a: { b: 2 } });
  });

  test('clones arrays', () => {
    const original = [1, [2, 3]];
    const copy = deepClone(original);

    expect(copy).toEqual(original);
    expect(copy[1]).not.toBe(original[1]);
  });

  test('clones dates into new date objects', () => {
    const original = new Date('2024-01-01T00:00:00Z');
    const copy = deepClone(original);

    expect(copy).not.toBe(original);
    expect(copy.getTime()).toBe(original.getTime());
  });

  test('clones regular expressions', () => {
    const original = /ab+/gi;
    const copy = deepClone(original);

    expect(copy).not.toBe(original);
    expect(copy.source).toBe(original.source);
    expect(copy.flags).toBe(original.flags);
  });

  test('clones maps deeply', () => {
    const original = new Map([['key', { nested: 1 }]]);
    const copy = deepClone(original);

    expect(copy).not.toBe(original);
    expect(copy.get('key')).toEqual({ nested: 1 });
    expect(copy.get('key')).not.toBe(original.get('key'));
  });

  test('clones sets deeply', () => {
    const original = new Set([{ item: 1 }]);
    const copy = deepClone(original);

    expect(copy).not.toBe(original);
    expect([...copy][0]).toEqual({ item: 1 });
    expect([...copy][0]).not.toBe([...original][0]);
  });

  test('preserves circular references instead of looping forever', () => {
    const original: { name: string; self?: unknown } = { name: 'loop' };
    original.self = original;

    const copy = deepClone(original);

    expect(copy.name).toBe('loop');
    expect(copy.self).toBe(copy);
    expect(copy).not.toBe(original);
  });

  test('returns primitives as they are', () => {
    expect(deepClone(1)).toBe(1);
    expect(deepClone(null)).toBeNull();
    expect(deepClone('text')).toBe('text');
  });
});
