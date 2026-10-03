/**
 * Bézier curves evaluated straight from the Bernstein form, with nothing cached or incremental.
 *
 * {@link bezier3d} is the one definition; {@link bezier2d} is the planar case lifted through it
 * rather than a second implementation, so the two cannot drift apart.
 */
import { binomial } from './scalar';
import { Vector2D } from './vector2d';
import { Vector3D } from './vector3d';

/**
 * The point at parameter `t` on the Bézier curve whose control points are `points`.
 *
 * The curve passes through the first and last control points only; the ones between pull it towards
 * themselves without ever being reached, which is what makes them controls rather than vertices.
 *
 * An argument outside `[0, 1]` is not clamped: the polynomial extrapolates, which is a valid answer
 * for a caller that wants a continuation of the curve rather than a point on it. There is
 * deliberately no state between evaluations — a caller drawing a smooth curve asks for each sample
 * and pays the walk over the control points every time, and two curves through the same points stay
 * independent.
 */
export function bezier3d(points: readonly Vector3D[], t: number): Vector3D {
  const n = points.length - 1;

  let result = Vector3D.ZERO;

  for (const [i, point] of points.entries()) {
    const binomialCoefficient = binomial(n, i);
    const term = binomialCoefficient * (1 - t) ** (n - i) * t ** i;

    result = result.add(point.scaleScalar(term));
  }

  return result;
}

/**
 * The planar case of {@link bezier3d}.
 *
 * It lifts the control points into z=0 and drops the z of the result rather than reimplementing the
 * sum, so the two curves mean the same thing by construction. The cost is one throwaway array per
 * evaluation, which is noise next to the sum itself.
 */
export function bezier2d(points: readonly Vector2D[], t: number): Vector2D {
  const mapTo3D = ({ x, y }: Vector2D) => new Vector3D(x, y, 0);

  return Vector2D.fromPoint2D(bezier3d(points.map(mapTo3D), t));
}
