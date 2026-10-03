import { modulo } from './math_scalar';

/**
 * A point in two dimensions.
 *
 * An interface rather than a tuple because a caller reads `point.x` and a tuple would make every use
 * `point[0]`; the named fields are also what {@link Point2D} in a chart's own coordinates needs to
 * stay readable.
 */
export interface Point2D {
  x: number;
  y: number;
}

export const turn = 2 * Math.PI;

export function degreesToRadians(radians: number) {
  return (radians * Math.PI) / 180;
}

export function radiansToDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

export function normalizeRadians(radians: number) {
  return modulo(radians, turn);
}

export function getMinDistanceBetweenRadians(angle1: number, angle2: number) {
  const a = angle1 % turn;
  const b = angle2 % turn;

  const difference = Math.abs(a - b);

  const minDistance = Math.min(difference, turn - difference);

  return minDistance;
}

export function polarToCartesian(angle: number, radius: number): Point2D {
  const x = radius * Math.cos(angle);
  const y = radius * Math.sin(angle);
  return { x, y };
}

export function cartesianToPolar(x: number, y: number) {
  const angle = normalizeRadians(Math.atan2(y, x));
  const radius = Math.hypot(y, x);
  return { angle, radius };
}

export function rotatePoint2D(point: Point2D, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = point.x * cos - point.y * sin;
  const y = point.x * sin + point.y * cos;
  return { x, y };
}
