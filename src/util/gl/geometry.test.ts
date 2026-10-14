// SPDX-License-Identifier: MIT
// Tests for the renderer geometry: colours and transforms.

import { describe, expect, test } from 'vitest';
import {
  degreesToRadians,
  glMat4Invert,
  glMat4MultiplyMatrixAndVector,
  Vector3D,
  vec4From,
} from '@/util/math';
import {
  calcNormal,
  convertBoxToQuads,
  convertHexColorToGL,
  convertQuadToQuads,
  flattenSceneObjects,
  generateTransformMatrices,
  getBoxCropUV,
  getCameraWorldPos,
  getFaceColor,
  getMaterialByHexColor,
  isPointInsideBox,
  makeTransformationMatrix,
  makeTransformedVertex,
  naiveRaycast,
} from './geometry';
import type {
  BoxFaceColors,
  BoxSceneObject,
  Camera,
  GLQuadUV,
  GroupSceneObject,
  Vector3Array,
  Vector4Array,
} from './scene';

/** The flat material, so a box in these tests draws without naming colours per face. */
const WHITE: Vector4Array = [1, 1, 1, 1];

describe('convertHexColorToGL', () => {
  test('reads a hex colour as RGBA in 0–1', () => {
    expect(convertHexColorToGL('#ff0000')).toEqual([1, 0, 0, 1]);
    expect(convertHexColorToGL('#00ff00')).toEqual([0, 1, 0, 1]);
    expect(convertHexColorToGL('#102030')).toEqual([16 / 255, 32 / 255, 48 / 255, 1]);
  });
});

describe('getMaterialByHexColor and getFaceColor', () => {
  test('a flat colour material answers for every face', () => {
    const material = getMaterialByHexColor('#ff0000');

    for (const face of ['front', 'back', 'left', 'right', 'top', 'bottom'] as const) {
      expect(getFaceColor(material, face)).toEqual([1, 0, 0, 1]);
    }
  });

  test('a per-face material answers each face with its own colour', () => {
    const material = {
      frontFaceColor: [1, 0, 0, 1],
      backFaceColor: [0, 1, 0, 1],
      leftFaceColor: [0, 0, 1, 1],
      rightFaceColor: [1, 1, 0, 1],
      topFaceColor: [0, 1, 1, 1],
      bottomFaceColor: [1, 0, 1, 1],
    } satisfies BoxFaceColors;

    expect(getFaceColor(material, 'front')).toEqual([1, 0, 0, 1]);
    expect(getFaceColor(material, 'back')).toEqual([0, 1, 0, 1]);
    expect(getFaceColor(material, 'top')).toEqual([0, 1, 1, 1]);
  });
});

describe('calcNormal', () => {
  test('answers the unit normal of a triangle in the xy plane', () => {
    expect(calcNormal([0, 0, 0], [1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
  });

  test('answers a zero normal for a degenerate triangle rather than dividing by zero', () => {
    expect(calcNormal([1, 1, 1], [1, 1, 1], [1, 1, 1])).toEqual([0, 0, 0]);
  });
});

describe('getCameraWorldPos', () => {
  test('is the camera position mirrored through the origin', () => {
    const camera = { pos: [1, -2, 3], rotation: [0, 0, 0], scale: [1, 1, 1] } as Camera;

    expect(getCameraWorldPos(camera)).toEqual([-1, 2, -3]);
  });
});

describe('makeTransformedVertex', () => {
  const identity = {
    pos: [0, 0, 0] as Vector3Array,
    scale: [1, 1, 1] as Vector3Array,
    xRotCos: 1,
    xRotSin: 0,
    yRotCos: 1,
    yRotSin: 0,
    zRotCos: 1,
    zRotSin: 0,
  };

  test('places an untransformed vertex where it was', () => {
    expect(makeTransformedVertex(-1, 1, 1, identity)).toEqual([-1, 1, 1]);
  });

  test('scales then translates', () => {
    const t = {
      ...identity,
      pos: [10, 0, 0] as Vector3Array,
      scale: [2, 2, 2] as Vector3Array,
    };

    expect(makeTransformedVertex(1, 0, 0, t)).toEqual([12, 0, 0]);
  });
});

describe('makeTransformationMatrix', () => {
  test('places a translated, unrotated, unscaled box so its centre is at the translation', () => {
    const matrix = makeTransformationMatrix({ type: 'box', pos: [5, 0, 0], material: WHITE });

    // Transform the box centre, which is the origin in its own coordinates.
    const centre = glMat4MultiplyMatrixAndVector([0, 0, 0, 0], matrix, vec4From([0, 0, 0, 1]));

    expect(centre.slice(0, 3)).toEqual([5, 0, 0]);
  });
});

describe('isPointInsideBox', () => {
  test('answers for a box transformed to a known place', () => {
    const box: BoxSceneObject = { type: 'box', pos: [10, 0, 0], scale: [2, 2, 2], material: WHITE };
    const inverted = glMat4Invert(
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      makeTransformationMatrix(box),
    );

    if (inverted === null) {
      throw new Error('the transform above is invertible, so this cannot be reached');
    }

    expect(isPointInsideBox([10, 0, 0], inverted)).toBe(true);
    expect(isPointInsideBox([10, 0, 4], inverted)).toBe(false);
  });
});

describe('flattenSceneObjects', () => {
  test('leaves standalone objects alone', () => {
    const object: BoxSceneObject = { type: 'box', pos: [1, 2, 3], material: WHITE };

    expect(flattenSceneObjects([object])).toEqual([object]);
  });

  test('applies a group transform to its children and drops the group', () => {
    const group: GroupSceneObject = {
      type: 'group',
      pos: [10, 0, 0],
      scale: [2, 2, 2],
      children: [{ type: 'box', pos: [1, 0, 0], material: WHITE }],
    };

    const flattened = flattenSceneObjects([group]);

    expect(flattened).toHaveLength(1);
    expect(flattened[0]?.type).toBe('box');
    expect(flattened[0]?.pos).toEqual([12, 0, 0]);
    expect(flattened[0]?.scale).toEqual([2, 2, 2]);
  });

  test('adds rotations and multiplies scales down the tree', () => {
    const group: GroupSceneObject = {
      type: 'group',
      rotation: [0, 0, 1],
      scale: [2, 2, 2],
      children: [
        {
          type: 'group',
          rotation: [0, 0, 2],
          scale: [3, 3, 3],
          children: [{ type: 'box', material: WHITE }],
        },
      ],
    };

    const flattened = flattenSceneObjects([group]);
    const box = flattened[0];

    expect(box?.rotation).toEqual([0, 0, 3]);
    expect(box?.scale).toEqual([6, 6, 6]);
  });
});

describe('getBoxCropUV', () => {
  test('maps a crop of the atlas onto the front face corners', () => {
    const [bottomLeft, bottomRight, topRight, topLeft] = getBoxCropUV({
      cropX: 10,
      cropY: 20,
      cropWidth: 30,
      cropHeight: 40,
      atlasWidth: 100,
      atlasHeight: 100,
    });

    expect(bottomLeft).toEqual([0.1, 0.6]);
    expect(bottomRight).toEqual([0.4, 0.6]);
    expect(topRight).toEqual([0.4, 0.2]);
    expect(topLeft).toEqual([0.1, 0.2]);
  });

  test('rotates the corners on the faces a mirrored viewpoint draws', () => {
    const crop = {
      cropX: 0,
      cropY: 0,
      cropWidth: 50,
      cropHeight: 50,
      atlasWidth: 100,
      atlasHeight: 100,
    };

    expect(getBoxCropUV({ ...crop, faceName: 'top' })[0]).toEqual([0, 0]);
    expect(getBoxCropUV({ ...crop, faceName: 'back' })[0]).toEqual([0.5, 0.5]);
  });
});

describe('naiveRaycast', () => {
  const camera = { pos: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as Camera;

  test('returns the first object a step reports', () => {
    const hits: string[] = [];

    const found = naiveRaycast({
      rayStartPos: [0, 0, 0],
      maxRayLength: 10,
      rayLengthDelta: 1,
      rayDirection: new Vector3D(0, 0, 1),
      camera,
      stepAction: (pos) => {
        hits.push(String(pos[2]));

        return pos[2] >= 3 ? `hit at ${pos[2]}` : null;
      },
    });

    expect(found).toBe('hit at 3');
    expect(hits).toEqual(['0', '1', '2', '3']);
  });

  test('returns null when every step misses', () => {
    const found = naiveRaycast({
      rayStartPos: [0, 0, 0],
      maxRayLength: 3,
      rayLengthDelta: 1,
      rayDirection: new Vector3D(0, 0, 1),
      camera,
      stepAction: () => null,
    });

    expect(found).toBeNull();
  });
});

describe('convertBoxToQuads', () => {
  test('draws a box as six quads', () => {
    const quads = convertBoxToQuads({ type: 'box', pos: [0, 0, 0], material: WHITE });

    expect(quads).toHaveLength(6);
  });

  test('an untransformed unit box puts its front face one unit in front of the centre', () => {
    const [front] = convertBoxToQuads({ type: 'box', pos: [0, 0, 0], material: WHITE });

    expect(front?.bottomLeft).toEqual([-1, -1, 1]);
    expect(front?.bottomRight).toEqual([1, -1, 1]);
    expect(front?.topRight).toEqual([1, 1, 1]);
    expect(front?.topLeft).toEqual([-1, 1, 1]);
  });

  test('each face carries its own material colour', () => {
    const quads = convertBoxToQuads({
      type: 'box',
      pos: [0, 0, 0],
      material: {
        frontFaceColor: [1, 0, 0, 1],
        backFaceColor: [0, 1, 0, 1],
        leftFaceColor: [0, 0, 1, 1],
        rightFaceColor: [1, 1, 0, 1],
        topFaceColor: [0, 1, 1, 1],
        bottomFaceColor: [1, 0, 1, 1],
      },
    });

    expect(quads[0]?.bottomLeftColor).toEqual([1, 0, 0, 1]);
    expect(quads[1]?.bottomLeftColor).toEqual([0, 1, 0, 1]);
    expect(quads[5]?.bottomLeftColor).toEqual([0, 0, 1, 1]);
  });

  test('carries the texture coordinates a face was given', () => {
    const uv: GLQuadUV = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];

    const otherUV: GLQuadUV = [
      [1, 1],
      [1, 0],
      [0, 0],
      [0, 1],
    ];

    const [front, back, top, bottom, right, left] = convertBoxToQuads({
      type: 'box',
      pos: [0, 0, 0],
      material: WHITE,
      frontUV: uv,
      backUV: uv,
      topUV: otherUV,
      bottomUV: otherUV,
      rightUV: otherUV,
      leftUV: otherUV,
    });

    expect(front?.uv).toEqual(uv);
    expect(back?.uv).toEqual(uv);
    expect(top?.uv).toEqual(otherUV);
    expect(bottom?.uv).toEqual(otherUV);
    expect(right?.uv).toEqual(otherUV);
    expect(left?.uv).toEqual(otherUV);
  });

  test('a bare box stands at the origin, drawn as a unit box', () => {
    const quads = convertBoxToQuads({ type: 'box', material: WHITE });

    expect(quads).toHaveLength(6);
    expect(quads[0]?.bottomLeft).toEqual([-1, -1, 1]);
  });
});

describe('convertQuadToQuads', () => {
  test('draws a bare quad as the front face a box has, in one quad, untextured', () => {
    const [quad] = convertQuadToQuads({ type: 'quad', material: WHITE });

    expect(quad?.bottomLeft).toEqual([-1, -1, 1]);
    expect(quad?.bottomRight).toEqual([1, -1, 1]);
    expect(quad?.topRight).toEqual([1, 1, 1]);
    expect(quad?.topLeft).toEqual([-1, 1, 1]);

    // The flat material colours every corner, and no texture crop is carried.
    expect(quad?.bottomLeftColor).toEqual(WHITE);
    expect(quad?.bottomRightColor).toEqual(WHITE);
    expect(quad?.topRightColor).toEqual(WHITE);
    expect(quad?.topLeftColor).toEqual(WHITE);
    expect(quad?.uv).toBeUndefined();
  });

  test('scales the rectangle with x and y and offsets its plane in depth with z', () => {
    const [quad] = convertQuadToQuads({ type: 'quad', scale: [2, 3, 4], material: WHITE });

    expect(quad?.bottomLeft).toEqual([-2, -3, 4]);
    expect(quad?.bottomRight).toEqual([2, -3, 4]);
    expect(quad?.topRight).toEqual([2, 3, 4]);
    expect(quad?.topLeft).toEqual([-2, 3, 4]);
  });

  test('places the rectangle at the quad position', () => {
    const [quad] = convertQuadToQuads({ type: 'quad', pos: [10, 0, 20], material: WHITE });

    expect(quad?.bottomLeft).toEqual([9, -1, 21]);
    expect(quad?.bottomRight).toEqual([11, -1, 21]);
    expect(quad?.topRight).toEqual([11, 1, 21]);
    expect(quad?.topLeft).toEqual([9, 1, 21]);
  });

  test('turns the corners about the rotation before placing them at the position', () => {
    const [quad] = convertQuadToQuads({
      type: 'quad',
      pos: [10, 0, 0],
      scale: [2, 3, 4],
      rotation: [0, 0, Math.PI / 2],
      material: WHITE,
    });

    // A quarter turn about z carries the corner offset onto (-sy, sx), then the position is added;
    // cos of a quarter turn is not exact in floating point, so these compare approximately.
    expect(quad?.bottomLeft[0]).toBeCloseTo(13, 10);
    expect(quad?.bottomLeft[1]).toBeCloseTo(-2, 10);
    expect(quad?.bottomLeft[2]).toBeCloseTo(4, 10);

    expect(quad?.bottomRight[0]).toBeCloseTo(13, 10);
    expect(quad?.bottomRight[1]).toBeCloseTo(2, 10);
    expect(quad?.bottomRight[2]).toBeCloseTo(4, 10);

    expect(quad?.topRight[0]).toBeCloseTo(7, 10);
    expect(quad?.topRight[1]).toBeCloseTo(2, 10);
    expect(quad?.topRight[2]).toBeCloseTo(4, 10);

    expect(quad?.topLeft[0]).toBeCloseTo(7, 10);
    expect(quad?.topLeft[1]).toBeCloseTo(-2, 10);
    expect(quad?.topLeft[2]).toBeCloseTo(4, 10);
  });

  test('colours every corner with the material front colour', () => {
    const [quad] = convertQuadToQuads({
      type: 'quad',
      material: {
        frontFaceColor: [1, 0, 0, 1],
        backFaceColor: [0, 1, 0, 1],
        leftFaceColor: [0, 0, 1, 1],
        rightFaceColor: [1, 1, 0, 1],
        topFaceColor: [0, 1, 1, 1],
        bottomFaceColor: [1, 0, 1, 1],
      },
    });

    // A quad has only its front face: what the other five faces say does not matter.
    expect(quad?.bottomLeftColor).toEqual([1, 0, 0, 1]);
    expect(quad?.bottomRightColor).toEqual([1, 0, 0, 1]);
    expect(quad?.topRightColor).toEqual([1, 0, 0, 1]);
    expect(quad?.topLeftColor).toEqual([1, 0, 0, 1]);
  });
});

describe('makeTransformationMatrix defaults', () => {
  test('a bare object stands at the origin, unscaled and unrotated', () => {
    const matrix = makeTransformationMatrix({ type: 'box', material: WHITE });

    const centre = glMat4MultiplyMatrixAndVector([0, 0, 0, 0], matrix, vec4From([0, 0, 0, 1]));

    expect(centre.slice(0, 3)).toEqual([0, 0, 0]);
  });
});

describe('generateTransformMatrices', () => {
  const IDENTITY_CAMERA = { pos: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as Camera;

  test('projects with a 45 degree field of view, the given aspect and 0.1..100 depth', () => {
    const { projectionMatrix } = generateTransformMatrices({ camera: IDENTITY_CAMERA, aspect: 1 });

    // The standard perspective matrix: focal length from the field of view, then the depth bounds
    // written with the classic near minus far denominator.
    const focal = 1 / Math.tan(degreesToRadians(45) / 2);
    const near = 0.1;
    const far = 100;
    const depthFactor = 1 / (near - far);

    expect(projectionMatrix).toEqual([
      focal,
      0,
      0,
      0,
      0,
      focal,
      0,
      0,
      0,
      0,
      (far + near) * depthFactor,
      -1,
      0,
      0,
      2 * far * near * depthFactor,
      0,
    ]);
  });

  test('projects a point at the near plane to -1 and at the far plane to +1 depth', () => {
    const { projectionMatrix: projection } = generateTransformMatrices({
      camera: IDENTITY_CAMERA,
      aspect: 1,
    });

    const nearClip = glMat4MultiplyMatrixAndVector(
      [0, 0, 0, 0],
      projection,
      vec4From([0, 0, -0.1, 1]),
    );
    const farClip = glMat4MultiplyMatrixAndVector(
      [0, 0, 0, 0],
      projection,
      vec4From([0, 0, -100, 1]),
    );

    expect(nearClip[2] / nearClip[3]).toBeCloseTo(-1);
    expect(farClip[2] / farClip[3]).toBeCloseTo(1);
  });

  test('narrows the horizontal view as the aspect widens', () => {
    const { projectionMatrix } = generateTransformMatrices({ camera: IDENTITY_CAMERA, aspect: 2 });
    const focal = 1 / Math.tan(degreesToRadians(45) / 2);

    expect(projectionMatrix[0]).toBeCloseTo(focal / 2);
  });

  test('the model-view of a camera at the identity draws a point where it is', () => {
    const { modelViewMatrix } = generateTransformMatrices({ camera: IDENTITY_CAMERA, aspect: 1 });

    expect(modelViewMatrix).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  test('moves scene points by the camera position', () => {
    const camera = { pos: [5, -6, 7], rotation: [0, 0, 0], scale: [1, 1, 1] } as Camera;

    const { modelViewMatrix } = generateTransformMatrices({ camera, aspect: 1 });
    const moved = glMat4MultiplyMatrixAndVector(
      [0, 0, 0, 0],
      modelViewMatrix,
      vec4From([0, 0, 0, 1]),
    );

    expect(moved.slice(0, 3)).toEqual([5, -6, 7]);
  });

  test('scales before rotating and before translating', () => {
    const camera = {
      pos: [10, 0, 0],
      rotation: [0, 0, Math.PI / 2],
      scale: [2, 1, 1],
    } as Camera;

    const { modelViewMatrix } = generateTransformMatrices({ camera, aspect: 1 });
    const drawn = glMat4MultiplyMatrixAndVector(
      [0, 0, 0, 0],
      modelViewMatrix,
      vec4From([1, 0, 0, 1]),
    );

    // A point one unit out is scaled to two, turned a quarter way about z, then placed at the camera.
    expect(drawn[0]).toBeCloseTo(10, 10);
    expect(drawn[1]).toBeCloseTo(2, 10);
    expect(drawn[2]).toBeCloseTo(0, 10);
  });

  test('turns points about y', () => {
    const camera = { pos: [0, 0, 0], rotation: [0, Math.PI / 2, 0], scale: [1, 1, 1] } as Camera;

    const { modelViewMatrix } = generateTransformMatrices({ camera, aspect: 1 });
    const drawn = glMat4MultiplyMatrixAndVector(
      [0, 0, 0, 0],
      modelViewMatrix,
      vec4From([1, 0, 0, 1]),
    );

    // A quarter turn carries the x axis onto the negative z axis, as a right-handed turn does.
    expect(drawn[0]).toBeCloseTo(0, 10);
    expect(drawn[1]).toBeCloseTo(0, 10);
    expect(drawn[2]).toBeCloseTo(-1, 10);
  });

  test('turns points about x', () => {
    const camera = { pos: [0, 0, 0], rotation: [Math.PI / 2, 0, 0], scale: [1, 1, 1] } as Camera;

    const { modelViewMatrix } = generateTransformMatrices({ camera, aspect: 1 });
    const drawn = glMat4MultiplyMatrixAndVector(
      [0, 0, 0, 0],
      modelViewMatrix,
      vec4From([0, 1, 0, 1]),
    );

    // A quarter pitch carries +y onto +z.
    expect(drawn[0]).toBeCloseTo(0, 10);
    expect(drawn[1]).toBeCloseTo(0, 10);
    expect(drawn[2]).toBeCloseTo(1, 10);
  });
});
