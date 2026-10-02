import { parseHexColor } from '@/lib/color';
import {
  degreesToRadians,
  glMat4Identity,
  glMat4Multiply,
  glMat4MultiplyMatrixAndVector,
  glMat4Perspective,
  glMat4Rotate,
  glMat4Scale,
  glMat4Translate,
  isPointWithinNormalizedDeviceCoordinates,
  type Mat4,
  mat4From,
  Vector3D,
  vec4From,
} from '@/lib/math';
import type {
  BoxSceneObject,
  Camera,
  GLQuadUV,
  ObjectMaterial,
  SceneObject,
  Vector2Array,
  Vector3Array,
  Vector4Array,
} from '@/server_rack_scene';
import type { RackDeviceVariant } from '@/server_rack_types';

export type BoxFaceName = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom';

export interface GLQuad {
  bottomLeft: Vector3Array;
  bottomRight: Vector3Array;
  topRight: Vector3Array;
  topLeft: Vector3Array;

  modulator?: Vector4Array | undefined;

  bottomLeftColor?: Vector4Array | undefined;
  bottomRightColor?: Vector4Array | undefined;
  topRightColor?: Vector4Array | undefined;
  topLeftColor?: Vector4Array | undefined;

  uv?: GLQuadUV | undefined;
}

export const rackDeepColor = '#656561';

export const rackColorMap: Readonly<
  Record<
    RackDeviceVariant,
    {
      background: string;
      frontBackground: string;
      deviceTypeText: string;
      posLabelColor: string;
    }
  >
> = {
  lightSaladGreen: {
    background: '#a2e3a8',
    frontBackground: '#8ca18e',
    deviceTypeText: '#000000',
    posLabelColor: '#ffffff',
  },
  lightGreen: {
    background: '#bed800',
    frontBackground: '#dcf66e',
    deviceTypeText: '#000000',
    posLabelColor: '#ffffff',
  },
  lightGray: {
    background: '#939598',
    frontBackground: '#c7c8ca',
    deviceTypeText: '#000000',
    posLabelColor: '#ffffff',
  },
  lightBlue: {
    background: '#7aa8e2',
    frontBackground: '#b8d2f0',
    deviceTypeText: '#000000',
    posLabelColor: '#ffffff',
  },
  darkBlue: {
    background: '#4e6c91',
    frontBackground: '#b8d2f0',
    deviceTypeText: '#000000',
    posLabelColor: '#ffffff',
  },
  lightYellow: {
    background: '#fed459',
    frontBackground: '#fdf0b5',
    deviceTypeText: '#000000',
    posLabelColor: '#ffffff',
  },
  darkMagenta: {
    background: '#9b5392',
    frontBackground: '#aa5da0',
    deviceTypeText: '#000000',
    posLabelColor: '#ffffff',
  },
  lightRed: {
    background: '#ba1032',
    frontBackground: '#ce1439',
    deviceTypeText: '#ffffff',
    posLabelColor: '#ffffff',
  },
};

export function convertHexColorToGL(hex: string): [number, number, number, number] {
  const { r, g, b } = parseHexColor(hex);
  return [r / 255, g / 255, b / 255, 1];
}

export function getMaterialByHexColor(hexColor: string): ObjectMaterial {
  const glColor = convertHexColorToGL(hexColor);

  return {
    type: 'simpleBoxFaceColors',
    frontFaceColor: glColor,
    backFaceColor: glColor,
    topFaceColor: glColor,
    bottomFaceColor: glColor,
    rightFaceColor: glColor,
    leftFaceColor: glColor,
  };
}

export function naiveRaycast<T>({
  rayStartPos,
  maxRayLength,
  rayLengthDelta,
  rayDirection,
  camera,
  stepAction,
}: {
  readonly rayStartPos: Vector3Array;
  readonly maxRayLength: number;
  readonly rayLengthDelta: number;
  readonly rayDirection: Vector3D;
  readonly camera: Camera;
  readonly stepAction: (currentPos: Vector3Array) => T;
}) {
  const direction = rayDirection.normalize();

  for (let length = 0; length < maxRayLength; length += rayLengthDelta) {
    const currentPos = Vector3D.fromArray([
      rayStartPos[0] + direction.x * length,
      rayStartPos[1] + direction.y * length,
      rayStartPos[2] + direction.z * length,
    ])
      .rotate(-camera.rotation[1], 'y')
      .toArray();

    const foundObject = stepAction(currentPos);

    if (foundObject !== null) {
      return foundObject;
    }
  }

  return null;
}

export function isPointInsideBox(currentPos: Vector3Array, invertedBoxTransformMatrix: Mat4) {
  const homogeneousPos = vec4From([currentPos[0], currentPos[1], currentPos[2], 1]);

  // Cancel box transformation to get normalized coords
  const normalizedBoxCoords = glMat4MultiplyMatrixAndVector(
    [0, 0, 0, 0],
    invertedBoxTransformMatrix,
    homogeneousPos,
  );

  const insideBox = isPointWithinNormalizedDeviceCoordinates([
    normalizedBoxCoords[0],
    normalizedBoxCoords[1],
    normalizedBoxCoords[2],
  ]);

  return insideBox;
}

export function makeTransformationMatrix(object: Readonly<SceneObject>) {
  const pos = object.pos ?? [0, 0, 0];
  const scale = object.scale ?? [1, 1, 1];
  const rot = object.rotation ?? [0, 0, 0];

  const xRotCos = Math.cos(rot[0]);
  const xRotSin = Math.sin(rot[0]);

  const yRotCos = Math.cos(rot[1]);
  const yRotSin = Math.sin(rot[1]);

  const zRotCos = Math.cos(rot[2]);
  const zRotSin = Math.sin(rot[2]);

  // IMPORTANT: OpenGL stores matrices in COLUMN-major order

  // Create the scaling matrix
  const scaleMat = mat4From([
    scale[0],
    0,
    0,
    0,

    0,
    scale[1],
    0,
    0,

    0,
    0,
    scale[2],
    0,

    0,
    0,
    0,
    1,
  ]);

  // Create the rotation matrix for Z
  const zRot = mat4From([zRotCos, zRotSin, 0, 0, -zRotSin, zRotCos, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

  // Create the rotation matrix for Y
  const yRot = mat4From([yRotCos, 0, -yRotSin, 0, 0, 1, 0, 0, yRotSin, 0, yRotCos, 0, 0, 0, 0, 1]);

  // Create the rotation matrix for X
  const xRot = mat4From([1, 0, 0, 0, 0, xRotCos, xRotSin, 0, 0, -xRotSin, xRotCos, 0, 0, 0, 0, 1]);

  // Create the translation matrix
  const translation = mat4From([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, pos[0], pos[1], pos[2], 1]);

  // Combine the matrices: Translation * Rotation * Scaling
  const transform = glMat4Identity();

  glMat4Multiply(transform, transform, translation);
  glMat4Multiply(transform, transform, zRot);
  glMat4Multiply(transform, transform, yRot);
  glMat4Multiply(transform, transform, xRot);
  glMat4Multiply(transform, transform, scaleMat);

  return transform;
}

export function makeTransformedVertex(
  normX: number,
  normY: number,
  normZ: number,
  {
    pos,
    scale,
    xRotCos,
    xRotSin,
    yRotCos,
    yRotSin,
    zRotCos,
    zRotSin,
  }: {
    readonly pos: Vector3Array;
    readonly scale: Vector3Array;
    readonly xRotCos: number;
    readonly xRotSin: number;
    readonly yRotCos: number;
    readonly yRotSin: number;
    readonly zRotCos: number;
    readonly zRotSin: number;
  },
): Vector3Array {
  // Scale
  const sx = normX * scale[0];
  const sy = normY * scale[1];
  const sz = normZ * scale[2];

  // Rotate by Z
  const rzx = sx * zRotCos - sy * zRotSin;
  const rzy = sx * zRotSin + sy * zRotCos;
  const rzz = sz;

  // Rotate by Y
  const ryx = rzx * yRotCos + rzz * yRotSin;
  const ryy = rzy;
  const ryz = -rzx * yRotSin + rzz * yRotCos;

  // Rotate by X
  const rxx = ryx;
  const rxy = ryy * xRotCos - ryz * xRotSin;
  const rxz = ryy * xRotSin + ryz * xRotCos;

  // Translate
  const tx = rxx + pos[0];
  const ty = rxy + pos[1];
  const tz = rxz + pos[2];

  return [tx, ty, tz];
}

export function flattenSceneObjects(
  objects: readonly SceneObject[],
  parentObject?: SceneObject,
): SceneObject[] {
  const parentPos: Vector3Array = parentObject?.pos ?? [0, 0, 0];
  const parentScale: Vector3Array = parentObject?.scale ?? [1, 1, 1];
  const parentRot: Vector3Array = parentObject?.rotation ?? [0, 0, 0];

  const t = {
    xRotCos: Math.cos(parentRot[0]),
    xRotSin: Math.sin(parentRot[0]),
    yRotCos: Math.cos(parentRot[1]),
    yRotSin: Math.sin(parentRot[1]),
    zRotCos: Math.cos(parentRot[2]),
    zRotSin: Math.sin(parentRot[2]),
    pos: parentPos,
    scale: parentScale,
  };

  function flattenObject(object: SceneObject, parentObject: SceneObject | undefined) {
    if (!parentObject) {
      return object;
    }

    let pos: Vector3Array | null = null;
    if (object.pos) {
      pos = makeTransformedVertex(object.pos[0], object.pos[1], object.pos[2], t);
    } else {
      pos = makeTransformedVertex(0, 0, 0, t);
    }

    let scale: Vector3Array = parentScale;
    if (object.scale) {
      scale = [
        object.scale[0] * parentScale[0],
        object.scale[1] * parentScale[1],
        object.scale[2] * parentScale[2],
      ];
    }

    let rotation: Vector3Array = parentRot;
    if (object.rotation) {
      rotation = [
        object.rotation[0] + parentRot[0],
        object.rotation[1] + parentRot[1],
        object.rotation[2] + parentRot[2],
      ];
    }

    return { ...object, pos, scale, rotation };
  }

  return objects.flatMap((object) => {
    if (object.type === 'group') {
      return flattenSceneObjects(object.children, flattenObject(object, parentObject));
    }
    return [flattenObject(object, parentObject)];
  });
}

export function getBoxCropUV({
  cropX = 0,
  cropY = 0,
  cropWidth,
  cropHeight,
  atlasWidth,
  atlasHeight,
  faceName = 'front',
}: {
  readonly cropX?: number | undefined;
  readonly cropY?: number | undefined;
  readonly cropWidth: number;
  readonly cropHeight: number;
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly faceName?: BoxFaceName | undefined;
}): GLQuadUV {
  const x0 = cropX / atlasWidth;
  const y0 = cropY / atlasHeight;
  const x1 = (cropX + cropWidth) / atlasWidth;
  const y1 = (cropY + cropHeight) / atlasHeight;

  const bottomLeft: Vector2Array = [x0, y1];
  const bottomRight: Vector2Array = [x1, y1];
  const topRight: Vector2Array = [x1, y0];
  const topLeft: Vector2Array = [x0, y0];

  if (faceName === 'top') {
    return [topLeft, bottomLeft, bottomRight, topRight];
  }

  if (faceName === 'back' || faceName === 'right') {
    return [bottomRight, topRight, topLeft, bottomLeft];
  }

  return [bottomLeft, bottomRight, topRight, topLeft];
}

export function calcNormal(v0: Vector3Array, v1: Vector3Array, v2: Vector3Array) {
  // Vector A from v0 to v1
  const ax = v1[0] - v0[0];
  const ay = v1[1] - v0[1];
  const az = v1[2] - v0[2];

  // Vector B from v0 to v2
  const bx = v2[0] - v0[0];
  const by = v2[1] - v0[1];
  const bz = v2[2] - v0[2];

  // Normal vector between vectors A and B
  let nx = ay * bz - az * by;
  let ny = az * bx - ax * bz;
  let nz = ax * by - ay * bx;

  // Normalize the normal vector
  const length = Math.hypot(nx, ny, nz);
  if (length === 0) {
    nx = 0;
    ny = 0;
    nz = 0;
  } else {
    nx /= length;
    ny /= length;
    nz /= length;
  }

  // Return the normal unit vector
  return [nx, ny, nz];
}

export function convertBoxToQuads(box: BoxSceneObject): GLQuad[] {
  const [xRot, yRot, zRot] = box.rotation ?? [0, 0, 0];

  const t = {
    xRotCos: Math.cos(xRot),
    xRotSin: Math.sin(xRot),
    yRotCos: Math.cos(yRot),
    yRotSin: Math.sin(yRot),
    zRotCos: Math.cos(zRot),
    zRotSin: Math.sin(zRot),
    pos: box.pos ?? [0, 0, 0],
    scale: box.scale ?? [1, 1, 1],
  };

  return [
    // Front
    {
      bottomLeft: makeTransformedVertex(-1, -1, 1, t),
      bottomRight: makeTransformedVertex(1, -1, 1, t),
      topRight: makeTransformedVertex(1, 1, 1, t),
      topLeft: makeTransformedVertex(-1, 1, 1, t),

      bottomLeftColor: box.material.frontFaceColor,
      bottomRightColor: box.material.frontFaceColor,
      topRightColor: box.material.frontFaceColor,
      topLeftColor: box.material.frontFaceColor,

      ...(box.frontUV !== undefined ? { uv: box.frontUV } : {}),
    },

    // Back
    {
      bottomLeft: makeTransformedVertex(-1, -1, -1, t),
      bottomRight: makeTransformedVertex(-1, 1, -1, t),
      topRight: makeTransformedVertex(1, 1, -1, t),
      topLeft: makeTransformedVertex(1, -1, -1, t),

      bottomLeftColor: box.material.backFaceColor,
      bottomRightColor: box.material.backFaceColor,
      topRightColor: box.material.backFaceColor,
      topLeftColor: box.material.backFaceColor,

      ...(box.backUV !== undefined ? { uv: box.backUV } : {}),
    },

    // Top
    {
      bottomLeft: makeTransformedVertex(-1, 1, -1, t),
      bottomRight: makeTransformedVertex(-1, 1, 1, t),
      topRight: makeTransformedVertex(1, 1, 1, t),
      topLeft: makeTransformedVertex(1, 1, -1, t),

      bottomLeftColor: box.material.topFaceColor,
      bottomRightColor: box.material.topFaceColor,
      topRightColor: box.material.topFaceColor,
      topLeftColor: box.material.topFaceColor,

      ...(box.topUV !== undefined ? { uv: box.topUV } : {}),
    },

    // Bottom
    {
      bottomLeft: makeTransformedVertex(-1, -1, -1, t),
      bottomRight: makeTransformedVertex(1, -1, -1, t),
      topRight: makeTransformedVertex(1, -1, 1, t),
      topLeft: makeTransformedVertex(-1, -1, 1, t),

      bottomLeftColor: box.material.bottomFaceColor,
      bottomRightColor: box.material.bottomFaceColor,
      topRightColor: box.material.bottomFaceColor,
      topLeftColor: box.material.bottomFaceColor,

      ...(box.bottomUV !== undefined ? { uv: box.bottomUV } : {}),
    },

    // Right
    {
      bottomLeft: makeTransformedVertex(1, -1, -1, t),
      bottomRight: makeTransformedVertex(1, 1, -1, t),
      topRight: makeTransformedVertex(1, 1, 1, t),
      topLeft: makeTransformedVertex(1, -1, 1, t),

      bottomLeftColor: box.material.rightFaceColor,
      bottomRightColor: box.material.rightFaceColor,
      topRightColor: box.material.rightFaceColor,
      topLeftColor: box.material.rightFaceColor,

      ...(box.rightUV !== undefined ? { uv: box.rightUV } : {}),
    },

    // Left
    {
      bottomLeft: makeTransformedVertex(-1, -1, -1, t),
      bottomRight: makeTransformedVertex(-1, -1, 1, t),
      topRight: makeTransformedVertex(-1, 1, 1, t),
      topLeft: makeTransformedVertex(-1, 1, -1, t),

      bottomLeftColor: box.material.leftFaceColor,
      bottomRightColor: box.material.leftFaceColor,
      topRightColor: box.material.leftFaceColor,
      topLeftColor: box.material.leftFaceColor,

      ...(box.leftUV !== undefined ? { uv: box.leftUV } : {}),
    },
  ];
}

export function getCameraWorldPos(camera: Camera): Vector3Array {
  return [-camera.pos[0], -camera.pos[1], -camera.pos[2]];
}

export function generateTransformMatrices({
  camera,
  aspect,
}: {
  readonly camera: Camera;
  readonly aspect: number;
}) {
  // Create a perspective matrix, a special matrix that is
  // used to simulate the distortion of perspective in a camera.
  // Our field of view is 45 degrees, with a width/height
  // ratio that matches the display size of the canvas
  // and we only want to see objects between 0.1 units
  // and 100 units away from the camera.
  const fieldOfView = degreesToRadians(45);
  const zNear = 0.1;
  const zFar = 100;
  const projectionMatrix = glMat4Identity();

  glMat4Perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

  // Set the drawing position to the "identity" point, which is
  // the center of the scene.
  const modelViewMatrix = glMat4Identity();

  // Now move the drawing position a bit to where we want to
  // start drawing the square.
  glMat4Translate(modelViewMatrix, modelViewMatrix, camera.pos);

  glMat4Rotate(modelViewMatrix, modelViewMatrix, camera.rotation[2], [0, 0, 1]);
  glMat4Rotate(modelViewMatrix, modelViewMatrix, camera.rotation[1], [0, 1, 0]);
  glMat4Rotate(modelViewMatrix, modelViewMatrix, camera.rotation[0], [1, 0, 0]);

  glMat4Scale(modelViewMatrix, modelViewMatrix, camera.scale);

  return { modelViewMatrix, projectionMatrix };
}
