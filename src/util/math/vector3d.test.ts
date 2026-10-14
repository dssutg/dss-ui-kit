// SPDX-License-Identifier: MIT
/**
 * The spatial vector the scene renderer transforms points with. The suite pins the behaviours
 * callers cannot re-derive from the names: comparisons are tolerant by default and strictly-less,
 * `normalize` and `scaleTo` throw for a zero vector rather than quietly returning it, `rotate`
 * turns counterclockwise about the named axis, and `getIntersection` answers the point only where
 * the two *segments* meet, not where their lines do.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Vector3D } from './vector3d';

describe('Vector3D.isZero', () => {
  test('is true for the zero vector', () => {
    expect(new Vector3D(0, 0, 0).isZero()).toBe(true);
  });

  // A negative coordinate is as far from zero as the positive one, so it is not zero. Comparing
  // without `Math.abs` read every negative component as below the tolerance.
  test('is false for a negative coordinate as far from zero as a positive one', () => {
    expect(new Vector3D(-1000, 0, 0).isZero()).toBe(false);
    expect(new Vector3D(0, -1000, 0).isZero()).toBe(false);
    expect(new Vector3D(0, 0, -1000).isZero()).toBe(false);
  });

  test('reads a component within the tolerance as zero', () => {
    expect(new Vector3D(1e-12, -1e-12, 1e-12).isZero()).toBe(true);
  });
});

describe('Vector3D.directions', () => {
  test('names the compass directions and the two axes out of the plane', () => {
    expect(Vector3D.ZERO.toArray()).toEqual([0, 0, 0]);
    expect(Vector3D.ONE.toArray()).toEqual([1, 1, 1]);
    expect(Vector3D.NORTH.toArray()).toEqual([0, 1, 0]);
    expect(Vector3D.NORTH_EAST.toArray()).toEqual([1, 1, 0]);
    expect(Vector3D.NORTH_WEST.toArray()).toEqual([-1, 1, 0]);
    expect(Vector3D.EAST.toArray()).toEqual([1, 0, 0]);
    expect(Vector3D.WEST.toArray()).toEqual([-1, 0, 0]);
    expect(Vector3D.SOUTH.toArray()).toEqual([0, -1, 0]);
    expect(Vector3D.SOUTH_EAST.toArray()).toEqual([1, -1, 0]);
    expect(Vector3D.SOUTH_WEST.toArray()).toEqual([-1, -1, 0]);
    expect(Vector3D.UP.toArray()).toEqual([0, 0, 1]);
    expect(Vector3D.DOWN.toArray()).toEqual([0, 0, -1]);
  });
});

describe('Vector3D construction', () => {
  test('builds from components, a point and an array', () => {
    expect(new Vector3D(3, 4, 5).toArray()).toEqual([3, 4, 5]);
    expect(Vector3D.fromPoint3D({ x: 3, y: 4, z: 5 }).toArray()).toEqual([3, 4, 5]);
    expect(Vector3D.fromArray([3, 4, 5]).toArray()).toEqual([3, 4, 5]);
  });

  test('reads itself back out as a string', () => {
    expect(new Vector3D(3, 4, 5).toString()).toBe('Vector3D(3, 4, 5)');
  });

  test('copies without aliasing', () => {
    const subject = new Vector3D(3, 4, 5);
    const copy = subject.copy();

    expect(copy).not.toBe(subject);
    expect(copy.toArray()).toEqual([3, 4, 5]);

    copy.x = 10;

    expect(subject.x).toBe(3);
  });
});

describe('Vector3D arithmetic', () => {
  test('adds, subtracts, scales and negates without mutating its input', () => {
    const source = new Vector3D(1, 2, 3);

    expect(source.add(new Vector3D(10, 20, 30)).toArray()).toEqual([11, 22, 33]);
    expect(source.subtract(new Vector3D(10, 20, 30)).toArray()).toEqual([-9, -18, -27]);
    expect(source.scaleScalar(3).toArray()).toEqual([3, 6, 9]);
    expect(source.scale(new Vector3D(10, 20, 30)).toArray()).toEqual([10, 40, 90]);
    expect(source.negate().toArray()).toEqual([-1, -2, -3]);

    expect(source.toArray()).toEqual([1, 2, 3]);
  });
});

describe('Vector3D length', () => {
  test('answers the pythagorean length of all three components', () => {
    const subject = new Vector3D(3, 4, 12);

    expect(subject.length()).toBeCloseTo(13, 10);
    expect(subject.lengthSquared()).toBe(169);
    expect(Vector3D.ZERO.length()).toBe(0);
  });

  test('answers the distance to another vector', () => {
    expect(new Vector3D(3, 4, 12).distanceTo(Vector3D.ZERO)).toBeCloseTo(13, 10);
    expect(new Vector3D(3, 4, 12).distanceTo(new Vector3D(6, 8, 24))).toBeCloseTo(13, 10);
  });

  test('answers whether the length fits inside a radius, boundary inclusive', () => {
    const subject = new Vector3D(3, 4, 12);

    expect(subject.insideRadius(13)).toBe(true);
    expect(subject.insideRadius(12.99)).toBe(false);
  });
});

describe('Vector3D.equals', () => {
  test('is tolerant by default, but strictly less than the tolerance', () => {
    expect(new Vector3D(0, 0, 0).equals(new Vector3D(1e-11, -1e-11, 0))).toBe(true);

    // A difference of exactly the tolerance is not equal: the comparison is `<`, not `<=`.
    expect(new Vector3D(0, 0, 0).equals(new Vector3D(1e-10, 0, 0))).toBe(false);
  });

  test('rejects a tolerance the caller passes explicitly', () => {
    expect(new Vector3D(0, 0, 0).equals(new Vector3D(1e-11, 0, 0), 1e-12)).toBe(false);
  });

  test('is false when any component differs', () => {
    const subject = new Vector3D(0, 0, 0);

    expect(subject.equals(new Vector3D(1e-9, 0, 0))).toBe(false);
    expect(subject.equals(new Vector3D(0, 1e-9, 0))).toBe(false);
    expect(subject.equals(new Vector3D(0, 0, 1e-9))).toBe(false);
  });
});

describe('Vector3D zero checks', () => {
  test('isZeroStrict reads only exact zeros', () => {
    expect(new Vector3D(0, 0, 0).isZeroStrict()).toBe(true);
    expect(new Vector3D(1, 0, 0).isZeroStrict()).toBe(false);
    expect(new Vector3D(0, 1, 0).isZeroStrict()).toBe(false);
    expect(new Vector3D(0, 0, 1).isZeroStrict()).toBe(false);

    // The strict check exists next to the tolerant one, so a within-tolerance component is not zero.
    expect(new Vector3D(1e-12, 0, 0).isZeroStrict()).toBe(false);
  });
});

describe('Vector3D.isUnit', () => {
  test('is true for a length of one within the default tolerance', () => {
    expect(new Vector3D(1, 0, 0).isUnit()).toBe(true);
  });

  test('is false for a length away from one', () => {
    expect(new Vector3D(2, 0, 0).isUnit()).toBe(false);
  });

  test('honours a tolerance the caller passes explicitly', () => {
    expect(new Vector3D(1.00000000001, 0, 0).isUnit(1e-12)).toBe(false);
    expect(new Vector3D(1.00000000001, 0, 0).isUnit(1e-9)).toBe(true);
  });
});

describe('Vector3D.normalize', () => {
  test('scales itself to a length of one', () => {
    const normalized = new Vector3D(3, 4, 12).normalize();

    expect(normalized.x).toBeCloseTo(3 / 13, 12);
    expect(normalized.y).toBeCloseTo(4 / 13, 12);
    expect(normalized.z).toBeCloseTo(12 / 13, 12);
    expect(normalized.length()).toBeCloseTo(1, 10);
  });

  test('throws for a zero vector', () => {
    expect(() => Vector3D.ZERO.normalize()).toThrow('Cannot normalize a zero vector');
  });
});

describe('Vector3D products', () => {
  test('answers the dot product', () => {
    expect(new Vector3D(1, 2, 3).dot(new Vector3D(4, 5, 6))).toBe(32);
  });

  test('answers the right-hand cross product, and the sign of its direction', () => {
    // EAST crossed with NORTH is UP.
    expect(Vector3D.EAST.cross(Vector3D.NORTH).toArray()).toEqual([0, 0, 1]);
    expect(Vector3D.NORTH.cross(Vector3D.EAST).toArray()).toEqual([0, 0, -1]);

    // The cross of a vector with itself is the zero vector.
    expect(Vector3D.EAST.cross(Vector3D.EAST).toArray()).toEqual([0, 0, 0]);
  });
});

describe('Vector3D transforms', () => {
  test('interpolates towards another vector', () => {
    const lerp = new Vector3D(0, 0, 0).lerp(new Vector3D(8, 12, 20), 0.25);

    expect(lerp.toArray()).toEqual([2, 3, 5]);
    expect(new Vector3D(0, 0, 0).lerp(new Vector3D(8, 12, 20), 1).toArray()).toEqual([8, 12, 20]);
  });

  // A quarter turn about the named axis carries one unit vector onto another, which is the reading
  // of each branch worth pinning: positive angles turn the way the right-hand rule says.
  test('rotates about the x axis, turning NORTH onto UP', () => {
    const rotated = Vector3D.NORTH.rotate(Math.PI / 2, 'x');

    expect(rotated.x).toBeCloseTo(0, 10);
    expect(rotated.y).toBeCloseTo(0, 10);
    expect(rotated.z).toBeCloseTo(1, 10);
  });

  test('rotates about the y axis, turning EAST onto DOWN', () => {
    const rotated = Vector3D.EAST.rotate(Math.PI / 2, 'y');

    expect(rotated.x).toBeCloseTo(0, 10);
    expect(rotated.y).toBeCloseTo(0, 10);
    expect(rotated.z).toBeCloseTo(-1, 10);
  });

  test('rotates about the z axis, turning EAST onto NORTH', () => {
    const rotated = Vector3D.EAST.rotate(Math.PI / 2, 'z');

    expect(rotated.x).toBeCloseTo(0, 10);
    expect(rotated.y).toBeCloseTo(1, 10);
    expect(rotated.z).toBeCloseTo(0, 10);
  });

  test('clamps the length, keeping the direction', () => {
    const subject = new Vector3D(3, 4, 12);

    // Under the maximum the vector comes back as a copy, not a new scale.
    const untouched = subject.clampLength(100);

    expect(untouched).not.toBe(subject);
    expect(untouched.toArray()).toEqual([3, 4, 12]);

    const clamped = subject.clampLength(12);

    expect(clamped.x).toBeCloseTo(36 / 13, 10);
    expect(clamped.y).toBeCloseTo(48 / 13, 10);
    expect(clamped.z).toBeCloseTo(144 / 13, 10);
  });

  test('projects onto another vector', () => {
    expect(new Vector3D(3, 4, 0).project(new Vector3D(2, 2, 0)).toArray()).toEqual([3.5, 3.5, 0]);
  });

  test('reflects across a normal', () => {
    expect(new Vector3D(0, 1, 0).reflect(new Vector3D(0, 1, 0)).toArray()).toEqual([0, -1, 0]);
    // A vector already half across the normal flips the other two-thirds.
    expect(new Vector3D(1, -1, 0).reflect(new Vector3D(0, 1, 0)).toArray()).toEqual([1, 1, 0]);
  });

  test('answers the normal of a triangular face, apex first', () => {
    // The face through (1, 1, 1), (2, 1, 1) and (1, 2, 1) faces towards negative z.
    const face = new Vector3D(1, 1, 1).normal(Vector3D.EAST, Vector3D.NORTH);

    expect(face.toArray()).toEqual([1, 1, -1]);
  });

  test('scales to an exact length, throwing for a zero vector', () => {
    expect(new Vector3D(3, 4, 12).scaleTo(26).toArray()).toEqual([6, 8, 24]);

    expect(() => Vector3D.ZERO.scaleTo(10)).toThrow('Cannot scale a zero vector');
  });
});

describe('Vector3D components', () => {
  test('answers the signed magnitudes', () => {
    const subject = new Vector3D(8, -4, 2);

    expect(subject.minComponent()).toBe(-4);
    expect(subject.maxComponent()).toBe(8);
  });

  test('answers the absolute magnitude of each component', () => {
    expect(new Vector3D(-3, 4, -5).abs().toArray()).toEqual([3, 4, 5]);
  });

  test('answers the sign of each component, zero included', () => {
    expect(new Vector3D(-2, 3, 0).sign().toArray()).toEqual([-1, 1, 0]);
  });

  test('truncates towards zero', () => {
    expect(new Vector3D(-1.7, 2.3, -2.4).trunc().toArray()).toEqual([-1, 2, -2]);
  });

  test('floors, with the negative case reading below the value', () => {
    expect(new Vector3D(-1.7, 2.3, -0.4).floor().toArray()).toEqual([-2, 2, -1]);
  });

  // Math.round rounds halves towards positive infinity, not away from zero: -1.5 rounds to -1.
  test('rounds halves upwards', () => {
    expect(new Vector3D(-1.5, 0.6, 2.5).round().toArray()).toEqual([-1, 1, 3]);
  });

  test('ceils, with the negative case reading above the value', () => {
    expect(new Vector3D(-1.2, 0.2, 0.4).ceil().toArray()).toEqual([-1, 1, 1]);
  });

  // The three snap functions separate on the halves and on the below-one side: a component of 1 in
  // a grid of 4 rounds to 0 and ceils to 4, while 3 in a grid of 2 ceils to 4 and floors to 2.
  describe('snapped rounding', () => {
    test('rounds to the nearest multiple', () => {
      expect(new Vector3D(7, 3, 9).snappedRound(new Vector3D(4, 2, 5)).toArray()).toEqual([
        8, 4, 10,
      ]);
      expect(new Vector3D(1, 1, 1).snappedRound(new Vector3D(4, 2, 5)).toArray()).toEqual([
        0, 2, 0,
      ]);
    });

    test('floors to the multiple below', () => {
      expect(new Vector3D(7, 3, 9).snappedFloor(new Vector3D(4, 2, 5)).toArray()).toEqual([
        4, 2, 5,
      ]);
      expect(new Vector3D(1, 1, 1).snappedFloor(new Vector3D(4, 2, 5)).toArray()).toEqual([
        0, 0, 0,
      ]);
    });

    test('ceils to the multiple above', () => {
      expect(new Vector3D(7, 3, 9).snappedCeil(new Vector3D(4, 2, 5)).toArray()).toEqual([
        8, 4, 10,
      ]);
      expect(new Vector3D(1, 1, 1).snappedCeil(new Vector3D(4, 2, 5)).toArray()).toEqual([4, 2, 5]);
    });
  });
});

describe('Vector3D.getIntersection', () => {
  // Two segments with directions (1, 1) and (1, -1) through the same point cross at that point.
  test('answers the point where two crossing segments meet', () => {
    const point = Vector3D.getIntersection(
      new Vector3D(0, 0, 0),
      new Vector3D(2, 2, 0),
      new Vector3D(0, 2, 0),
      new Vector3D(2, 0, 0),
    );

    if (point === null) {
      throw new Error('the two segments cross');
    }

    expect(point.toArray()).toEqual([1, 1, 0]);
  });

  test('answers null for parallel segments', () => {
    expect(
      Vector3D.getIntersection(
        new Vector3D(0, 0, 0),
        new Vector3D(1, 1, 0),
        new Vector3D(0, 1, 0),
        new Vector3D(1, 2, 0),
      ),
    ).toBeNull();
  });

  test('answers null when the meeting point falls before the first segment', () => {
    // The infinite lines meet at (2, 2), behind the first segment, which runs from (1, 1) to (0, 0).
    expect(
      Vector3D.getIntersection(
        new Vector3D(1, 1, 0),
        new Vector3D(0, 0, 0),
        new Vector3D(1, 3, 0),
        new Vector3D(3, 1, 0),
      ),
    ).toBeNull();
  });

  test('answers null when the meeting point falls after the first segment', () => {
    // The infinite lines meet at (2, 2), past the first segment's end at (1, 1).
    expect(
      Vector3D.getIntersection(
        new Vector3D(0, 0, 0),
        new Vector3D(1, 1, 0),
        new Vector3D(1, 3, 0),
        new Vector3D(3, 1, 0),
      ),
    ).toBeNull();
  });

  test('answers null when the meeting point falls before the second segment', () => {
    // The infinite lines meet at the origin, which lies behind second segment's start at (3, -3).
    expect(
      Vector3D.getIntersection(
        new Vector3D(0, 0, 0),
        new Vector3D(2, 2, 0),
        new Vector3D(3, -3, 0),
        new Vector3D(4, -4, 0),
      ),
    ).toBeNull();
  });

  test('answers null when the meeting point falls after the second segment', () => {
    // The infinite lines meet at (1, 1), which lies past the vertical segment's end at (1, -1).
    expect(
      Vector3D.getIntersection(
        new Vector3D(0, 0, 0),
        new Vector3D(2, 2, 0),
        new Vector3D(1, -2, 0),
        new Vector3D(1, -1, 0),
      ),
    ).toBeNull();
  });
});

describe('Vector3D.randomDirection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('normalizes the components it draws', () => {
    // 1 becomes x = 2 * 1 - 1 = 1 and 0.5 becomes y = z = 0, so the draw is EAST.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5);

    expect(Vector3D.randomDirection().toArray()).toEqual([1, 0, 0]);
  });

  test('the result is a unit vector whatever the draw', () => {
    // A draw of 1 for every component is the diagonal (1, 1, 1).
    vi.spyOn(Math, 'random').mockReturnValue(1);

    const direction = Vector3D.randomDirection();

    expect(direction.length()).toBeCloseTo(1, 10);
  });
});
