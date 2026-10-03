/**
 * Tests for the composable validation schema: base validators that accept a value or throw a
 * `VError` with a readable message, refinements, and the combinators that turn them into field
 * and array schemas. A failure here would mean invalid input passes through silently, valid
 * input is rejected, or an thrown message no longer says what was wrong and where.
 */

import { describe, expect, test } from 'vitest';
import {
  VError,
  type VSchema,
  vArray,
  vArrayLength,
  vBoolean,
  vEnum,
  vGe,
  vGt,
  vInt,
  vLe,
  vLength,
  vLt,
  vMax,
  vMin,
  vNull,
  vNumber,
  vObject,
  vOr,
  vPipe,
  vRegex,
  vString,
  vUndefined,
} from './';

const expectVErrored = (run: () => unknown, message: string) => {
  let caught: unknown;

  try {
    run();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(VError);
  expect((caught as VError).message).toBe(message);
};

/** The thrown error is a real `Error` a catch can identify by its `name`. */
describe('VError', () => {
  test('is an Error named so a catch can tell it from a real failure', () => {
    const error = new VError('bad value');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('VError');
    expect(error.message).toBe('bad value');
  });
});

/** Accepts only a boolean; anything else throws with the message for the type. */
describe('vBoolean', () => {
  test('passes a boolean through', () => {
    expect(vBoolean()(true)).toBe(true);
    expect(vBoolean()(false)).toBe(false);
  });

  test('rejects everything else', () => {
    expectVErrored(() => vBoolean()('true'), 'Value must be a boolean');
  });
});

/** Accepts any number, NaN included; anything else throws with the message for the type. */
describe('vNumber', () => {
  test('passes a number through, NaN included', () => {
    expect(vNumber()(1.5)).toBe(1.5);
    expect(vNumber()(Number.NaN)).toBeNaN();
  });

  test('rejects a non-number', () => {
    expectVErrored(() => vNumber()('1'), 'Value must be a number');
  });
});

/** Accepts a whole number within the safe range, rejecting fractions and unsafe magnitudes. */
describe('vInt', () => {
  test('passes a whole number through', () => {
    expect(vInt()(3)).toBe(3);
    expect(vInt()(-3)).toBe(-3);
  });

  test('rejects a fraction', () => {
    expectVErrored(() => vInt()(3.5), 'Value must be an integer');
  });

  test('rejects a number too large to be exact', () => {
    expectVErrored(() => vInt()(Number.MAX_SAFE_INTEGER + 2), 'Value must be an integer');
  });
});

/** Accepts any string, empty included; anything else throws with the message for the type. */
describe('vString', () => {
  test('passes a string through, empty included', () => {
    expect(vString()('text')).toBe('text');
    expect(vString()('')).toBe('');
  });

  test('rejects a non-string', () => {
    expectVErrored(() => vString()(5), 'Value must be a string');
  });
});

/**
 * The threshold comparators over numbers: one strictly-below, one at-or-below, one
 * strictly-above, one at-or-above. Each names its threshold and its bound in the message.
 */
describe('comparison validators', () => {
  test('vLt accepts only below the threshold', () => {
    expect(vLt(10)(9)).toBe(9);
    expectVErrored(() => vLt(10)(10), 'Value must be an integer less than 10');
    expectVErrored(() => vLt(10)('x'), 'Value must be an integer less than 10');
  });

  test('vLe accepts the threshold itself', () => {
    expect(vLe(10)(10)).toBe(10);
    expectVErrored(() => vLe(10)(11), 'Value must be an integer less than or equal to 10');
  });

  test('vGt accepts only above the threshold', () => {
    expect(vGt(10)(11)).toBe(11);
    expectVErrored(() => vGt(10)(10), 'Value must be an integer greater than 10');
  });

  test('vGe accepts the threshold itself', () => {
    expect(vGe(10)(10)).toBe(10);
    expectVErrored(() => vGe(10)(9), 'Value must be an integer greater than or equal to 10');
  });
});

/**
 * String and array refinements: a regular expression to match, length bounds below, above and
 * pinned, and a pinned element count for arrays.
 */
describe('vRegex, vMin, vMax and vLength', () => {
  test('vRegex tests the string against the expression', () => {
    const text = 'abc';

    expect(vRegex(/^a/)(text)).toBe(text);
    expectVErrored(() => vRegex(/^a/)('bcd'), 'Value must be a string that matches regexp /^a/');
  });

  test('vMin bounds the length below', () => {
    expect(vMin(2)('ab')).toBe('ab');
    expectVErrored(() => vMin(2)('a'), 'Value must be at least 2 characters long');
  });

  test('vMax bounds the length above', () => {
    expect(vMax(2)('ab')).toBe('ab');
    expectVErrored(() => vMax(2)('abc'), 'Value must be at most 2 characters long');
  });

  test('vLength pins the length', () => {
    expect(vLength(2)('ab')).toBe('ab');
    expectVErrored(() => vLength(2)('a'), 'Value must be 2 characters long');
  });

  test('vArrayLength pins the element count', () => {
    expect(vArrayLength(2)([1, 2])).toEqual([1, 2]);
    expectVErrored(() => vArrayLength(2)([1]), 'Value must be an array of exactly 2 elements');
    expectVErrored(() => vArrayLength(2)('ab'), 'Value must be an array of exactly 2 elements');
  });
});

/** The absence validators accept exactly their one value and reject the other kind of absence. */
describe('vNull and vUndefined', () => {
  test('vNull only accepts null', () => {
    expect(vNull()(null)).toBeNull();
    expectVErrored(() => vNull()(undefined), 'Value must be null');
  });

  test('vUndefined only accepts undefined', () => {
    expect(vUndefined()(undefined)).toBeUndefined();
    expectVErrored(() => vUndefined()(null), 'Value must be undefined');
  });
});

/** Validates every field with its own schema, rejecting non-objects and naming the failed field. */
describe('vObject', () => {
  interface Point {
    x: number;
    label: string;
  }

  const schema: VSchema<Point> = { x: vInt(), label: vString() };

  test('validates every field and hands back the object', () => {
    expect(vObject(schema)({ x: 1, label: 'origin' })).toEqual({ x: 1, label: 'origin' });
  });

  test('rejects a non-object', () => {
    expectVErrored(() => vObject(schema)(null), 'Value must be an object');
  });

  test('names the field that failed', () => {
    expectVErrored(
      () => vObject(schema)({ x: 'no', label: 'origin' }),
      'Error in field "x": Value must be an integer',
    );
  });
});

/** Validates every element with the element schema, rejecting non-arrays and naming the index. */
describe('vArray', () => {
  test('validates every element', () => {
    expect(vArray(vInt())([1, 2])).toEqual([1, 2]);
  });

  test('rejects a non-array', () => {
    expectVErrored(() => vArray(vInt())({ length: 0 }), 'Value must be an array');
  });

  test('points at a failing element', () => {
    expectVErrored(() => vArray(vInt())([1, 'x']), 'Error in array item: Value must be an integer');
  });
});

/** Accepts exactly the listed values and lists them in the message when one of them is not met. */
describe('vEnum', () => {
  const allowed = ['first', 'second'] as const;

  test('passes one of the allowed values through', () => {
    expect(vEnum(allowed)('first')).toBe('first');
  });

  test('rejects everything else, listing what was allowed', () => {
    expectVErrored(() => vEnum(allowed)('third'), 'Value must be one of: first, second');
  });
});

/** Runs validators in order and stops at the first failure — the pipeline that refines a base. */
describe('vPipe', () => {
  test('runs every validator in order', () => {
    const piped = vPipe(vString(), vMin(2));

    expect(piped('long enough')).toBe('long enough');
    expectVErrored(() => piped('x'), 'Value must be at least 2 characters long');
  });
});

/** Accepts a value any listed validator accepts; one satisfying none names the alternative. */
describe('vOr', () => {
  // A validator for either shape, written as the union the two validators share a value with.
  const stringOrInt = (value: string | number) =>
    typeof value === 'string' ? vString()(value) : vInt()(value);

  test('accepts a value the first validator accepts', () => {
    expect(vOr(vInt(), vInt())(5)).toBe(5);
  });

  test('accepts a value a later validator accepts', () => {
    expect(stringOrInt('text')).toBe('text');
  });

  test('rejects a value none of them accepts', () => {
    expectVErrored(
      () => vOr(vInt(), vInt())('text' as never),
      'Value must satisfy at least one of the validators',
    );
  });
});
