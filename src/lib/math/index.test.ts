import { describe, expect, test } from 'vitest';
import {
  glMat4Identity,
  glMat4Invert,
  glMat4Multiply,
  glMat4MultiplyMatrixAndVector,
  glMat4Rotate,
  glMat4Scale,
  glMat4Translate,
  type Mat4,
  mat4From,
  mergeIntegers,
  toFloat32Array,
  vec4From,
} from './';

/** Matrices hold numbers that are close but not identical, so comparisons allow for a rounding error. */
function expectMatrixToBeCloseTo(actual: Mat4, expected: readonly number[]) {
  expect(actual).toHaveLength(16);

  for (const [index, expectedValue] of expected.entries()) {
    expect(actual[index]).toBeCloseTo(expectedValue ?? 0, 6);
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

    expectMatrixToBeCloseTo(product, identity);
  });
});

describe('glMat4Multiply', () => {
  test('multiplying by the identity leaves a matrix alone', () => {
    const a = mat4From([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 5, 6, 7, 1]);

    expectMatrixToBeCloseTo(glMat4Multiply(glMat4Identity(), a, glMat4Identity()), a);
  });

  test('multiplies two scales componentwise', () => {
    const scaleByTwo = mat4From([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]);
    const scaleByThree = mat4From([3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1]);

    expectMatrixToBeCloseTo(
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
    expectMatrixToBeCloseTo(inPlaceResult, separateResult);
  });
});

describe('glMat4Scale', () => {
  test('scales each axis and leaves the translation alone', () => {
    const subject = mat4From([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1]);

    expectMatrixToBeCloseTo(
      glMat4Scale(glMat4Identity(), subject, [2, 3, 4]),
      mat4From([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 5, 6, 7, 1]),
    );
  });
});

describe('glMat4Translate', () => {
  test('puts the vector into the translation column', () => {
    expectMatrixToBeCloseTo(
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
});

describe('glMat4Rotate', () => {
  test('a full turn about an axis returns the matrix it started with', () => {
    const subject = mat4From([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const turned = glMat4Rotate(glMat4Identity(), subject, 2 * Math.PI, [0, 1, 0]);

    if (turned === null) {
      throw new Error(String('the y axis is a valid axis to rotate about'));
    }

    expectMatrixToBeCloseTo(turned, subject);
  });

  test('rotating the x axis a quarter turn about y lands it on the z axis', () => {
    const turned = glMat4Rotate(glMat4Identity(), glMat4Identity(), Math.PI / 2, [0, 1, 0]);

    if (turned === null) {
      throw new Error(String('the y axis is a valid axis to rotate about'));
    }

    const turnedXAxis = glMat4MultiplyMatrixAndVector([0, 0, 0, 0], turned, [1, 0, 0, 1]);

    // Column-major: the point comes back as [x, y, z, w].
    expect(turnedXAxis[0]).toBeCloseTo(0, 6);
    expect(turnedXAxis[2]).toBeCloseTo(-1, 6);
  });

  test('rejects a zero-length axis rather than dividing by zero', () => {
    expect(glMat4Rotate(glMat4Identity(), glMat4Identity(), 1, [0, 0, 0])).toBeNull();
  });
});

describe('glMat4Invert', () => {
  test('inverting a matrix and inverting the result returns the original', () => {
    const subject = mat4From([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 5, 6, 7, 1]);

    const inverse = glMat4Invert(glMat4Identity(), subject);

    if (inverse === null) {
      throw new Error('a matrix with a non-zero diagonal is invertible');
    }

    expectMatrixToBeCloseTo(glMat4Multiply(glMat4Identity(), inverse, subject), glMat4Identity());
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
