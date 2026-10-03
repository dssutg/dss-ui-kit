/**
 * The math group's entry point, re-exporting its modules so the import specifier is the directory.
 *
 * Everything exported here is a self-contained calculation — nothing here holds state, calls the
 * DOM or knows what renders it, which is what keeps the group importable from any layer.
 */
export type { Point2D } from './angle';
export {
  cartesianToPolar,
  degreesToRadians,
  getMinDistanceBetweenRadians,
  normalizeRadians,
  polarToCartesian,
  radiansToDegrees,
  rotatePoint2D,
  turn,
} from './angle';
export { bezier2d, bezier3d } from './bezier';
export type { Mat4, MutableVec4, Vec3, Vec3Or4, Vec4 } from './matrix';
export {
  glMat4Identity,
  glMat4Invert,
  glMat4Multiply,
  glMat4MultiplyMatrixAndVector,
  glMat4Perspective,
  glMat4Rotate,
  glMat4Scale,
  glMat4Translate,
  gltMat4Ortho,
  isPointWithinNormalizedDeviceCoordinates,
  mat4From,
  multiplyMatrices,
  toFloat32Array,
  transpose,
  vec4From,
} from './matrix';
export type { Range } from './range';
export { mergeIntegers, mergeRanges } from './range';
export { calculateSquareSizeFittingContainer, Rectangle } from './rect';
export {
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
} from './scalar';
export { Vector2D } from './vector2d';
export { Vector3D } from './vector3d';
