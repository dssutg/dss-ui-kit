/**
 * The slack two components are allowed to differ by and still compare equal.
 *
 * Shared with {@link Vector3D}, whose `equals`, `isZero` and `isUnit` have to mean the same thing.
 * It is not part of the package's public surface: `src/lib/math.tsx` does not re-export it.
 */
export const DEFAULT_EQUALITY_TOLERANCE = 1e-10;

export class Vector2D {
  static readonly ZERO: Vector2D = new Vector2D(0, 0);
  static readonly ONE: Vector2D = new Vector2D(1, 1);
  static readonly NORTH: Vector2D = new Vector2D(0, 1);
  static readonly NORTH_WEST: Vector2D = new Vector2D(-1, 1);
  static readonly NORTH_EAST: Vector2D = new Vector2D(1, 1);
  static readonly SOUTH: Vector2D = new Vector2D(0, -1);
  static readonly SOUTH_WEST: Vector2D = new Vector2D(-1, -1);
  static readonly SOUTH_EAST: Vector2D = new Vector2D(1, -1);
  static readonly WEST: Vector2D = new Vector2D(-1, 0);
  static readonly EAST: Vector2D = new Vector2D(1, 0);

  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  static fromPoint2D({ x, y }: { readonly x: number; readonly y: number }) {
    return new Vector2D(x, y);
  }

  static fromArray(components: [number, number]) {
    const [x, y] = components;

    return new Vector2D(x, y);
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }

  add(vector: Vector2D): Vector2D {
    return new Vector2D(this.x + vector.x, this.y + vector.y);
  }

  subtract(vector: Vector2D): Vector2D {
    return new Vector2D(this.x - vector.x, this.y - vector.y);
  }

  scaleScalar(scalar: number): Vector2D {
    return new Vector2D(this.x * scalar, this.y * scalar);
  }

  scale(vector: Vector2D): Vector2D {
    return new Vector2D(this.x * vector.x, this.y * vector.y);
  }

  negate(): Vector2D {
    return new Vector2D(-this.x, -this.y);
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }

  lengthSquared(): number {
    const { x, y } = this;

    return x * x + y * y;
  }

  equals(vector: Vector2D, tolerance: number = DEFAULT_EQUALITY_TOLERANCE): boolean {
    return Math.abs(this.x - vector.x) < tolerance && Math.abs(this.y - vector.y) < tolerance;
  }

  isZeroStrict(): boolean {
    return this.x === 0 && this.y === 0;
  }

  isZero(tolerance: number = DEFAULT_EQUALITY_TOLERANCE): boolean {
    return this.x < tolerance && this.y < tolerance;
  }

  isUnit(tolerance: number = DEFAULT_EQUALITY_TOLERANCE): boolean {
    return Math.abs(this.length() - 1) < tolerance;
  }

  copy(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  normalize(): Vector2D {
    const length = this.length();

    if (length === 0) {
      throw new Error('Cannot normalize a zero vector');
    }

    return this.scaleScalar(1 / length);
  }

  dot(vector: Vector2D): number {
    return this.x * vector.x + this.y * vector.y;
  }

  cross(vector: Vector2D): number {
    return this.x * vector.y - this.y * vector.x;
  }

  angleBetween(vector: Vector2D): number {
    const dotProduct = this.dot(vector);
    const lengths = this.length() * vector.length();

    if (lengths === 0) {
      throw new Error('Cannot calculate angle with a zero vector');
    }

    return Math.acos(dotProduct / lengths);
  }

  getPolarAngle(): number {
    return Math.atan2(this.y, this.x);
  }

  toPolar(): { radius: number; angle: number } {
    const radius = this.length();
    const angle = this.getPolarAngle();

    return { radius, angle };
  }

  static fromPolarAngle(angle: number): Vector2D {
    return new Vector2D(Math.cos(angle), Math.sin(angle));
  }

  static fromPolar({ radius, angle }: { readonly radius: number; readonly angle: number }) {
    return Vector2D.fromPolarAngle(angle).scaleScalar(radius);
  }

  distanceTo(vector: Vector2D): number {
    const diff = this.subtract(vector);

    return diff.length();
  }

  lerp(vector: Vector2D, t: number): Vector2D {
    const x = this.x + (vector.x - this.x) * t;
    const y = this.y + (vector.y - this.y) * t;

    return new Vector2D(x, y);
  }

  rotate(angle: number): Vector2D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const xRotated = this.x * cos - this.y * sin;
    const yRotated = this.x * sin + this.y * cos;

    return new Vector2D(xRotated, yRotated);
  }

  rotateAround(point: Vector2D, angle: number): Vector2D {
    return this.subtract(point).rotate(angle).add(point);
  }

  clampLength(maxLength: number): Vector2D {
    const length = this.length();

    return length > maxLength ? this.scaleScalar(maxLength / length) : this.copy();
  }

  project(onto: Vector2D): Vector2D {
    return onto.scaleScalar(this.dot(onto) / onto.dot(onto));
  }

  reflect(normal: Vector2D): Vector2D {
    return this.subtract(normal.scaleScalar(2 * this.dot(normal)));
  }

  normal(): Vector2D {
    return new Vector2D(-this.y, this.x);
  }

  scaleTo(length: number): Vector2D {
    const currentLength = this.length();

    if (currentLength === 0) {
      throw new Error('Cannot scale a zero vector');
    }

    return this.scaleScalar(length / currentLength);
  }

  insideRadius(radius: number): boolean {
    return this.length() <= radius;
  }

  abs(): Vector2D {
    const x = Math.abs(this.x);
    const y = Math.abs(this.y);

    return new Vector2D(x, y);
  }

  sign(): Vector2D {
    const x = Math.sign(this.x);
    const y = Math.sign(this.y);

    return new Vector2D(x, y);
  }

  minComponent(): number {
    return Math.min(this.x, this.y);
  }

  maxComponent(): number {
    return Math.max(this.x, this.y);
  }

  aspect(): number {
    return this.x / this.y;
  }

  trunc(): Vector2D {
    const x = Math.trunc(this.x);
    const y = Math.trunc(this.y);

    return new Vector2D(x, y);
  }

  floor(): Vector2D {
    const x = Math.floor(this.x);
    const y = Math.floor(this.y);

    return new Vector2D(x, y);
  }

  round(): Vector2D {
    const x = Math.round(this.x);
    const y = Math.round(this.y);

    return new Vector2D(x, y);
  }

  ceil(): Vector2D {
    const x = Math.ceil(this.x);
    const y = Math.ceil(this.y);

    return new Vector2D(x, y);
  }

  snappedRound(by: Vector2D): Vector2D {
    const x = Math.round(this.x / by.x) * by.x;
    const y = Math.round(this.y / by.y) * by.y;

    return new Vector2D(x, y);
  }

  snappedFloor(by: Vector2D): Vector2D {
    const x = Math.floor(this.x / by.x) * by.x;
    const y = Math.floor(this.y / by.y) * by.y;

    return new Vector2D(x, y);
  }

  snappedCeil(by: Vector2D): Vector2D {
    const x = Math.ceil(this.x / by.x) * by.x;
    const y = Math.ceil(this.y / by.y) * by.y;

    return new Vector2D(x, y);
  }

  static getIntersection(
    v1Start: Vector2D,
    v1End: Vector2D,
    v2Start: Vector2D,
    v2End: Vector2D,
  ): Vector2D | null {
    const { x: x1, y: y1 } = v1Start;
    const { x: x2, y: y2 } = v1End;
    const { x: x3, y: y3 } = v2Start;
    const { x: x4, y: y4 } = v2End;

    // Calculate the determinants
    const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);

    // If the lines are parallel, no intersection
    if (denominator === 0) {
      return null;
    }

    // Calculate the intersection point by parameters t and u
    const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / denominator;
    const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / denominator;
    const pointOutsideLineSegments = t < 0 || t > 1 || u < 0 || u > 1;

    return pointOutsideLineSegments ? null : v1Start.lerp(v1End, t);
  }

  static randomDirection(): Vector2D {
    const x = Math.random() * 2 - 1;
    const y = Math.random() * 2 - 1;

    return new Vector2D(x, y).normalize();
  }

  toString(): string {
    return `Vector2D(${this.x}, ${this.y})`;
  }
}
