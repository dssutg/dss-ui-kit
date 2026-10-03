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

describe('VError', () => {
  test('is an Error named so a catch can tell it from a real failure', () => {
    const error = new VError('bad value');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('VError');
    expect(error.message).toBe('bad value');
  });
});

describe('vBoolean', () => {
  test('passes a boolean through', () => {
    expect(vBoolean()(true)).toBe(true);
    expect(vBoolean()(false)).toBe(false);
  });

  test('rejects everything else', () => {
    expectVErrored(() => vBoolean()('true'), 'Value must be a boolean');
  });
});

describe('vNumber', () => {
  test('passes a number through, NaN included', () => {
    expect(vNumber()(1.5)).toBe(1.5);
    expect(vNumber()(Number.NaN)).toBeNaN();
  });

  test('rejects a non-number', () => {
    expectVErrored(() => vNumber()('1'), 'Value must be a number');
  });
});

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

describe('vString', () => {
  test('passes a string through, empty included', () => {
    expect(vString()('text')).toBe('text');
    expect(vString()('')).toBe('');
  });

  test('rejects a non-string', () => {
    expectVErrored(() => vString()(5), 'Value must be a string');
  });
});

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

describe('vEnum', () => {
  const allowed = ['first', 'second'] as const;

  test('passes one of the allowed values through', () => {
    expect(vEnum(allowed)('first')).toBe('first');
  });

  test('rejects everything else, listing what was allowed', () => {
    expectVErrored(() => vEnum(allowed)('third'), 'Value must be one of: first, second');
  });
});

describe('vPipe', () => {
  test('runs every validator in order', () => {
    const piped = vPipe(vString(), vMin(2));

    expect(piped('long enough')).toBe('long enough');
    expectVErrored(() => piped('x'), 'Value must be at least 2 characters long');
  });
});

describe('vOr', () => {
  test('accepts a value the first validator accepts', () => {
    expect(vOr(vInt(), vString())(5)).toBe(5);
  });

  test('accepts a value a later validator accepts', () => {
    expect(vOr(vInt(), vString())('text')).toBe('text');
  });

  test('rejects a value none of them accepts', () => {
    expectVErrored(
      () => vOr(vInt(), vString())(true),
      'Value must satisfy at least one of the validators',
    );
  });
});
