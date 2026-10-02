/**
 * A 4x4 matrix, column-major, as OpenGL expects it.
 *
 * The sixteen elements are named in the type rather than left to an index signature, because
 * `number[]` says nothing about how many elements there are: `a[3]` on one is possibly absent,
 * so every one of the four hundred reads in the functions below would need an assertion to silence.
 * A tuple of sixteen says all sixteen are present, which is what the code already assumed.
 *
 * A plain array of sixteen numbers is the type rather than a `Float32Array`, because these
 * functions do arithmetic and the buffer is only needed where WebGL is handed the result. A
 * `Float32Array` cannot name its length, so the same problem comes back. Call `toFloat32Array`
 * at the point of upload.
 */
export type Vec3 = readonly [number, number, number];

export type Vec4 = readonly [number, number, number, number];

/** The form of a vector that a matrix-vector product writes its result into. */
export type MutableVec4 = [number, number, number, number];

export type Vec3Or4 = readonly [number, number, number, number?];

export type Mat4 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** The buffer form of a matrix, which is what `uniformMatrix4fv` and `vertexAttribPointer` take. */
export function toFloat32Array(matrix: Mat4): Float32Array {
  return new Float32Array(matrix);
}

/**
 * A matrix written out as sixteen numbers in column-major order.
 *
 * The length is checked rather than asserted, so a matrix written with too few or too many
 * components is a mistake the caller is told about instead of one that reads as `undefined`
 * somewhere inside a projection.
 */
export function mat4From(values: readonly number[]): Mat4 {
  if (values.length !== 16) {
    throw new RangeError(`a matrix has 16 components, got ${values.length}`);
  }

  return [
    componentAt(values, 0),
    componentAt(values, 1),
    componentAt(values, 2),
    componentAt(values, 3),
    componentAt(values, 4),
    componentAt(values, 5),
    componentAt(values, 6),
    componentAt(values, 7),
    componentAt(values, 8),
    componentAt(values, 9),
    componentAt(values, 10),
    componentAt(values, 11),
    componentAt(values, 12),
    componentAt(values, 13),
    componentAt(values, 14),
    componentAt(values, 15),
  ];
}

/**
 * The component at an index the caller has already established is there.
 *
 * A `readonly number[]` says an index may be absent even after its length has been checked, so
 * reading one produces `number | undefined`. The default a `?? 0` would supply would be a silent
 * matrix with a hole in it, so the absence is reported instead: reaching this means the length
 * check that preceded it and the index that reached it disagree, which is a defect here.
 */
function componentAt(values: readonly number[], index: number): number {
  const component = values[index];

  if (component === undefined) {
    throw new RangeError(`expected a component at index ${index}, but there are ${values.length}`);
  }

  return component;
}

/** A four-component vector, used for a homogeneous position and for a matrix-vector product. */
export function vec4From(values: readonly number[]): Vec4 {
  if (values.length !== 4) {
    throw new RangeError(`a vector has 4 components, got ${values.length}`);
  }

  return [
    componentAt(values, 0),
    componentAt(values, 1),
    componentAt(values, 2),
    componentAt(values, 3),
  ];
}

// IMPORTANT: OpenGL stores matrices and vectors in COLUMN-major order
// so namely columns are stored contiguously in memory.
export function glMat4Identity(): Mat4 {
  return [
    1, 0, 0, 0,

    0, 1, 0, 0,

    0, 0, 1, 0,

    0, 0, 0, 1,
  ];
}

export function glMat4Perspective(
  out: Mat4,
  fovY: number,
  aspect: number,
  near: number,
  far = Infinity,
) {
  const f = 1 / Math.tan(fovY / 2);

  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;

  out[8] = 0;
  out[9] = 0;
  out[11] = -1;

  out[12] = 0;
  out[13] = 0;
  out[15] = 0;

  if (far !== undefined && far !== Infinity) {
    const nf = 1 / (near - far);

    out[10] = (far + near) * nf;
    out[14] = 2 * far * near * nf;
  } else {
    out[10] = -1;
    out[14] = -2 * near;
  }

  return out;
}

// Generates a orthogonal projection matrix with the given bounds
//
// @param {mat4} out mat4 frustum matrix will be written into
// @param {number} left Left bound of the frustum
// @param {number} right Right bound of the frustum
// @param {number} bottom Bottom bound of the frustum
// @param {number} top Top bound of the frustum
// @param {number} near Near bound of the frustum
// @param {number} far Far bound of the frustum
// @returns {mat4} out
export function gltMat4Ortho(
  out: Mat4,
  {
    left,
    right,
    bottom,
    top,
    near,
    far,
  }: {
    readonly left: number;
    readonly right: number;
    readonly bottom: number;
    readonly top: number;
    readonly near: number;
    readonly far: number;
  },
) {
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);

  out[0] = -2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = -2 * bt;
  out[6] = 0;
  out[7] = 0;

  out[8] = 0;
  out[9] = 0;
  out[10] = 2 * nf;
  out[11] = 0;

  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;

  return out;
}

export function transpose(out: Mat4, a: Mat4) {
  // If we are transposing ourselves we can skip a few steps but have to cache some values
  if (out === a) {
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];
    const a12 = a[6];
    const a13 = a[7];
    const a23 = a[11];

    out[1] = a[4];
    out[2] = a[8];
    out[3] = a[12];
    out[4] = a01;
    out[6] = a[9];
    out[7] = a13;
    out[8] = a02;
    out[9] = a12;
    out[11] = a[14];
    out[12] = a03;
    out[13] = a13;
    out[14] = a23;
  } else {
    out[0] = a[0];
    out[1] = a[4];
    out[2] = a[8];
    out[3] = a[12];
    out[4] = a[1];
    out[5] = a[5];
    out[6] = a[9];
    out[7] = a[13];
    out[8] = a[2];
    out[9] = a[6];
    out[10] = a[10];
    out[11] = a[14];
    out[12] = a[3];
    out[13] = a[7];
    out[14] = a[11];
    out[15] = a[15];
  }

  return out;
}

export function glMat4Translate(out: Mat4, a: Mat4, v: Vec3): Mat4 {
  const [x = 0, y = 0, z = 0] = v;

  if (a === out) {
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
  } else {
    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];
    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a13 = a[7];
    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a23 = a[11];

    out[0] = a00;
    out[1] = a01;
    out[2] = a02;
    out[3] = a03;

    out[4] = a10;
    out[5] = a11;
    out[6] = a12;
    out[7] = a13;

    out[8] = a20;
    out[9] = a21;
    out[10] = a22;
    out[11] = a23;

    out[12] = a00 * x + a10 * y + a20 * z + a[12];
    out[13] = a01 * x + a11 * y + a21 * z + a[13];
    out[14] = a02 * x + a12 * y + a22 * z + a[14];
    out[15] = a03 * x + a13 * y + a23 * z + a[15];
  }

  return out;
}

export function glMat4Rotate(out: Mat4, a: Mat4, rad: number, axis: Vec3): Mat4 | null {
  let x = axis[0];
  let y = axis[1];
  let z = axis[2];

  let length = Math.hypot(x, y, z);

  const EPSILON = 0.000_001;

  if (length < EPSILON) {
    return null;
  }

  length = 1 / length;

  x = x * length;
  y = y * length;
  z = z * length;

  const s = Math.sin(rad);
  const c = Math.cos(rad);
  const t = 1 - c;

  const a00 = a[0];
  const a01 = a[1];
  const a02 = a[2];
  const a03 = a[3];

  const a10 = a[4];
  const a11 = a[5];
  const a12 = a[6];
  const a13 = a[7];

  const a20 = a[8];
  const a21 = a[9];
  const a22 = a[10];
  const a23 = a[11];

  // Construct the elements of the rotation matrix
  const b00 = x * x * t + c;
  const b01 = y * x * t + z * s;
  const b02 = z * x * t - y * s;

  const b10 = x * y * t - z * s;
  const b11 = y * y * t + c;
  const b12 = z * y * t + x * s;

  const b20 = x * z * t + y * s;
  const b21 = y * z * t - x * s;
  const b22 = z * z * t + c;

  // Perform rotation-specific matrix multiplication
  out[0] = a00 * b00 + a10 * b01 + a20 * b02;
  out[1] = a01 * b00 + a11 * b01 + a21 * b02;
  out[2] = a02 * b00 + a12 * b01 + a22 * b02;
  out[3] = a03 * b00 + a13 * b01 + a23 * b02;
  out[4] = a00 * b10 + a10 * b11 + a20 * b12;
  out[5] = a01 * b10 + a11 * b11 + a21 * b12;
  out[6] = a02 * b10 + a12 * b11 + a22 * b12;
  out[7] = a03 * b10 + a13 * b11 + a23 * b12;
  out[8] = a00 * b20 + a10 * b21 + a20 * b22;
  out[9] = a01 * b20 + a11 * b21 + a21 * b22;
  out[10] = a02 * b20 + a12 * b21 + a22 * b22;
  out[11] = a03 * b20 + a13 * b21 + a23 * b22;

  if (a !== out) {
    // If the source and destination differ, copy the unchanged last row
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  }

  return out;
}

export function glMat4Scale(out: Mat4, a: Mat4, v: Vec3) {
  const [x = 0, y = 0, z = 0] = v;

  out[0] = a[0] * x;
  out[1] = a[1] * x;
  out[2] = a[2] * x;
  out[3] = a[3] * x;

  out[4] = a[4] * y;
  out[5] = a[5] * y;
  out[6] = a[6] * y;
  out[7] = a[7] * y;

  out[8] = a[8] * z;
  out[9] = a[9] * z;
  out[10] = a[10] * z;
  out[11] = a[11] * z;

  out[12] = a[12];
  out[13] = a[13];
  out[14] = a[14];
  out[15] = a[15];

  return out;
}

// Multiply two 4x4 matrices
export function glMat4Multiply(out: Mat4, a: Mat4, b: Mat4) {
  const a00 = a[0];
  const a01 = a[1];
  const a02 = a[2];
  const a03 = a[3];

  const a10 = a[4];
  const a11 = a[5];
  const a12 = a[6];
  const a13 = a[7];

  const a20 = a[8];
  const a21 = a[9];
  const a22 = a[10];
  const a23 = a[11];

  const a30 = a[12];
  const a31 = a[13];
  const a32 = a[14];
  const a33 = a[15];

  const b00 = b[0];
  const b01 = b[1];
  const b02 = b[2];
  const b03 = b[3];

  const b10 = b[4];
  const b11 = b[5];
  const b12 = b[6];
  const b13 = b[7];

  const b20 = b[8];
  const b21 = b[9];
  const b22 = b[10];
  const b23 = b[11];

  const b30 = b[12];
  const b31 = b[13];
  const b32 = b[14];
  const b33 = b[15];

  out[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
  out[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
  out[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
  out[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;

  out[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
  out[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
  out[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
  out[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;

  out[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
  out[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
  out[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
  out[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;

  out[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
  out[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
  out[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
  out[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;

  return out;
}

// Multiply 4x4 matrix by 4x1 column-vector
export function glMat4MultiplyMatrixAndVector(out: MutableVec4, a: Mat4, vec: Vec4): MutableVec4 {
  const a00 = a[0];
  const a01 = a[1];
  const a02 = a[2];
  const a03 = a[3];

  const a10 = a[4];
  const a11 = a[5];
  const a12 = a[6];
  const a13 = a[7];

  const a20 = a[8];
  const a21 = a[9];
  const a22 = a[10];
  const a23 = a[11];

  const a30 = a[12];
  const a31 = a[13];
  const a32 = a[14];
  const a33 = a[15];

  const b0 = vec[0];
  const b1 = vec[1];
  const b2 = vec[2];
  const b3 = vec[3];

  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  return out;
}

// Invert 4x4 matrix
export function glMat4Invert(out: Mat4, a: Mat4) {
  const a00 = a[0];
  const a01 = a[1];
  const a02 = a[2];
  const a03 = a[3];
  const a10 = a[4];
  const a11 = a[5];
  const a12 = a[6];
  const a13 = a[7];
  const a20 = a[8];
  const a21 = a[9];
  const a22 = a[10];
  const a23 = a[11];
  const a30 = a[12];
  const a31 = a[13];
  const a32 = a[14];
  const a33 = a[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  // Calculate the determinant
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!det) {
    return null;
  }

  det = 1 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

  return out;
}

export function isPointWithinNormalizedDeviceCoordinates(point: [number, number, number]) {
  return Math.abs(point[0]) <= 1 && Math.abs(point[1]) <= 1 && Math.abs(point[2]) <= 1;
}

export function multiplyMatrices(
  a: readonly (readonly number[])[],
  b: readonly (readonly number[])[],
) {
  if (a.length === 0 || b.length === 0) {
    throw new Error('Cannot multiply by an empty matrix.');
  }

  const rowsA = a.length;
  const colsA = a[0]?.length ?? 0;
  const rowsB = b.length;
  const colsB = b[0]?.length ?? 0;

  if (colsA !== rowsB) {
    throw new Error(
      'Number of columns in the first matrix must equal the number of rows in the second matrix.',
    );
  }

  // One row of the product is the dot product of one row of `a` with every column of `b`, so it is
  // computed directly rather than accumulated in place. That way the result is built as it is read
  // and nothing has to be asserted about an array this function created a moment earlier.
  //
  // A matrix whose rows are not all the same length is treated as padded with zeros, because the
  // dimensions of the result are taken from the first row and a missing entry contributes nothing.
  return Array.from({ length: rowsA }, (_, row) =>
    Array.from({ length: colsB }, (_, column) => {
      const rowA = a[row];

      if (rowA === undefined) {
        return 0;
      }

      return rowA.reduce((sum, value, index) => sum + value * (b[index]?.[column] ?? 0), 0);
    }),
  );
}
