// SPDX-License-Identifier: MIT
// The matrix tests, held to a rounding tolerance.

import { describe, expect, test } from 'vitest';
import {
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
  type Mat4,
  mat4From,
  mergeIntegers,
  multiplyMatrices,
  toFloat32Array,
  transpose,
  vec4From,
} from './';

/**
 * Matrices hold numbers that are close but not identical, so comparisons allow for a rounding error.
 *
 * Throws rather than calling `expect` so the helper can live outside a `test` callback, which is
 * where `noMisplacedAssertion` requires assertions to be.
 */
function assertMatrixCloseTo(actual: Mat4, expected: readonly number[]): void {
  if (actual.length !== 16) {
    throw new Error(`expected matrix to have 16 components, got ${actual.length}`);
  }

  for (const [index, expectedValue] of expected.entries()) {
    const actualValue = actual[index] ?? 0;
    if (Math.abs(actualValue - (expectedValue ?? 0)) >= 1e-6 / 2) {
      throw new Error(
        `expected component ${index} to be close to ${expectedValue ?? 0}, got ${actualValue}`,
      );
    }
  }
}

describe('mat4From', () => {
  test('accepts sixteen components in column-major order', () => {
    const matrix = mat4From([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

    expect(matrix).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  // A matrix written with the wrong number of components used to read as `undefined` somewhere
  // inside a projection, far from the mistake. The length is checked so the mistake is reported.
  test('rejects a matrix that is not sixteen components long', () => {
    expect(() => mat4From([1, 2, 3])).toThrow(RangeError);
    expect(() => mat4From(new Array(17).fill(0))).toThrow(/16 components, got 17/);
  });

  // A length of sixteen satisfies the length guard, so a hole inside it is what the per-component
  // check is for: a sparse array is the only caller-visible way to write one, which is what a
  // caller coming from JavaScript can hand over.
  test('reports a missing component inside a sixteen-component-long array', () => {
    expect(() => mat4From(new Array(16))).toThrow(/expected a component at index 0/);
  });
});

describe('vec4From', () => {
  test('accepts four components', () => {
    expect(vec4From([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  test('rejects a vector that is not four components long', () => {
    expect(() => vec4From([1, 2, 3])).toThrow(/4 components, got 3/);
  });
});

describe('toFloat32Array', () => {
  test('converts a matrix into the buffer form WebGL takes', () => {
    const buffer = toFloat32Array(glMat4Identity());

    expect(buffer).toBeInstanceOf(Float32Array);
    expect(buffer).toHaveLength(16);
    expect([...buffer]).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });
});

describe('glMat4Identity', () => {
  test('is the identity matrix', () => {
    const identity = glMat4Identity();
    const product = glMat4Multiply(glMat4Identity(), identity, identity);

    assertMatrixCloseTo(product, identity);
  });
});

describe('glMat4Multiply', () => {
  test('multiplying by the identity leaves a matrix alone', () => {
    const a = mat4From([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 5, 6, 7, 1]);

    assertMatrixCloseTo(glMat4Multiply(glMat4Identity(), a, glMat4Identity()), a);
  });

  test('multiplies two scales componentwise', () => {
    const scaleByTwo = mat4From([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]);
    const scaleByThree = mat4From([3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1]);

    assertMatrixCloseTo(
      glMat4Multiply(glMat4Identity(), scaleByTwo, scaleByThree),
      mat4From([6, 0, 0, 0, 0, 6, 0, 0, 0, 0, 6, 0, 0, 0, 0, 1]),
    );
  });

  // Every one of the transform functions is written so it can write into its own input, so the
  // in-place branch is the one the caller actually uses.
  test('writes into its own input when the destination is the source', () => {
    const inPlace = mat4From([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 5, 6, 7, 1]);
    const separate = mat4From([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 5, 6, 7, 1]);

    const inPlaceResult = glMat4Multiply(inPlace, inPlace, inPlace);
    const separateResult = glMat4Multiply(glMat4Identity(), separate, separate);

    expect(inPlaceResult).toBe(inPlace);
    assertMatrixCloseTo(inPlaceResult, separateResult);
  });
});

describe('glMat4Scale', () => {
  test('scales each axis and leaves the translation alone', () => {
    const subject = mat4From([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1]);

    assertMatrixCloseTo(
      glMat4Scale(glMat4Identity(), subject, [2, 3, 4]),
      mat4From([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 5, 6, 7, 1]),
    );
  });
});

describe('glMat4Translate', () => {
  test('puts the vector into the translation column', () => {
    assertMatrixCloseTo(
      glMat4Translate(glMat4Identity(), glMat4Identity(), [10, 20, 30]),
      mat4From([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1]),
    );
  });

  test('composes with a scale, so the scale is applied before the translation', () => {
    const scaled = glMat4Scale(glMat4Identity(), glMat4Identity(), [2, 2, 2]);
    const translated = glMat4Translate(glMat4Identity(), scaled, [1, 1, 1]);

    // A point at the origin scaled by two and then moved by one lands at two, not three.
    const point = glMat4MultiplyMatrixAndVector([0, 0, 0, 0], translated, [0, 0, 0, 1]);

    expect(point).toEqual([2, 2, 2, 1]);
  });

  test('shifts its own translation column in place when the destination is the source', () => {
    const inPlace = glMat4Translate(glMat4Identity(), glMat4Identity(), [10, 20, 30]);

    // Translating in place composes with the translation already in the matrix.
    const result = glMat4Translate(inPlace, inPlace, [1, 2, 3]);

    expect(result).toBe(inPlace);
    assertMatrixCloseTo(result, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 11, 22, 33, 1]);
  });
});

describe('glMat4Rotate', () => {
  test('a full turn about an axis returns the matrix it started with', () => {
    const subject = mat4From([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const turned = glMat4Rotate(glMat4Identity(), subject, 2 * Math.PI, [0, 1, 0]);

    if (turned === null) {
      throw new Error('the y axis is a valid axis to rotate about');
    }

    assertMatrixCloseTo(turned, subject);
  });

  test('rotating the x axis a quarter turn about y lands it on the z axis', () => {
    const turned = glMat4Rotate(glMat4Identity(), glMat4Identity(), Math.PI / 2, [0, 1, 0]);

    if (turned === null) {
      throw new Error('the y axis is a valid axis to rotate about');
    }

    const turnedXAxis = glMat4MultiplyMatrixAndVector([0, 0, 0, 0], turned, [1, 0, 0, 1]);

    // Column-major: the point comes back as [x, y, z, w].
    expect(turnedXAxis[0]).toBeCloseTo(0, 6);
    expect(turnedXAxis[2]).toBeCloseTo(-1, 6);
  });

  test('rejects a zero-length axis rather than dividing by zero', () => {
    expect(glMat4Rotate(glMat4Identity(), glMat4Identity(), 1, [0, 0, 0])).toBeNull();
  });

  test('rotates in place, writing into its own input', () => {
    const inPlace = glMat4Translate(glMat4Identity(), glMat4Identity(), [0, 0, -5]);
    const separate = glMat4Translate(glMat4Identity(), glMat4Identity(), [0, 0, -5]);

    const result = glMat4Rotate(inPlace, inPlace, Math.PI / 2, [0, 1, 0]);

    if (result === null) {
      throw new Error('the y axis is a valid axis to rotate about');
    }

    expect(result).toBe(inPlace);

    const separateResult = glMat4Rotate(glMat4Identity(), separate, Math.PI / 2, [0, 1, 0]);

    if (separateResult === null) {
      throw new Error('the y axis is a valid axis to rotate about');
    }

    // Both shapes have to agree, which is what makes the cached reads in the in-place branch worth
    // testing separately from the separate-destination branch.
    assertMatrixCloseTo(result, separateResult);
    assertMatrixCloseTo(result, [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, -5, 1]);
  });
});

describe('glMat4Invert', () => {
  test('inverting a matrix and inverting the result returns the original', () => {
    const subject = mat4From([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 5, 6, 7, 1]);

    const inverse = glMat4Invert(glMat4Identity(), subject);

    if (inverse === null) {
      throw new Error('a matrix with a non-zero diagonal is invertible');
    }

    assertMatrixCloseTo(glMat4Multiply(glMat4Identity(), inverse, subject), glMat4Identity());
  });

  // A matrix with no inverse is a real answer, not an error: a ray hit test against a degenerate
  // object has to be able to skip it.
  test('returns null for a matrix that cannot be inverted', () => {
    const singular = mat4From([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    expect(glMat4Invert(glMat4Identity(), singular)).toBeNull();
  });
});

describe('glMat4MultiplyMatrixAndVector', () => {
  test('multiplies the identity by a vector returns the vector', () => {
    expect(glMat4MultiplyMatrixAndVector([0, 0, 0, 0], glMat4Identity(), [1, 2, 3, 4])).toEqual([
      1, 2, 3, 4,
    ]);
  });
});

describe('transpose', () => {
  const source = mat4From([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  const expected = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15];

  test('moves each component to its mirrored position', () => {
    assertMatrixCloseTo(transpose(glMat4Identity(), mat4From(source)), expected);
  });

  // The in-place branch reads components after earlier ones were overwritten, so it has to cache the
  // ones it still needs; the two branches must agree.
  test('writes into its own input when the destination is the source', () => {
    const inPlace = mat4From(source);
    const result = transpose(inPlace, inPlace);

    expect(result).toBe(inPlace);
    assertMatrixCloseTo(result, expected);
  });
});

describe('isPointWithinNormalizedDeviceCoordinates', () => {
  test('accepts a point inside or on the unit cube', () => {
    expect(isPointWithinNormalizedDeviceCoordinates([0, 0, 0])).toBe(true);
    expect(isPointWithinNormalizedDeviceCoordinates([1, -1, 1])).toBe(true);
  });

  test('rejects a point outside on any axis', () => {
    expect(isPointWithinNormalizedDeviceCoordinates([1.001, 0, 0])).toBe(false);
    expect(isPointWithinNormalizedDeviceCoordinates([0, -1.001, 0])).toBe(false);
    expect(isPointWithinNormalizedDeviceCoordinates([0, 0, 1.001])).toBe(false);
  });
});

describe('mergeIntegers', () => {
  test('returns nothing for an empty array', () => {
    expect(mergeIntegers([])).toEqual([]);
  });

  test('collapses a run of adjacent numbers into one range', () => {
    expect(mergeIntegers([1, 2, 3, 4, 5])).toEqual([{ start: 1, end: 5 }]);
  });

  test('keeps a gap as a separate range', () => {
    expect(mergeIntegers([1, 2, 10, 11, 20])).toEqual([
      { start: 1, end: 2 },
      { start: 10, end: 11 },
      { start: 20, end: 20 },
    ]);
  });

  test('a single number is a range of one', () => {
    expect(mergeIntegers([7])).toEqual([{ start: 7, end: 7 }]);
  });

  test('sorts before merging, so the input order does not matter', () => {
    expect(mergeIntegers([5, 1, 3, 2, 4])).toEqual([{ start: 1, end: 5 }]);
  });
});

describe('glMat4Perspective', () => {
  test('projects with an open far plane when no far is given', () => {
    const out = mat4From(new Array(16).fill(0));

    glMat4Perspective(out, Math.PI / 2, 2, 1);

    // A quarter-turn field of view over an aspect of two halves the horizontal focal length and
    // leaves the vertical one whole.
    expect(out[0]).toBeCloseTo(0.5, 10);
    expect(out[5]).toBeCloseTo(1, 10);
    expect(out[10]).toBe(-1);
    expect(out[11]).toBe(-1);
    expect(out[14]).toBe(-2);
    expect(out[15]).toBe(0);
  });

  test('treats an explicit Infinity as an open far plane', () => {
    const out = mat4From(new Array(16).fill(0));

    glMat4Perspective(out, Math.PI / 2, 2, 1, Infinity);

    expect(out[10]).toBe(-1);
    expect(out[14]).toBe(-2);
  });

  test('maps the near and far planes onto the depth range', () => {
    const out = mat4From(new Array(16).fill(0));

    glMat4Perspective(out, Math.PI / 2, 2, 1, 3);

    expect(out[10]).toBe(-2);
    expect(out[14]).toBe(-3);
    expect(out[15]).toBe(0);
  });
});

describe('gltMat4Ortho', () => {
  test('maps a unit-frame frustum onto the unit cube', () => {
    const out = mat4From(new Array(16).fill(0));

    gltMat4Ortho(out, { left: -1, right: 1, bottom: -1, top: 1, near: 0, far: 1 });

    assertMatrixCloseTo(out, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -2, 0, 0, 0, -1, 1]);
  });

  test('scales each axis to the span of its bounds', () => {
    const out = mat4From(new Array(16).fill(0));

    gltMat4Ortho(out, { left: 0, right: 2, bottom: 0, top: 4, near: 1, far: 5 });

    assertMatrixCloseTo(out, [1, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, -0.5, 0, -1, -1, -1.5, 1]);
  });
});

describe('multiplyMatrices', () => {
  test('multiplies rows of the first by columns of the second', () => {
    expect(
      multiplyMatrices(
        [
          [1, 2],
          [3, 4],
        ],
        [
          [5, 6],
          [7, 8],
        ],
      ),
    ).toEqual([
      [19, 22],
      [43, 50],
    ]);
  });

  test('rejects an empty matrix on either side', () => {
    expect(() => multiplyMatrices([], [[1]])).toThrow(/Cannot multiply by an empty matrix/);
    expect(() => multiplyMatrices([[1]], [])).toThrow(/Cannot multiply by an empty matrix/);
  });

  test('rejects dimensions that do not agree', () => {
    expect(() => multiplyMatrices([[1]], [[], [], []])).toThrow(
      /Number of columns in the first matrix must equal the number of rows/,
    );
  });

  test('reads a later row of the second matrix that is shorter than the first as zeros', () => {
    expect(multiplyMatrices([[1, 2]], [[1], []])).toEqual([[1]]);
  });

  // Sparse entries are the caller-visible way to reach the absent-component reads: the declared
  // parameter types cannot express a hole, but a caller coming from JavaScript can pass one, and
  // the documented contract is that a missing entry contributes nothing.
  test('reads an absent row entry as a zero', () => {
    const a = new Array(2);
    a[0] = [1];

    expect(multiplyMatrices(a, [[1]])).toEqual([[1], [0]]);
  });

  test('reads an absent first row as a matrix with zero columns', () => {
    expect(() => multiplyMatrices(new Array(2), [[1]])).toThrow(
      /Number of columns in the first matrix must equal the number of rows/,
    );
    expect(() => multiplyMatrices([[1]], new Array(2))).toThrow(
      /Number of columns in the first matrix must equal the number of rows/,
    );
  });
});
