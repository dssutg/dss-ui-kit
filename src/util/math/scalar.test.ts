/**
 * The scalar toolkit the rest of the library clamps, interpolates and sorts with. The suite pins the
 * behaviours callers cannot re-derive from the names: `unlerp` reporting progress outside the bounds
 * rather than clamping, `modulo` and `wrapIndex` wrapping instead of mirroring `%`, and
 * `naturalCmp` ordering embedded numbers as numbers — which is what keeps `line2` before `line10`
 * in a sorted column.
 */
import { describe, expect, test } from 'vitest';
import {
  binomial,
  clamp,
  cmp,
  lerp,
  lerpRange,
  modulo,
  naturalCmp,
  roundToPowerOfTwo,
  smoothStep,
  step,
  unlerp,
  wrapIndex,
} from './';

describe('clamp', () => {
  test('keeps a value inside the bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  test('pulls a value below the range up to the minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  test('pulls a value above the range down to the maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

/**
 * The pair exists so a value can be mapped onto a zero-to-one progress and back again; whether it
 * clamps on the way out is the difference between a slider that stops and one that overshoots.
 */
describe('lerp and unlerp', () => {
  test('interpolates between two bounds', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  test('unlerp is the inverse of lerp', () => {
    expect(unlerp(0, 10, 5)).toBe(0.5);
    expect(unlerp(10, 20, 12.5)).toBe(0.25);
  });

  test('unlerp reports progress outside the bounds rather than clamping', () => {
    expect(unlerp(0, 10, 20)).toBe(2);
  });

  test('lerpRange maps a value from one range onto another', () => {
    expect(lerpRange(0, 100, 0, 1, 50)).toBeCloseTo(0.5, 10);
  });
});

describe('modulo', () => {
  test('wraps negative operands into the positive range', () => {
    expect(modulo(-1, 5)).toBe(4);
    expect(modulo(-6, 5)).toBe(4);
  });

  test('agrees with % for positive operands', () => {
    expect(modulo(7, 5)).toBe(2);
  });
});

describe('wrapIndex', () => {
  test('wraps an index past either end of a sequence', () => {
    expect(wrapIndex(5, 3)).toBe(2);
    expect(wrapIndex(-1, 3)).toBe(2);
  });

  test('answers zero for an empty sequence', () => {
    expect(wrapIndex(3, 0)).toBe(0);
  });
});

describe('step', () => {
  test('answers whether a value has reached a threshold', () => {
    expect(step(5, 5)).toBe(1);
    expect(step(6, 5)).toBe(1);
    expect(step(4, 5)).toBe(0);
  });
});

describe('smoothStep', () => {
  test('is zero at the lower edge and one at the upper edge', () => {
    expect(smoothStep(0, 0, 10)).toBe(0);
    expect(smoothStep(10, 0, 10)).toBe(1);
  });

  test('rises smoothly between the edges', () => {
    expect(smoothStep(5, 0, 10)).toBeCloseTo(0.5, 10);
  });

  test('holds beyond the edges', () => {
    expect(smoothStep(-5, 0, 10)).toBe(0);
    expect(smoothStep(15, 0, 10)).toBe(1);
  });
});

describe('binomial', () => {
  test('counts the ways to choose k out of n', () => {
    expect(binomial(5, 2)).toBe(10);
    expect(binomial(4, 4)).toBe(1);
    expect(binomial(4, 0)).toBe(1);
  });

  test('answers zero outside the range', () => {
    expect(binomial(4, 5)).toBe(0);
    expect(binomial(4, -1)).toBe(0);
  });
});

describe('roundToPowerOfTwo', () => {
  test('rounds up to the next power of two', () => {
    expect(roundToPowerOfTwo(5)).toBe(8);
    expect(roundToPowerOfTwo(8)).toBe(8);
    expect(roundToPowerOfTwo(9)).toBe(16);
  });

  test('answers zero for a non-positive value', () => {
    expect(roundToPowerOfTwo(0)).toBe(0);
    expect(roundToPowerOfTwo(-3)).toBe(0);
  });
});

/** The comparator contract the sort columns build on. */
describe('cmp', () => {
  test('orders two values for a sort comparator', () => {
    expect(cmp(1, 2)).toBe(-1);
    expect(cmp(2, 1)).toBe(1);
    expect(cmp(1, 1)).toBe(0);
  });
});

/**
 * Human-facing ordering: a column sorted with this comparator has to read naturally, so `line10`
 * coming after `line2` is the property under test, not an accident of string comparison.
 */
describe('naturalCmp', () => {
  test('orders embedded numbers as numbers', () => {
    expect(naturalCmp('line2', 'line10')).toBe(-1);
    expect(naturalCmp('line10', 'line2')).toBe(1);
  });

  test('falls back to text order when the numbers are equal', () => {
    expect(naturalCmp('line01', 'line1')).toBe(0);
  });

  test('compares text segments as text', () => {
    expect(naturalCmp('a2', 'b2')).toBe(-1);
  });

  test('answers zero for equal strings', () => {
    expect(naturalCmp('same', 'same')).toBe(0);
  });
});
