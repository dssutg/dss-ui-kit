import { describe, expect, test } from 'vitest';
import { Vector2D } from './vector2d';

describe('Vector2D.isZero', () => {
  test('is true for the zero vector', () => {
    expect(new Vector2D(0, 0).isZero()).toBe(true);
  });

  // A negative coordinate is as far from zero as the positive one, so it is not zero. Comparing
  // without `Math.abs` read every negative component as below the tolerance.
  test('is false for a negative coordinate as far from zero as a positive one', () => {
    expect(new Vector2D(-1000, 0).isZero()).toBe(false);
    expect(new Vector2D(0, -1000).isZero()).toBe(false);
    expect(new Vector2D(-1000, -1000).isZero()).toBe(false);
  });

  test('reads a component within the tolerance as zero', () => {
    expect(new Vector2D(1e-12, -1e-12).isZero()).toBe(true);
  });
});
