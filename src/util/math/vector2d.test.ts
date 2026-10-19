// SPDX-License-Identifier: MIT
/**
 * The planar vector every chart and canvas transform is built on. The suite pins the behaviours
 * callers cannot re-derive from the names: comparisons are tolerant by default and strictly-less
 * (two components exactly a tolerance apart are not equal), `normalize` and `scaleTo` throw for a
 * zero vector rather than quietly returning it, positive angles turn counterclockwise, and
 * `getIntersection` answers the point only where the two *segments* meet, not where their lines do.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
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

describe('Vector2D.directions', () => {
  test('names the compass directions and the two identities', () => {
    expect(Vector2D.ZERO.toArray()).toEqual([0, 0]);
    expect(Vector2D.ONE.toArray()).toEqual([1, 1]);
    expect(Vector2D.NORTH.toArray()).toEqual([0, 1]);
    expect(Vector2D.NORTH_EAST.toArray()).toEqual([1, 1]);
    expect(Vector2D.NORTH_WEST.toArray()).toEqual([-1, 1]);
    expect(Vector2D.EAST.toArray()).toEqual([1, 0]);
    expect(Vector2D.WEST.toArray()).toEqual([-1, 0]);
    expect(Vector2D.SOUTH.toArray()).toEqual([0, -1]);
    expect(Vector2D.SOUTH_EAST.toArray()).toEqual([1, -1]);
    expect(Vector2D.SOUTH_WEST.toArray()).toEqual([-1, -1]);
  });
});

describe('Vector2D construction', () => {
  test('builds from components, a point and an array', () => {
    expect(new Vector2D(3, 4).toArray()).toEqual([3, 4]);
    expect(Vector2D.fromPoint2D({ x: 3, y: 4 }).toArray()).toEqual([3, 4]);
    expect(Vector2D.fromArray([3, 4]).toArray()).toEqual([3, 4]);
  });

  test('reads itself back out as a string', () => {
    expect(new Vector2D(3, 4).toString()).toBe('Vector2D(3, 4)');
  });

  test('copies without aliasing', () => {
    const subject = new Vector2D(3, 4);
    const copy = subject.copy();

    expect(copy).not.toBe(subject);
    expect(copy.toArray()).toEqual([3, 4]);

    copy.x = 10;

    expect(subject.x).toBe(3);
  });
});

describe('Vector2D arithmetic', () => {
  test('adds, subtracts, scales and negates without mutating its input', () => {
    const source = new Vector2D(1, 2);

    expect(source.add(new Vector2D(10, 20)).toArray()).toEqual([11, 22]);
    expect(source.subtract(new Vector2D(10, 20)).toArray()).toEqual([-9, -18]);
    expect(source.scaleScalar(3).toArray()).toEqual([3, 6]);
    expect(source.scale(new Vector2D(10, 20)).toArray()).toEqual([10, 40]);
    expect(source.negate().toArray()).toEqual([-1, -2]);

    expect(source.toArray()).toEqual([1, 2]);
  });
});

describe('Vector2D length', () => {
  test('answers the pythagorean length', () => {
    const subject = new Vector2D(3, 4);

    expect(subject.length()).toBeCloseTo(5, 10);
    expect(subject.lengthSquared()).toBe(25);
    expect(Vector2D.ZERO.length()).toBe(0);
  });

  test('answers the distance to another vector', () => {
    expect(new Vector2D(3, 4).distanceTo(Vector2D.ZERO)).toBeCloseTo(5, 10);
    expect(new Vector2D(3, 4).distanceTo(new Vector2D(6, 8))).toBeCloseTo(5, 10);
  });

  test('answers whether the length fits inside a radius, boundary inclusive', () => {
    const subject = new Vector2D(3, 4);

    expect(subject.insideRadius(5)).toBe(true);
    expect(subject.insideRadius(4.99)).toBe(false);
  });
});

describe('Vector2D.equals', () => {
  test('is tolerant by default, but strictly less than the tolerance', () => {
    expect(new Vector2D(0, 0).equals(new Vector2D(1e-11, -1e-11))).toBe(true);

    // A difference of exactly the tolerance is not equal: the comparison is `<`, not `<=`.
    expect(new Vector2D(0, 0).equals(new Vector2D(1e-10, 0))).toBe(false);
  });

  test('rejects a tolerance the caller passes explicitly', () => {
    expect(new Vector2D(0, 0).equals(new Vector2D(1e-11, 0), 1e-12)).toBe(false);
  });

  test('is false when either component differs', () => {
    const subject = new Vector2D(0, 0);

    expect(subject.equals(new Vector2D(1e-9, 0))).toBe(false);
    expect(subject.equals(new Vector2D(0, 1e-9))).toBe(false);
  });
});

describe('Vector2D zero checks', () => {
  test('isZeroStrict reads only exact zeros', () => {
    expect(new Vector2D(0, 0).isZeroStrict()).toBe(true);
    expect(new Vector2D(1, 0).isZeroStrict()).toBe(false);
    expect(new Vector2D(0, 1).isZeroStrict()).toBe(false);

    // The strict check exists next to the tolerant one, so a within-tolerance component is not zero.
    expect(new Vector2D(1e-12, 0).isZeroStrict()).toBe(false);
  });
});

describe('Vector2D.isUnit', () => {
  test('is true for a length of one within the default tolerance', () => {
    expect(new Vector2D(1, 0).isUnit()).toBe(true);
  });

  test('is false for a length away from one', () => {
    expect(new Vector2D(2, 0).isUnit()).toBe(false);
  });

  test('honours a tolerance the caller passes explicitly', () => {
    expect(new Vector2D(1.00000000001, 0).isUnit(1e-12)).toBe(false);
    expect(new Vector2D(1.00000000001, 0).isUnit(1e-9)).toBe(true);
  });
});

describe('Vector2D.normalize', () => {
  test('scales itself to a length of one', () => {
    const normalized = new Vector2D(3, 4).normalize();

    // The scale rounds a half unit away from the literals, so the comparison is close.
    expect(normalized.x).toBeCloseTo(0.6, 12);
    expect(normalized.y).toBeCloseTo(0.8, 12);
    expect(normalized.length()).toBeCloseTo(1, 10);
  });

  test('throws for a zero vector', () => {
    expect(() => Vector2D.ZERO.normalize()).toThrow('Cannot normalize a zero vector');
  });
});

describe('Vector2D products', () => {
  test('answers the dot product', () => {
    expect(new Vector2D(3, 4).dot(new Vector2D(1, 2))).toBe(11);
  });

  test('answers the signed cross product', () => {
    // EAST crossed with NORTH is out of the plane, which for two components is +1.
    expect(new Vector2D(1, 0).cross(new Vector2D(0, 1))).toBe(1);
    expect(new Vector2D(0, 1).cross(new Vector2D(1, 0))).toBe(-1);
  });

  test('angles two vectors, throwing for a zero vector', () => {
    expect(new Vector2D(1, 0).angleBetween(new Vector2D(0, 1))).toBeCloseTo(Math.PI / 2, 10);
    expect(new Vector2D(1, 0).angleBetween(new Vector2D(1, 0))).toBeCloseTo(0, 10);
    expect(new Vector2D(1, 0).angleBetween(new Vector2D(-1, 0))).toBeCloseTo(Math.PI, 10);

    expect(() => Vector2D.ZERO.angleBetween(Vector2D.EAST)).toThrow(
      'Cannot calculate angle with a zero vector',
    );
  });
});

describe('Vector2D polar form', () => {
  test('answers the angle from the x axis', () => {
    expect(new Vector2D(0, 1).getPolarAngle()).toBeCloseTo(Math.PI / 2, 10);
    expect(new Vector2D(-1, 0).getPolarAngle()).toBeCloseTo(Math.PI, 10);
  });

  test('answers radius and angle together', () => {
    const polar = new Vector2D(3, 4).toPolar();

    expect(polar.radius).toBeCloseTo(5, 10);
    expect(polar.angle).toBeCloseTo(Math.atan2(4, 3), 15);
  });

  test('builds from an angle, and from a radius and an angle', () => {
    const unit = Vector2D.fromPolarAngle(Math.PI / 2);

    expect(unit.x).toBeCloseTo(0, 10);
    expect(unit.y).toBeCloseTo(1, 10);

    const scaled = Vector2D.fromPolar({ radius: 2, angle: Math.PI / 2 });

    expect(scaled.x).toBeCloseTo(0, 10);
    expect(scaled.y).toBeCloseTo(2, 10);
  });
});

describe('Vector2D transforms', () => {
  test('interpolates towards another vector', () => {
    const lerp = new Vector2D(0, 0).lerp(new Vector2D(10, 20), 0.25);

    expect(lerp.toArray()).toEqual([2.5, 5]);
    expect(new Vector2D(0, 0).lerp(new Vector2D(10, 20), 1).toArray()).toEqual([10, 20]);
  });

  test('rotates counterclockwise for a positive angle', () => {
    const rotated = Vector2D.EAST.rotate(Math.PI / 2);

    // cos(π/2) is not exactly zero, so the comparison is close rather than exact.
    expect(rotated.x).toBeCloseTo(0, 10);
    expect(rotated.y).toBeCloseTo(1, 10);

    const clockwise = Vector2D.EAST.rotate(-Math.PI / 2);

    expect(clockwise.y).toBeCloseTo(-1, 10);
  });

  test('rotates about a point other than the origin', () => {
    // EAST turned a quarter turn about (2, 1) swings round to the point directly above the centre.
    const rotated = new Vector2D(1, 0).rotateAround(new Vector2D(2, 1), Math.PI / 2);

    expect(rotated.x).toBeCloseTo(3, 10);
    expect(rotated.y).toBeCloseTo(0, 10);
  });

  test('clamps the length, keeping the direction', () => {
    const subject = new Vector2D(3, 4);

    // Under the maximum the vector comes back as a copy, not a new scale.
    const untouched = subject.clampLength(10);

    expect(untouched).not.toBe(subject);
    expect(untouched.toArray()).toEqual([3, 4]);

    const clamped = subject.clampLength(4);

    expect(clamped.x).toBeCloseTo(2.4, 10);
    expect(clamped.y).toBeCloseTo(3.2, 10);
  });

  test('projects onto another vector', () => {
    // 0.75 of the way along (2, 2) is (1.5, 1.5).
    expect(new Vector2D(3, 4).project(new Vector2D(2, 2)).toArray()).toEqual([3.5, 3.5]);
  });

  test('reflects across a normal', () => {
    expect(new Vector2D(0, 1).reflect(new Vector2D(0, 1)).toArray()).toEqual([0, -1]);
    // A vector already half across the normal flips the other two-thirds.
    expect(new Vector2D(1, -1).reflect(new Vector2D(0, 1)).toArray()).toEqual([1, 1]);
  });

  test('scales to an exact length, throwing for a zero vector', () => {
    expect(new Vector2D(3, 4).scaleTo(10).toArray()).toEqual([6, 8]);

    expect(() => Vector2D.ZERO.scaleTo(10)).toThrow('Cannot scale a zero vector');
  });

  test('answers the perpendicular normal', () => {
    // (-y, x) turns a vector a quarter turn counterclockwise.
    expect(new Vector2D(4, -3).normal().toArray()).toEqual([3, 4]);
  });

  // `-this.y` is `-0` when `this.y` is `+0`, and `this.x` can arrive as `-0`; both would print as
  // `-0` and fail a strict comparison against the plain zero.
  test('answers a normal with plain zeros, not negative zeros', () => {
    // (0,1).normal() = (-1, 0); -1 is fine, 0 is +0
    const normal = new Vector2D(0, 1).normal();

    expect(Object.is(normal.y, 0)).toBe(true);
    expect(normal.toString()).toBe('Vector2D(-1, 0)');

    // (1,0).normal() = (0, 1); if 1 gave -0 somewhere? no: (-this.y, this.x) = (0, 1)
    const fromHorizontal = new Vector2D(1, 0).normal();

    expect(Object.is(fromHorizontal.x, 0)).toBe(true);
    expect(fromHorizontal.toString()).toBe('Vector2D(0, 1)');

    // (-0, 1).normal() = (-1, -0) -> becomes (-1, 0)
    const passingThrough = new Vector2D(-0, 1).normal();

    expect(Object.is(passingThrough.y, 0)).toBe(true);
    expect(passingThrough.toString()).toBe('Vector2D(-1, 0)');

    // (0, -0).normal() = (-(-0), 0) = (0, 0) -> becomes (0, 0)
    const bothZeroish = new Vector2D(0, -0).normal();

    expect(Object.is(bothZeroish.x, 0)).toBe(true);
    expect(Object.is(bothZeroish.y, 0)).toBe(true);
  });
});

describe('Vector2D components', () => {
  test('answers the signed magnitudes', () => {
    const subject = new Vector2D(8, -4);

    expect(subject.minComponent()).toBe(-4);
    expect(subject.maxComponent()).toBe(8);
    expect(subject.aspect()).toBe(-2);
  });

  test('rounds each component down, to an integer and to zero', () => {
    expect(new Vector2D(-3, 4).abs().toArray()).toEqual([3, 4]);
  });

  test('answers the sign of each component, zero included', () => {
    expect(new Vector2D(-2, 3).sign().toArray()).toEqual([-1, 1]);
    expect(new Vector2D(0, -3).sign().toArray()).toEqual([0, -1]);
  });

  test('truncates towards zero', () => {
    expect(new Vector2D(-1.7, 2.3).trunc().toArray()).toEqual([-1, 2]);
  });

  test('floors, with the negative case reading below the value', () => {
    expect(new Vector2D(-1.7, 2.3).floor().toArray()).toEqual([-2, 2]);
  });

  // Math.round rounds halves towards positive infinity, not away from zero: -1.5 rounds to -1.
  test('rounds halves upwards', () => {
    expect(new Vector2D(-1.5, 0.6).round().toArray()).toEqual([-1, 1]);
  });

  test('ceils, with the negative case reading up to zero', () => {
    expect(new Vector2D(-1.2, 0.2).ceil().toArray()).toEqual([-1, 1]);
  });

  // The three snap functions separate on the halves and on the below-one side: a component of 1 in
  // a grid of 4 rounds to 0 and ceils to 4, while 3 in a grid of 2 ceils to 4 and floors to 2.
  describe('snapped rounding', () => {
    test('rounds to the nearest multiple', () => {
      expect(new Vector2D(7, 3).snappedRound(new Vector2D(4, 2)).toArray()).toEqual([8, 4]);
      expect(new Vector2D(1, 1).snappedRound(new Vector2D(4, 2)).toArray()).toEqual([0, 2]);
    });

    test('floors to the multiple below', () => {
      expect(new Vector2D(7, 3).snappedFloor(new Vector2D(4, 2)).toArray()).toEqual([4, 2]);
      expect(new Vector2D(1, 1).snappedFloor(new Vector2D(4, 2)).toArray()).toEqual([0, 0]);
    });

    test('ceils to the multiple above', () => {
      expect(new Vector2D(7, 3).snappedCeil(new Vector2D(4, 2)).toArray()).toEqual([8, 4]);
      expect(new Vector2D(1, 1).snappedCeil(new Vector2D(4, 2)).toArray()).toEqual([4, 2]);
    });
  });
});

describe('Vector2D.getIntersection', () => {
  // Two segments with directions (1, 1) and (1, -1) through the same point cross at that point.
  test('answers the point where two crossing segments meet', () => {
    const point = Vector2D.getIntersection(
      new Vector2D(0, 0),
      new Vector2D(2, 2),
      new Vector2D(0, 2),
      new Vector2D(2, 0),
    );

    if (point === null) {
      throw new Error('the two segments cross');
    }

    expect(point.toArray()).toEqual([1, 1]);
  });

  test('answers null for parallel segments', () => {
    expect(
      Vector2D.getIntersection(
        new Vector2D(0, 0),
        new Vector2D(1, 1),
        new Vector2D(0, 1),
        new Vector2D(1, 2),
      ),
    ).toBeNull();
  });

  test('answers null when the meeting point falls before the first segment', () => {
    // The infinite lines meet at (2, 2), behind the first segment, which runs from (1, 1) to (0, 0).
    expect(
      Vector2D.getIntersection(
        new Vector2D(1, 1),
        new Vector2D(0, 0),
        new Vector2D(1, 3),
        new Vector2D(3, 1),
      ),
    ).toBeNull();
  });

  test('answers null when the meeting point falls after the first segment', () => {
    // The infinite lines meet at (2, 2), past the first segment's end at (1, 1).
    expect(
      Vector2D.getIntersection(
        new Vector2D(0, 0),
        new Vector2D(1, 1),
        new Vector2D(1, 3),
        new Vector2D(3, 1),
      ),
    ).toBeNull();
  });

  test('answers null when the meeting point falls before the second segment', () => {
    // The infinite lines meet at the origin, which lies behind second segment's start at (3, -3).
    expect(
      Vector2D.getIntersection(
        new Vector2D(0, 0),
        new Vector2D(2, 2),
        new Vector2D(3, -3),
        new Vector2D(4, -4),
      ),
    ).toBeNull();
  });

  test('answers null when the meeting point falls after the second segment', () => {
    // The infinite lines meet at (1, 1), which lies past the vertical segment's end at (1, -1).
    expect(
      Vector2D.getIntersection(
        new Vector2D(0, 0),
        new Vector2D(2, 2),
        new Vector2D(1, -2),
        new Vector2D(1, -1),
      ),
    ).toBeNull();
  });
});

describe('Vector2D.randomDirection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('normalizes the components it draws', () => {
    // 1 becomes x = 2 * 1 - 1 = 1 and 0.5 becomes y = 0, so the draw is EAST.
    vi.spyOn(Math, 'random').mockReturnValueOnce(1).mockReturnValueOnce(0.5);

    expect(Vector2D.randomDirection().toArray()).toEqual([1, 0]);
  });

  test('the result is a unit vector whatever the draw', () => {
    vi.spyOn(Math, 'random');

    const direction = Vector2D.randomDirection();

    expect(direction.length()).toBeCloseTo(1, 10);
  });
});
