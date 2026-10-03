import { DEFAULT_EQUALITY_TOLERANCE } from './math_vector2d';

/**
 * A vector in three dimensions, for the scene renderer.
 *
 * Immutable: every operation returns a new vector. A renderer that mutated a shared direction in
 * place would be a renderer whose objects quietly rotated together, so the operations here cannot be
 * used that way even by accident.
 */
export class Vector3D {
  static readonly ZERO: Vector3D = new Vector3D(0, 0, 0);
  static readonly ONE: Vector3D = new Vector3D(1, 1, 1);
  static readonly NORTH: Vector3D = new Vector3D(0, 1, 0);
  static readonly NORTH_WEST: Vector3D = new Vector3D(-1, 1, 0);
  static readonly NORTH_EAST: Vector3D = new Vector3D(1, 1, 0);
  static readonly SOUTH: Vector3D = new Vector3D(0, -1, 0);
  static readonly SOUTH_WEST: Vector3D = new Vector3D(-1, -1, 0);
  static readonly SOUTH_EAST: Vector3D = new Vector3D(1, -1, 0);
  static readonly WEST: Vector3D = new Vector3D(-1, 0, 0);
  static readonly EAST: Vector3D = new Vector3D(1, 0, 0);
  static readonly UP: Vector3D = new Vector3D(0, 0, 1);
  static readonly DOWN: Vector3D = new Vector3D(0, 0, -1);

  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static fromPoint3D({ x, y, z }: { readonly x: number; readonly y: number; readonly z: number }) {
    return new Vector3D(x, y, z);
  }

  static fromArray(components: [number, number, number]) {
    const [x, y, z] = components;

    return new Vector3D(x, y, z);
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  add(vector: Vector3D): Vector3D {
    const x = this.x + vector.x;
    const y = this.y + vector.y;
    const z = this.z + vector.z;

    return new Vector3D(x, y, z);
  }

  subtract(vector: Vector3D): Vector3D {
    const x = this.x - vector.x;
    const y = this.y - vector.y;
    const z = this.z - vector.z;

    return new Vector3D(x, y, z);
  }

  scaleScalar(scalar: number): Vector3D {
    const x = this.x * scalar;
    const y = this.y * scalar;
    const z = this.z * scalar;

    return new Vector3D(x, y, z);
  }

  scale(vector: Vector3D): Vector3D {
    const x = this.x * vector.x;
    const y = this.y * vector.y;
    const z = this.z * vector.z;

    return new Vector3D(x, y, z);
  }

  negate(): Vector3D {
    return new Vector3D(-this.x, -this.y, -this.z);
  }

  length(): number {
    return Math.hypot(this.x, this.y, this.z);
  }

  lengthSquared(): number {
    const { x, y, z } = this;

    return x * x + y * y + z * z;
  }

  equals(vector: Vector3D, tolerance: number = DEFAULT_EQUALITY_TOLERANCE): boolean {
    return (
      Math.abs(this.x - vector.x) < tolerance &&
      Math.abs(this.y - vector.y) < tolerance &&
      Math.abs(this.z - vector.z) < tolerance
    );
  }

  isZeroStrict(): boolean {
    return this.x === 0 && this.y === 0 && this.z === 0;
  }

  isZero(tolerance: number = DEFAULT_EQUALITY_TOLERANCE): boolean {
    return this.x < tolerance && this.y < tolerance && this.z < tolerance;
  }

  isUnit(tolerance: number = DEFAULT_EQUALITY_TOLERANCE): boolean {
    return Math.abs(this.length() - 1) < tolerance;
  }

  copy(): Vector3D {
    return new Vector3D(this.x, this.y, this.z);
  }

  normalize(): Vector3D {
    const length = this.length();

    if (length === 0) {
      throw new Error('Cannot normalize a zero vector');
    }

    return this.scaleScalar(1 / length);
  }

  dot(vector: Vector3D): number {
    return this.x * vector.x + this.y * vector.y + this.z * vector.z;
  }

  cross(vector: Vector3D): Vector3D {
    const crossX = this.y * vector.z - this.z * vector.y;
    const crossY = this.z * vector.x - this.x * vector.z;
    const crossZ = this.x * vector.y - this.y * vector.x;

    return new Vector3D(crossX, crossY, crossZ);
  }

  distanceTo(vector: Vector3D): number {
    const diff = this.subtract(vector);

    return diff.length();
  }

  lerp(vector: Vector3D, t: number): Vector3D {
    const x = this.x + (vector.x - this.x) * t;
    const y = this.y + (vector.y - this.y) * t;
    const z = this.z + (vector.z - this.z) * t;

    return new Vector3D(x, y, z);
  }

  rotate(angle: number, axis: 'x' | 'y' | 'z'): Vector3D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const { x, y, z } = this;

    if (axis === 'x') {
      return new Vector3D(x, y * cos - z * sin, y * sin + z * cos);
    }

    if (axis === 'y') {
      return new Vector3D(x * cos + z * sin, y, -x * sin + z * cos);
    }

    return new Vector3D(x * cos - y * sin, x * sin + y * cos, z);
  }

  clampLength(maxLength: number): Vector3D {
    const length = this.length();

    return length > maxLength ? this.scaleScalar(maxLength / length) : this.copy();
  }

  project(onto: Vector3D): Vector3D {
    return onto.scaleScalar(this.dot(onto) / onto.dot(onto));
  }

  reflect(normal: Vector3D): Vector3D {
    return this.subtract(normal.scaleScalar(2 * this.dot(normal)));
  }

  normal(a: Vector3D, b: Vector3D): Vector3D {
    return a.subtract(this).cross(b.subtract(this));
  }

  scaleTo(length: number): Vector3D {
    const currentLength = this.length();

    if (currentLength === 0) {
      throw new Error('Cannot scale a zero vector');
    }

    return this.scaleScalar(length / currentLength);
  }

  insideRadius(radius: number): boolean {
    return this.length() <= radius;
  }

  abs(): Vector3D {
    const x = Math.abs(this.x);
    const y = Math.abs(this.y);
    const z = Math.abs(this.z);

    return new Vector3D(x, y, z);
  }

  sign(): Vector3D {
    const x = Math.sign(this.x);
    const y = Math.sign(this.y);
    const z = Math.sign(this.z);

    return new Vector3D(x, y, z);
  }

  minComponent(): number {
    return Math.min(this.x, this.y, this.z);
  }

  maxComponent(): number {
    return Math.max(this.x, this.y, this.z);
  }

  trunc(): Vector3D {
    const x = Math.trunc(this.x);
    const y = Math.trunc(this.y);
    const z = Math.trunc(this.z);

    return new Vector3D(x, y, z);
  }

  floor(): Vector3D {
    const x = Math.floor(this.x);
    const y = Math.floor(this.y);
    const z = Math.floor(this.z);

    return new Vector3D(x, y, z);
  }

  round(): Vector3D {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const z = Math.round(this.z);

    return new Vector3D(x, y, z);
  }

  ceil(): Vector3D {
    const x = Math.ceil(this.x);
    const y = Math.ceil(this.y);
    const z = Math.ceil(this.z);

    return new Vector3D(x, y, z);
  }

  snappedRound(by: Vector3D): Vector3D {
    const x = Math.round(this.x / by.x) * by.x;
    const y = Math.round(this.y / by.y) * by.y;
    const z = Math.round(this.z / by.z) * by.z;

    return new Vector3D(x, y, z);
  }

  snappedFloor(by: Vector3D): Vector3D {
    const x = Math.floor(this.x / by.x) * by.x;
    const y = Math.floor(this.y / by.y) * by.y;
    const z = Math.floor(this.z / by.z) * by.z;

    return new Vector3D(x, y, z);
  }

  snappedCeil(by: Vector3D): Vector3D {
    const x = Math.ceil(this.x / by.x) * by.x;
    const y = Math.ceil(this.y / by.y) * by.y;
    const z = Math.ceil(this.z / by.z) * by.z;

    return new Vector3D(x, y, z);
  }

  static getIntersection(
    v1Start: Vector3D,
    v1End: Vector3D,
    v2Start: Vector3D,
    v2End: Vector3D,
  ): Vector3D | null {
    const { x: x1, y: y1, z: z1 } = v1Start;
    const { x: x2, y: y2, z: z2 } = v1End;
    const { x: x3, y: y3, z: z3 } = v2Start;
    const { x: x4, y: y4, z: z4 } = v2End;

    // Calculate the direction vectors
    const d1 = new Vector3D(x2 - x1, y2 - y1, z2 - z1);
    const d2 = new Vector3D(x4 - x3, y4 - y3, z4 - z3);

    // Calculate the determinants
    const denominator = d1.x * d2.y - d1.y * d2.x;

    // If the lines are parallel, no intersection
    if (denominator === 0) {
      return null;
    }

    // Calculate the intersection point by parameters t and u
    const t = ((x3 - x1) * d2.y - (y3 - y1) * d2.x) / denominator;
    const u = ((x3 - x1) * d1.y - (y3 - y1) * d1.x) / denominator;
    const pointOutsideLineSegments = t < 0 || t > 1 || u < 0 || u > 1;

    return pointOutsideLineSegments ? null : v1Start.lerp(v1End, t);
  }

  static randomDirection(): Vector3D {
    const x = Math.random() * 2 - 1;
    const y = Math.random() * 2 - 1;
    const z = Math.random() * 2 - 1;

    return new Vector3D(x, y, z).normalize();
  }

  toString(): string {
    return `Vector3D(${this.x}, ${this.y}, ${this.z})`;
  }
}
