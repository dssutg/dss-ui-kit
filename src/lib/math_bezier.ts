import { binomial } from './math_scalar';
import { Vector2D } from './math_vector2d';
import { Vector3D } from './math_vector3d';

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

export function bezier2d(points: readonly Vector2D[], t: number): Vector2D {
  const mapTo3D = ({ x, y }: Vector2D) => new Vector3D(x, y, 0);

  return Vector2D.fromPoint2D(bezier3d(points.map(mapTo3D), t));
}
