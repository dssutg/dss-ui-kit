/**
 * The geometry the charts and the scene renderer draw with: angle conversion and normalisation,
 * polar/cartesian conversion for arcs, Bézier sampling for curves and range merging for axes. The
 * assertions are made with `toBeCloseTo` throughout because the computations are floating point and
 * the contract is the geometry, not the last bits of the number.
 */
import { describe, expect, test } from 'vitest';
import {
  cartesianToPolar,
  degreesToRadians,
  getMinDistanceBetweenRadians,
  normalizeRadians,
  polarToCartesian,
  radiansToDegrees,
  rotatePoint2D,
  turn,
} from './angle';
import { bezier2d, bezier3d } from './bezier';
import { mergeIntegers, mergeRanges } from './range';
import { Vector2D } from './vector2d';
import { Vector3D } from './vector3d';

describe('degreesToRadians and radiansToDegrees', () => {
  test('converts in both directions', () => {
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI, 10);
    expect(radiansToDegrees(Math.PI)).toBeCloseTo(180, 10);
    expect(degreesToRadians(0)).toBe(0);
  });
});

describe('normalizeRadians', () => {
  test('wraps an angle into one turn', () => {
    expect(normalizeRadians(0)).toBe(0);
    expect(normalizeRadians(turn)).toBe(0);
    expect(normalizeRadians(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 10);
  });
});

describe('getMinDistanceBetweenRadians', () => {
  test('answers the shorter way round the circle', () => {
    expect(getMinDistanceBetweenRadians(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 10);
    expect(getMinDistanceBetweenRadians(0, (3 * Math.PI) / 2)).toBeCloseTo(Math.PI / 2, 10);
    expect(getMinDistanceBetweenRadians(0, 0)).toBe(0);
  });
});

describe('polarToCartesian and cartesianToPolar', () => {
  test('converts in both directions', () => {
    const point = polarToCartesian(Math.PI / 2, 2);

    expect(point.x).toBeCloseTo(0, 10);
    expect(point.y).toBeCloseTo(2, 10);

    const polar = cartesianToPolar(point.x, point.y);

    expect(polar.radius).toBeCloseTo(2, 10);
    expect(polar.angle).toBeCloseTo(Math.PI / 2, 10);
  });
});

describe('rotatePoint2D', () => {
  test('rotates a point about the origin', () => {
    const rotated = rotatePoint2D({ x: 1, y: 0 }, Math.PI / 2);

    expect(rotated.x).toBeCloseTo(0, 10);
    expect(rotated.y).toBeCloseTo(1, 10);
  });
});

/**
 * Merging is used to fold selected rows and axis spans into readable note text: touching ranges are
 * one span because the bounds are inclusive, and the result is always sorted.
 */
describe('mergeRanges', () => {
  test('merges overlapping ranges whether they arrive sorted or not', () => {
    expect(
      mergeRanges([
        { start: 5, end: 8 },
        { start: 1, end: 5 },
      ]),
    ).toEqual([{ start: 1, end: 8 }]);
  });

  test('keeps disjoint ranges apart, in ascending order', () => {
    expect(
      mergeRanges([
        { start: 10, end: 12 },
        { start: 1, end: 2 },
      ]),
    ).toEqual([
      { start: 1, end: 2 },
      { start: 10, end: 12 },
    ]);
  });

  test('folds a chain of touching ranges into one', () => {
    expect(
      mergeRanges([
        { start: 1, end: 3 },
        { start: 3, end: 5 },
        { start: 5, end: 7 },
      ]),
    ).toEqual([{ start: 1, end: 7 }]);
  });

  test('answers an empty list for no ranges', () => {
    expect(mergeRanges([])).toEqual([]);
  });
});

describe('mergeIntegers', () => {
  test('folds consecutive integers into ranges', () => {
    expect(mergeIntegers([1, 2, 3, 7, 9, 10])).toEqual([
      { start: 1, end: 3 },
      { start: 7, end: 7 },
      { start: 9, end: 10 },
    ]);
  });

  test('answers a single range for every integer consecutive', () => {
    expect(mergeIntegers([4])).toEqual([{ start: 4, end: 4 }]);
  });

  test('answers an empty list for no integers', () => {
    expect(mergeIntegers([])).toEqual([]);
  });
});

/**
 * The curve's contract is that the end control points are on it and the middle ones only pull: that
 * is what makes them controls rather than vertices.
 */
describe('bezier3d', () => {
  test('passes through the control points at the ends and interpolates between', () => {
    const points = [new Vector3D(0, 0, 0), new Vector3D(0, 0, 10)];

    expect(bezier3d(points, 0).equals(Vector3D.ZERO)).toBe(true);
    expect(bezier3d(points, 1).equals(new Vector3D(0, 0, 10))).toBe(true);
    expect(bezier3d(points, 0.5).equals(new Vector3D(0, 0, 5))).toBe(true);
  });

  test('bends towards an intermediate control point without touching it', () => {
    const points = [new Vector3D(0, 0, 0), new Vector3D(10, 0, 0), new Vector3D(10, 10, 0)];
    const middle = bezier3d(points, 0.5);

    // The curve at t=0.5 is the average of the midpoint of the chord and the control point.
    expect(middle.equals(new Vector3D(7.5, 2.5, 0))).toBe(true);
  });
});

describe('bezier2d', () => {
  test('is the planar case of the three-dimensional curve', () => {
    const points = [new Vector2D(0, 0), new Vector2D(4, 8)];

    expect(bezier2d(points, 0.5).equals(new Vector2D(2, 4))).toBe(true);
  });
});
