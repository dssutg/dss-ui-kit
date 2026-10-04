/**
 * Geometry for the WebGL scene renderer: colours, transforms, and turning scene objects into quads.
 *
 * Everything here is plain arithmetic on arrays — no GL calls and no DOM — so it can be reasoned
 * about, and tested, without a canvas. The renderer in `renderer.tsx` is the only thing that talks to
 * the GPU, and it takes the quads these functions produce.
 *
 * Positions are in world units and rotations are in radians, because that is what the maths here is
 * written in; a scene author working in degrees converts at the boundary.
 */

import { parseHexColor } from '@/util/color';
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
} from '@/util/math';
import type {
  BoxFaceColors,
  BoxSceneObject,
  Camera,
  GLQuadUV,
  ObjectMaterial,
  SceneObject,
  Vector2Array,
  Vector3Array,
  Vector4Array,
} from './scene';

/** One of the six faces of a box, naming a colour entry of {@link BoxFaceColors}. */
export type BoxFaceName = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom';

const FACE_COLOR_KEYS = {
  front: 'frontFaceColor',
  back: 'backFaceColor',
  top: 'topFaceColor',
  bottom: 'bottomFaceColor',
  right: 'rightFaceColor',
  left: 'leftFaceColor',
} as const;

/**
 * One quad in world space, as the renderer uploads it.
 *
 * Colour is per corner rather than per quad so a textured or alpha-blended quad can vary along its
 * surface; an untextured quad sets all four to the same value. `uv` absent means untextured.
 */
export interface GLQuad {
  readonly bottomLeft: Vector3Array;
  readonly bottomRight: Vector3Array;
  readonly topRight: Vector3Array;
  readonly topLeft: Vector3Array;

  /** Multiplied into every corner colour. Defaults to opaque white. */
  readonly modulator?: Vector4Array | undefined;
  readonly bottomLeftColor?: Vector4Array | undefined;
  readonly bottomRightColor?: Vector4Array | undefined;
  readonly topRightColor?: Vector4Array | undefined;
  readonly topLeftColor?: Vector4Array | undefined;
  readonly uv?: GLQuadUV | undefined;
}

/** A CSS hex colour as the RGBA the renderer puts in a vertex attribute. */
export function convertHexColorToGL(hex: string): Vector4Array {
  const { r, g, b } = parseHexColor(hex);
  return [r / 255, g / 255, b / 255, 1];
}

/** A material in one flat colour, given as a CSS hex colour. */
export function getMaterialByHexColor(hexColor: string): ObjectMaterial {
  return convertHexColorToGL(hexColor);
}

/**
 * The colour one face of an object is drawn in.
 *
 * Takes either shape of material, so a scene that wants a different colour on each face can have one
 * and a scene that does not can write a single RGBA array.
 */
export function getFaceColor(material: ObjectMaterial, face: BoxFaceName): Vector4Array {
  if (Array.isArray(material)) {
    return material;
  }
  return material[FACE_COLOR_KEYS[face]];
}

/**
 * Walks a ray through the scene in fixed steps and returns whatever the first hit is.
 *
 * Stepping rather than intersecting is deliberate: it costs a call per step and needs no acceleration
 * structure, which is affordable for the picking a click needs and is why this suits a scene built
 * from a few thousand boxes. `stepAction` returns what it found, or `null` to let the ray continue.
 */
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
}): T | null {
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

/** True when a point is inside the box whose transform is inverted back to world units. */
export function isPointInsideBox(
  currentPos: Vector3Array,
  invertedBoxTransformMatrix: Mat4,
): boolean {
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

/**
 * The model matrix for one object: translation, then rotation about each axis, then scale.
 *
 * Column-major, because that is the order OpenGL reads a matrix in and `mat4From` takes it verbatim.
 * Rotation is in radians.
 */
export function makeTransformationMatrix(object: Readonly<SceneObject>): Mat4 {
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

/**
 * Places one vertex of a unit box through a transform.
 *
 * The three arguments are the vertex's position in `-1..1` on each axis, and the transform is passed
 * as its position, scale and the sine and cosine of its rotation, so a caller transforming a whole
 * box's worth of vertices computes those six once rather than per vertex.
 */
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

/**
 * Resolves a scene into the flat list of drawable objects the renderer uploads.
 *
 * A group contributes its transform to each child and then disappears, so the renderer never has to
 * walk a hierarchy. Rotation accumulates additively and scale multiplicatively, which is what a
 * caller composing a scene in nested groups expects.
 */
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

/**
 * The texture coordinates for a rectangular crop of an atlas, on one face of a box.
 *
 * `faceName` rotates the corners rather than the crop, because the back, right and top faces are
 * drawn from a viewpoint that mirrors them; leaving it out assumes the front face.
 */
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

/**
 * The unit normal of the triangle the three vertices wind around.
 *
 * A degenerate triangle gets a zero normal rather than a division by zero, which leaves it unlit
 * instead of turning it black.
 */
export function calcNormal(v0: Vector3Array, v1: Vector3Array, v2: Vector3Array): Vector3Array {
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

/**
 * The six quads a box is drawn as, wound so that each face points away from its centre.
 *
 * The winding is not cosmetic: back-face culling is off, so a face wound the wrong way is lit from
 * the inside and reads as a dark patch on the box.
 */
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

      bottomLeftColor: getFaceColor(box.material, 'front'),
      bottomRightColor: getFaceColor(box.material, 'front'),
      topRightColor: getFaceColor(box.material, 'front'),
      topLeftColor: getFaceColor(box.material, 'front'),

      ...(box.frontUV !== undefined ? { uv: box.frontUV } : {}),
    },

    // Back
    {
      bottomLeft: makeTransformedVertex(-1, -1, -1, t),
      bottomRight: makeTransformedVertex(-1, 1, -1, t),
      topRight: makeTransformedVertex(1, 1, -1, t),
      topLeft: makeTransformedVertex(1, -1, -1, t),

      bottomLeftColor: getFaceColor(box.material, 'back'),
      bottomRightColor: getFaceColor(box.material, 'back'),
      topRightColor: getFaceColor(box.material, 'back'),
      topLeftColor: getFaceColor(box.material, 'back'),

      ...(box.backUV !== undefined ? { uv: box.backUV } : {}),
    },

    // Top
    {
      bottomLeft: makeTransformedVertex(-1, 1, -1, t),
      bottomRight: makeTransformedVertex(-1, 1, 1, t),
      topRight: makeTransformedVertex(1, 1, 1, t),
      topLeft: makeTransformedVertex(1, 1, -1, t),

      bottomLeftColor: getFaceColor(box.material, 'top'),
      bottomRightColor: getFaceColor(box.material, 'top'),
      topRightColor: getFaceColor(box.material, 'top'),
      topLeftColor: getFaceColor(box.material, 'top'),

      ...(box.topUV !== undefined ? { uv: box.topUV } : {}),
    },

    // Bottom
    {
      bottomLeft: makeTransformedVertex(-1, -1, -1, t),
      bottomRight: makeTransformedVertex(1, -1, -1, t),
      topRight: makeTransformedVertex(1, -1, 1, t),
      topLeft: makeTransformedVertex(-1, -1, 1, t),

      bottomLeftColor: getFaceColor(box.material, 'bottom'),
      bottomRightColor: getFaceColor(box.material, 'bottom'),
      topRightColor: getFaceColor(box.material, 'bottom'),
      topLeftColor: getFaceColor(box.material, 'bottom'),

      ...(box.bottomUV !== undefined ? { uv: box.bottomUV } : {}),
    },

    // Right
    {
      bottomLeft: makeTransformedVertex(1, -1, -1, t),
      bottomRight: makeTransformedVertex(1, 1, -1, t),
      topRight: makeTransformedVertex(1, 1, 1, t),
      topLeft: makeTransformedVertex(1, -1, 1, t),

      bottomLeftColor: getFaceColor(box.material, 'right'),
      bottomRightColor: getFaceColor(box.material, 'right'),
      topRightColor: getFaceColor(box.material, 'right'),
      topLeftColor: getFaceColor(box.material, 'right'),

      ...(box.rightUV !== undefined ? { uv: box.rightUV } : {}),
    },

    // Left
    {
      bottomLeft: makeTransformedVertex(-1, -1, -1, t),
      bottomRight: makeTransformedVertex(-1, -1, 1, t),
      topRight: makeTransformedVertex(-1, 1, 1, t),
      topLeft: makeTransformedVertex(-1, 1, -1, t),

      bottomLeftColor: getFaceColor(box.material, 'left'),
      bottomRightColor: getFaceColor(box.material, 'left'),
      topRightColor: getFaceColor(box.material, 'left'),
      topLeftColor: getFaceColor(box.material, 'left'),

      ...(box.leftUV !== undefined ? { uv: box.leftUV } : {}),
    },
  ];
}

/** Where the camera sits in world space, which is its own position mirrored through the origin. */
export function getCameraWorldPos(camera: Camera): Vector3Array {
  return [-camera.pos[0], -camera.pos[1], -camera.pos[2]];
}

/**
 * The projection and model-view matrices for a camera at a given aspect ratio.
 *
 * A 45-degree field of view, near and far planes at 0.1 and 100 world units. A scene that leaves that
 * range is clipped rather than scaled away, which is the trade a bounded scene makes for a renderer
 * with no depth-of-field to preserve.
 */
export function generateTransformMatrices({
  camera,
  aspect,
}: {
  readonly camera: Camera;
  readonly aspect: number;
}): { modelViewMatrix: Mat4; projectionMatrix: Mat4 } {
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
