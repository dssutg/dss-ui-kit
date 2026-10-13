/**
 * The rectangle arithmetic the layout code builds on. The suite pins the boundary readings callers
 * cannot re-derive from the names: `containsPoint` is start-inclusive and end-exclusive, `contains`
 * allows shared edges, `intersects` counts touching as intersecting, and the largest square that
 * fits a container is floored so the remainder is left as an unfilled strip rather than clipped
 * squares.
 */
import { describe, expect, test } from 'vitest';
import { calculateSquareSizeFittingContainer, Rectangle } from './rect';

describe('calculateSquareSizeFittingContainer', () => {
  test('answers the container size for a single square', () => {
    expect(calculateSquareSizeFittingContainer(100, 100, 1)).toBe(100);
  });

  test('treats a count below one as one', () => {
    expect(calculateSquareSizeFittingContainer(100, 100, 0)).toBe(100);
  });

  // A hundred-by-hundred container holds nine 33-unit squares, which is the closest a whole size
  // comes to the five five asked for; floored, the size can never overflow the container.
  test('floors the size, leaving the remainder as an unfilled strip', () => {
    expect(calculateSquareSizeFittingContainer(100, 100, 5)).toBe(33);
  });

  // The answer is searched over the two ways of laying a grid out, so a wide container and its
  // transpose must agree.
  test('searches the more-rows and more-columns layings out and takes the better', () => {
    expect(calculateSquareSizeFittingContainer(100, 10, 7)).toBe(10);
    expect(calculateSquareSizeFittingContainer(10, 100, 7)).toBe(10);
  });

  test('keeps the exact fit a whole number', () => {
    // Three 35-unit squares per row, two rows, fit 105x100 with room for the six asked for.
    expect(calculateSquareSizeFittingContainer(105, 100, 5)).toBe(35);
  });
});

describe('Rectangle', () => {
  describe('construction and identity', () => {
    test('getIdentity is the unit rectangle at the origin', () => {
      expect(Rectangle.getIdentity().equals(new Rectangle(0, 0, 1, 1))).toBe(true);
    });

    test('copies without aliasing', () => {
      const subject = new Rectangle(1, 2, 3, 4);
      const copy = subject.copy();

      expect(copy).not.toBe(subject);
      expect(copy.equals(subject)).toBe(true);

      copy.width = 10;

      expect(subject.width).toBe(3);
    });
  });

  describe('measurements', () => {
    test('answers its own measurements', () => {
      const subject = new Rectangle(0, 0, 3, 4);

      expect(subject.area()).toBe(12);
      expect(subject.perimeter()).toBe(14);
      expect(subject.hypot()).toBe(5);
    });

    test('answers start-inclusive and end-exclusive corners', () => {
      const subject = new Rectangle(1, 2, 3, 4);

      expect(subject.getStartPoint()).toEqual({ x: 1, y: 2 });
      expect(subject.getEndPoint()).toEqual({ x: 4, y: 6 });
      expect(subject.getStartPointExcludingStartBoundary()).toEqual({ x: 2, y: 3 });
      expect(subject.getEndPointExcludingEndBoundary()).toEqual({ x: 3, y: 5 });
    });

    test('answers the centre in rectangle-local coordinates', () => {
      // The start point is deliberately non-zero: if the centre came back in parent space it would
      // be (6, 8.5) and the test would catch it.
      expect(new Rectangle(5, 7, 2, 3).center()).toEqual({ x: 1, y: 1.5 });
    });
  });

  describe('equals', () => {
    test('is true for the same bounds', () => {
      expect(new Rectangle(1, 2, 3, 4).equals(new Rectangle(1, 2, 3, 4))).toBe(true);
    });

    test('is false when any one bound differs', () => {
      const subject = new Rectangle(1, 2, 3, 4);

      expect(subject.equals(new Rectangle(2, 2, 3, 4))).toBe(false);
      expect(subject.equals(new Rectangle(1, 3, 3, 4))).toBe(false);
      expect(subject.equals(new Rectangle(1, 2, 4, 4))).toBe(false);
      expect(subject.equals(new Rectangle(1, 2, 3, 5))).toBe(false);
    });
  });

  describe('containsPoint', () => {
    const subject = new Rectangle(0, 0, 2, 2);

    test('is start-inclusive', () => {
      expect(subject.containsPoint(0, 0)).toBe(true);
    });

    test('is end-exclusive', () => {
      expect(subject.containsPoint(2, 1)).toBe(false);
      expect(subject.containsPoint(1, 2)).toBe(false);
    });

    test('is false outside on either axis', () => {
      expect(subject.containsPoint(-1, 1)).toBe(false);
      expect(subject.containsPoint(1, -1)).toBe(false);
    });

    test('is true inside', () => {
      expect(subject.containsPoint(1, 1)).toBe(true);
    });

    test('contains no point at all when an extent is zero', () => {
      expect(new Rectangle(0, 0, 0, 2).containsPoint(0, 1)).toBe(false);
      expect(new Rectangle(0, 0, 2, 0).containsPoint(1, 0)).toBe(false);
    });
  });

  describe('contains', () => {
    const subject = new Rectangle(0, 0, 4, 4);

    test('is true for shared edges', () => {
      expect(subject.contains(new Rectangle(0, 0, 4, 4))).toBe(true);
    });

    test('is false when any edge is crossed', () => {
      expect(subject.contains(new Rectangle(-1, 0, 4, 4))).toBe(false);
      expect(subject.contains(new Rectangle(0, 0, 5, 4))).toBe(false);
      expect(subject.contains(new Rectangle(0, -1, 4, 4))).toBe(false);
      expect(subject.contains(new Rectangle(0, 0, 4, 5))).toBe(false);
    });

    test('is true wholly inside', () => {
      expect(subject.contains(new Rectangle(1, 1, 2, 2))).toBe(true);
    });
  });

  describe('intersects', () => {
    const subject = new Rectangle(0, 0, 4, 4);

    // Touching counts, because the comparison is on the edges with <= and >=: a caller wanting area
    // overlap has to shrink one of the two rectangles first.
    test('counts a rectangle sharing an edge as intersecting', () => {
      expect(subject.intersects(new Rectangle(4, 0, 2, 2))).toBe(true);
      expect(subject.intersects(new Rectangle(-1, 0, 1, 2))).toBe(true);
    });

    test('is true for an overlap', () => {
      expect(subject.intersects(new Rectangle(2, 2, 4, 4))).toBe(true);
    });

    test('is false for rectangles separated on any axis', () => {
      expect(subject.intersects(new Rectangle(5, 0, 2, 2))).toBe(false);
      expect(subject.intersects(new Rectangle(-3, -2, 2, 2))).toBe(false);
      expect(subject.intersects(new Rectangle(0, 5, 2, 2))).toBe(false);
      expect(subject.intersects(new Rectangle(0, -3, 2, 2))).toBe(false);
    });
  });

  test('reads itself back out as a string', () => {
    expect(new Rectangle(1, 2, 3, 4).toString()).toBe('Rectangle(x=1, y=2, width=3, height=4)');
  });
});
