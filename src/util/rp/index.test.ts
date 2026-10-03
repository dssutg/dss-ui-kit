/**
 * The `rp` coercion table is what stands between untyped data from outside the UI and the components
 * that render it, so the suite holds it to the contract documented on `rp` itself: every member
 * answers a usable value of its name and never throws, absence and garbage read as the type's zero,
 * and a value in range is passed through unchanged. A coercion that produced `undefined` or an
 * exception would put the crash in the render path the table exists to keep clean.
 */
import { describe, expect, test } from 'vitest';
import { rp } from './';

describe('rp.string', () => {
  test('passes a string through', () => {
    expect(rp.string('text')).toBe('text');
  });

  test('reads null and undefined as empty', () => {
    expect(rp.string(null)).toBe('');
    expect(rp.string(undefined)).toBe('');
  });

  test('stringifies numbers and booleans', () => {
    expect(rp.string(5)).toBe('5');
    expect(rp.string(true)).toBe('true');
  });
});

/**
 * The boolean reads flags typed by hand in configs and on the wire, where `'false'` and `'0'` are
 * spellings of off rather than truthy strings.
 */
describe('rp.boolean', () => {
  test('passes a boolean through', () => {
    expect(rp.boolean(true)).toBe(true);
    expect(rp.boolean(false)).toBe(false);
  });

  test('reads null and undefined as false', () => {
    expect(rp.boolean(null)).toBe(false);
    expect(rp.boolean(undefined)).toBe(false);
  });

  test('reads a number by its zero-ness', () => {
    expect(rp.boolean(0)).toBe(false);
    expect(rp.boolean(1)).toBe(true);
    expect(rp.boolean(-2)).toBe(true);
  });

  test('reads an array by its emptiness', () => {
    expect(rp.boolean([])).toBe(false);
    expect(rp.boolean([0])).toBe(true);
  });

  test('reads an object by its emptiness', () => {
    expect(rp.boolean({})).toBe(false);
    expect(rp.boolean({ key: 1 })).toBe(true);
  });

  test('reads a string by its text, not by its truthiness', () => {
    expect(rp.boolean('false')).toBe(false);
    expect(rp.boolean('FALSE')).toBe(false);
    expect(rp.boolean('0')).toBe(false);
    expect(rp.boolean('00')).toBe(false);
    expect(rp.boolean('true')).toBe(true);
    expect(rp.boolean('anything')).toBe(true);
  });
});

/**
 * The integer readers repair rather than validate: truncation, NaN and garbage all land on a number
 * and the range readers clamp, because a mis-typed byte or port still has to render as the value the
 * field means.
 */
describe('rp.decimalInt', () => {
  test('truncates a number towards zero', () => {
    expect(rp.decimalInt(4.9)).toBe(4);
    expect(rp.decimalInt(-4.9)).toBe(-4);
  });

  test('reads NaN as zero rather than NaN', () => {
    expect(rp.decimalInt(Number.NaN)).toBe(0);
  });

  test('reads a boolean as its number', () => {
    expect(rp.decimalInt(true)).toBe(1);
    expect(rp.decimalInt(false)).toBe(0);
  });

  test('reads null, undefined and the empty string as zero', () => {
    expect(rp.decimalInt(null)).toBe(0);
    expect(rp.decimalInt(undefined)).toBe(0);
    expect(rp.decimalInt('')).toBe(0);
  });

  test('parses a numeric string', () => {
    expect(rp.decimalInt('42')).toBe(42);
    expect(rp.decimalInt('-7')).toBe(-7);
    expect(rp.decimalInt('+3')).toBe(3);
  });

  test('strips the characters that are not part of a number', () => {
    expect(rp.decimalInt('12px')).toBe(12);
  });

  test('reads garbage as zero rather than NaN', () => {
    expect(rp.decimalInt('no digits')).toBe(0);
    expect(rp.decimalInt({})).toBe(0);
  });

  test('clamps to the safe integer range', () => {
    expect(rp.decimalInt(Number.MAX_SAFE_INTEGER + 1)).toBe(Number.MAX_SAFE_INTEGER);
    expect(rp.decimalInt(Number.MIN_SAFE_INTEGER - 1)).toBe(Number.MIN_SAFE_INTEGER);
  });
});

describe('rp.decimalUint', () => {
  test('clamps below zero to zero', () => {
    expect(rp.decimalUint(-5)).toBe(0);
    expect(rp.decimalUint(5)).toBe(5);
  });
});

describe('rp.decimalByte', () => {
  test('clamps into the 0–255 range', () => {
    expect(rp.decimalByte(-1)).toBe(0);
    expect(rp.decimalByte(128)).toBe(128);
    expect(rp.decimalByte(300)).toBe(255);
  });
});

describe('rp.port', () => {
  test('clamps into the port range', () => {
    expect(rp.port(-1)).toBe(0);
    expect(rp.port(8080)).toBe(8080);
    expect(rp.port(70_000)).toBe(65_535);
  });
});

describe('rp.hexInt', () => {
  test('parses a hex string case-insensitively', () => {
    expect(rp.hexInt('ff')).toBe(255);
    expect(rp.hexInt('FF')).toBe(255);
    expect(rp.hexInt('0x10')).toBe(16);
  });

  test('passes a number through truncated', () => {
    expect(rp.hexInt(255.7)).toBe(255);
  });

  test('reads NaN as zero rather than NaN', () => {
    expect(rp.hexInt(Number.NaN)).toBe(0);
  });

  test('reads null, undefined and the empty string as zero', () => {
    expect(rp.hexInt(null)).toBe(0);
    expect(rp.hexInt(undefined)).toBe(0);
    expect(rp.hexInt('')).toBe(0);
  });

  test('reads garbage as zero rather than NaN', () => {
    expect(rp.hexInt('xyz')).toBe(0);
  });
});

/** The container readers coerce anything that arrives into a list or a record to render. */
describe('rp.array', () => {
  test('passes an array through', () => {
    expect(rp.array([1, 2])).toEqual([1, 2]);
  });

  test('reads an object as its values', () => {
    expect(rp.array({ a: 1, b: 2 })).toEqual([1, 2]);
  });

  test('reads null and a primitive as empty', () => {
    expect(rp.array(null)).toEqual([]);
    expect(rp.array('text')).toEqual([]);
    expect(rp.array(5)).toEqual([]);
  });
});

describe('rp.recordStringUnknown', () => {
  test('passes an object through', () => {
    const record = { key: 'value' };

    expect(rp.recordStringUnknown(record)).toBe(record);
  });

  test('rejects arrays and null into an empty record', () => {
    expect(rp.recordStringUnknown([1])).toEqual({});
    expect(rp.recordStringUnknown(null)).toEqual({});
  });

  test('rejects a boxed string into an empty record', () => {
    expect(rp.recordStringUnknown(new String('text'))).toEqual({});
  });
});

describe('rp.record', () => {
  test('maps over the record form of its input', () => {
    expect(rp.record({ a: 1 }, (record) => Object.keys(record).length)).toBe(1);
  });

  test('hands the mapper an empty record for an array', () => {
    expect(rp.record([1, 2], (record) => Object.keys(record).length)).toBe(0);
  });
});

describe('rp.stringMatchesEnum', () => {
  const allowed = ['a', 'b'] as const;

  test('passes a value from the list through', () => {
    expect(rp.stringMatchesEnum('a', allowed, 'b')).toBe('a');
  });

  test('falls back for a value the list does not hold', () => {
    expect(rp.stringMatchesEnum('c', allowed, 'b')).toBe('b');
  });
});
