import { describe, expect, test } from 'vitest';
import { glMat4Invert, glMat4MultiplyMatrixAndVector, Vector3D, vec4From } from '@/util/math';
import {
  calcNormal,
  convertBoxToQuads,
  convertHexColorToGL,
  flattenSceneObjects,
  getBoxCropUV,
  getCameraWorldPos,
  getFaceColor,
  getMaterialByHexColor,
  isPointInsideBox,
  makeTransformationMatrix,
  makeTransformedVertex,
  naiveRaycast,
} from './geometry';
import type { Camera, GroupSceneObject, Vector3Array } from './scene';

/** The flat material, so a box in these tests draws without naming colours per face. */
const WHITE = [1, 1, 1, 1] as const;

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
    } as const;

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
    const matrix = makeTransformationMatrix({ type: 'box', pos: [5, 0, 0] });

    // Transform the box centre, which is the origin in its own coordinates.
    const centre = glMat4MultiplyMatrixAndVector([0, 0, 0, 0], matrix, vec4From([0, 0, 0, 1]));

    expect(centre.slice(0, 3)).toEqual([5, 0, 0]);
  });
});

describe('isPointInsideBox', () => {
  test('answers for a box transformed to a known place', () => {
    const box: BoxSceneObject = { type: 'box', pos: [10, 0, 0], scale: [2, 2, 2] };
    const inverted = glMat4Invert(
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      makeTransformationMatrix(box),
    );

    expect(isPointInsideBox([10, 0, 0], inverted)).toBe(true);
    expect(isPointInsideBox([10, 0, 4], inverted)).toBe(false);
  });
});

describe('flattenSceneObjects', () => {
  test('leaves standalone objects alone', () => {
    const object: BoxSceneObject = { type: 'box', pos: [1, 2, 3] };

    expect(flattenSceneObjects([object])).toEqual([object]);
  });

  test('applies a group transform to its children and drops the group', () => {
    const group: GroupSceneObject = {
      type: 'group',
      pos: [10, 0, 0],
      scale: [2, 2, 2],
      children: [{ type: 'box', pos: [1, 0, 0] }],
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
          children: [{ type: 'box' }],
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
    const uv: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];

    const [front, back] = convertBoxToQuads({
      type: 'box',
      pos: [0, 0, 0],
      material: WHITE,
      frontUV: uv,
      backUV: uv,
    });

    expect(front?.uv).toEqual(uv);
    expect(back?.uv).toEqual(uv);
  });
});
