// A server rack drawn in WebGL, and the editor for the CSV device database behind it.
//
// What is rendered here is a set of boxes on shelves, so the geometry, the camera and the palette
// belong to this module. What goes *in* the boxes does not: which device sits in which slot, what a
// device type is called, and what colour stands for it are the caller's facts, and every one of them
// arrives as a prop or a field of a descriptor. Nothing here reads application state, asks for a
// route, or fetches anything.
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { AutoSizer } from '@/lib/AutoSizer.tsx';
import { groupArrayByProperty, removeDuplicateObjectsFromArray } from '@/lib/array';
import { parseHexColor } from '@/lib/color';
import { parseCSV } from '@/lib/dsv';
import { downloadStringAsPlainTextFile, openFileDialog } from '@/lib/file';
import {
  clamp,
  cmp,
  degreesToRadians,
  glMat4Identity,
  glMat4Invert,
  glMat4Multiply,
  glMat4MultiplyMatrixAndVector,
  glMat4Perspective,
  glMat4Rotate,
  glMat4Scale,
  glMat4Translate,
  isPointWithinNormalizedDeviceCoordinates,
  lerp,
  lerpRange,
  type Mat4,
  mat4From,
  modulo,
  naturalCmp,
  normalizeRadians,
  type Vec4,
  Vector3D,
  vec4From,
} from '@/lib/math';
import { getListAsCountMap } from '@/lib/record';
import { useEventListener } from '@/lib/use_event_listener';
import { useGranularEffect } from '@/lib/use_granular_effect';
import { useMouseDrag } from '@/lib/use_mouse_drag';
import { useLocale } from '@/locale';
import fragmentShaderSource from '@/shaders/rack_fragment.glsl?raw';
import vertexShaderSource from '@/shaders/rack_vertex.glsl?raw';
import { Button, ButtonGroup, IconButton } from '@/ui/button';
import { ToggleSwitch } from '@/ui/checkbox';
import { DropDownButton, type DropDownMenuItem } from '@/ui/dropdown';
import { TextInput } from '@/ui/input';
import { Modal } from '@/ui/Modal.tsx';
import { UploadConfig } from '@/ui/UploadConfig.tsx';

/**
 * Which face of the cabinet a device is mounted on. A rack is described as two panels because that
 * is how the hardware is built, not because this module knows anything about it.
 */
export type RackPanelName = 'front' | 'back';

/**
 * The palette a device is drawn in. A name rather than a colour, so the eight colours that ship here
 * stay the library's own and a caller adding a ninth supplies the hex value itself.
 */
export type RackDeviceVariant =
  | 'lightSaladGreen'
  | 'lightGreen'
  | 'lightGray'
  | 'lightBlue'
  | 'darkBlue'
  | 'lightYellow'
  | 'darkMagenta'
  | 'lightRed';

/** One device mounted in the cabinet. */
export interface RackDevice {
  readonly row: number;
  readonly column: number;
  /**
   * The slot this device occupies, as the operator labels it. Drawn on the face, so it is text and
   * belongs to the caller.
   */
  readonly posLabel: string;
  /**
   * The caller's key for this kind of device. Matched against {@link ServerRackViewProps.deviceTypes}
   * to decide the label and the palette; the module never interprets it.
   */
  readonly deviceType: string;
  readonly serialNumber: number;
}

/** One face of the cabinet: how many slots it has, and what is mounted in them. */
export interface RackPanel {
  readonly rowCount: number;
  readonly columnCount: number;
  readonly devices: readonly RackDevice[];
}

/** A whole cabinet. */
export interface Rack {
  readonly id: string;
  readonly frontPanel: RackPanel;
  readonly backPanel: RackPanel;
}

/**
 * How a caller describes one of its device types to {@link ServerRackView}.
 *
 * `title` is the label as the caller wants it drawn, already resolved into the caller's language,
 * because the wording of a device type is the caller's vocabulary and not a key this library owns.
 * A type with no entry is not drawn, which is how a caller hides a device type without editing this
 * module.
 */
export interface RackDeviceTypeDescriptor {
  readonly title: string;
  readonly variant: RackDeviceVariant;
}

/** Device types keyed by the `deviceType` a {@link RackDevice} carries. */
export type DeviceTypeLookup = Readonly<Record<string, RackDeviceTypeDescriptor>>;

function getRackDeviceRenderInfo(
  deviceType: string,
  deviceTypes: DeviceTypeLookup,
): { readonly title: string; readonly color: RackDeviceVariant } | null {
  const descriptor = deviceTypes[deviceType];

  if (!descriptor) {
    return null;
  }

  return { title: descriptor.title, color: descriptor.variant };
}

/** What a click on a drawn device carries back to the caller. */
interface RackDeviceTag {
  readonly type: 'smallRackDeviceModel';
  readonly device: RackDevice;
  readonly rackPanelName: RackPanelName;
}

/** A tag a raycast hit can carry. The guard is what makes `tag` usable after `unknown`. */
function isRackDeviceTag(tag: unknown): tag is RackDeviceTag {
  if (typeof tag !== 'object' || tag === null) {
    return false;
  }

  const candidate = tag as Partial<RackDeviceTag>;

  return (
    candidate.type === 'smallRackDeviceModel' &&
    typeof candidate.device === 'object' &&
    candidate.device !== null &&
    (candidate.rackPanelName === 'front' || candidate.rackPanelName === 'back')
  );
}

/** Identifies one device in {@link ServerRackViewProps.onDeviceClick}. */
export interface RackDeviceRef {
  readonly deviceType: string;
  readonly serialNumber: number;
}

const rackBackPadding = 2;

const rackDeepColor = '#656561';

const rackColorMap: Readonly<
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

type Vector2Array = [number, number];
type Vector3Array = [number, number, number];
type Vector4Array = [number, number, number, number];

function getRackTextScale(
  text: string,
  {
    minScale,
    maxScale,
    characterImpact,
  }: {
    readonly minScale: number;
    readonly maxScale: number;
    readonly characterImpact: number;
  },
) {
  const progress = clamp(text.length * characterImpact, 0, 1);

  return lerp(maxScale, minScale, progress);
}

function naiveRaycast<T>({
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

function isPointInsideBox(currentPos: Vector3Array, invertedBoxTransformMatrix: Mat4) {
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

function buildServerRackModel({
  serverRack,
  targetDevice,
  deviceTypes,
}: {
  readonly serverRack: Rack;
  readonly targetDevice?: RackDeviceRef | undefined;
  readonly deviceTypes: DeviceTypeLookup;
}): SceneObject {
  const {
    rowCount: frontRows,
    columnCount: frontColumns,
    devices: frontDevices,
  } = serverRack.frontPanel;
  const {
    rowCount: backRows,
    columnCount: backColumns,
    devices: backDevices,
  } = serverRack.backPanel;

  const hasFront = frontRows !== 0 && frontColumns !== 0;
  const hasBack = backRows !== 0 && backColumns !== 0;

  const rowCount = Math.max(frontRows, backRows, 1);
  const columnCount = Math.max(frontColumns, backColumns, 1);
  const width = Math.ceil((columnCount * 2) / 11);

  const frontDeviceRows = groupArrayByProperty(frontDevices, ({ row }) => row);
  const backDeviceRows = groupArrayByProperty(backDevices, ({ row }) => row);

  const shelfHeight = 0.8;
  const innerSideWidth = 0.125;
  const innerSideHeight = shelfHeight * (rowCount + 1);
  const shelfDepth = 1;
  const bothSideShelfDepth = shelfDepth * 2;

  const outerSideWidth = innerSideWidth;
  const outerSideHeight = innerSideHeight;

  const backPanelWidth = width * 2 + rackBackPadding;
  const backPanelHeight = outerSideHeight;
  const backPanelDepth = 0.125;

  const topPanelWidth = backPanelWidth + outerSideWidth * 2;
  const topPanelHeight = 0.125;
  const topPanelDepth = bothSideShelfDepth;

  const bottomPanelWidth = topPanelWidth;
  const bottomPanelHeight = topPanelHeight;
  const bottomPanelDepth = topPanelDepth;

  const doorPanelWidth = outerSideWidth;
  const doorPanelHeight = outerSideHeight;
  const doorPanelDepth = backPanelWidth / 2 + outerSideWidth / 2;

  return {
    type: 'group',
    children: [
      // Front Inner Left Panel
      {
        type: 'box',
        pos: [-width - innerSideWidth / 2, -innerSideHeight / 2 + shelfHeight / 2, shelfDepth / 2],
        scale: [innerSideWidth / 2, innerSideHeight / 2, shelfDepth / 2],
        material: getMaterialByHexColor(rackDeepColor),
      },
      // Back Inner Left Panel
      {
        type: 'box',
        pos: [-width - innerSideWidth / 2, -innerSideHeight / 2 + shelfHeight / 2, -shelfDepth / 2],
        scale: [innerSideWidth / 2, innerSideHeight / 2, shelfDepth / 2],
        material: getMaterialByHexColor(rackDeepColor),
      },
      // Front Inner Right Panel
      {
        type: 'box',
        pos: [width + innerSideWidth / 2, -innerSideHeight / 2 + shelfHeight / 2, shelfDepth / 2],
        scale: [innerSideWidth / 2, innerSideHeight / 2, shelfDepth / 2],
        material: getMaterialByHexColor(rackDeepColor),
      },
      // Back Inner Right Panel
      {
        type: 'box',
        pos: [width + innerSideWidth / 2, -innerSideHeight / 2 + shelfHeight / 2, -shelfDepth / 2],
        scale: [innerSideWidth / 2, innerSideHeight / 2, shelfDepth / 2],
        material: getMaterialByHexColor(rackDeepColor),
      },
      // Outer Left Panel
      {
        type: 'box',
        pos: [
          -width - outerSideWidth / 2 - rackBackPadding / 2,
          -outerSideHeight / 2 + shelfHeight / 2,
          0,
        ],
        scale: [outerSideWidth / 2, outerSideHeight / 2, bothSideShelfDepth / 2],
        material: getMaterialByHexColor(rackDeepColor),
      },
      // Outer Right Panel
      {
        type: 'box',
        pos: [
          width + outerSideWidth / 2 + rackBackPadding / 2,
          -outerSideHeight / 2 + shelfHeight / 2,
          0,
        ],
        scale: [outerSideWidth / 2, outerSideHeight / 2, bothSideShelfDepth / 2],
        material: getMaterialByHexColor(rackDeepColor),
      },
      // Back Panel
      {
        type: 'box',
        pos: [0, -backPanelHeight / 2 + shelfHeight / 2, 0],
        scale: [backPanelWidth / 2, backPanelHeight / 2, backPanelDepth / 2],
        material: getMaterialByHexColor(rackDeepColor),
      },
      // Top Panel
      {
        type: 'box',
        pos: [0, shelfHeight / 2 + topPanelHeight / 2, 0],
        scale: [topPanelWidth / 2, topPanelHeight / 2, topPanelDepth / 2],
        material: getMaterialByHexColor(rackDeepColor),
      },
      // Bottom Panel
      {
        type: 'box',
        pos: [0, -innerSideHeight + shelfHeight / 2, 0],
        scale: [bottomPanelWidth / 2, bottomPanelHeight / 2, bottomPanelDepth / 2],
        material: getMaterialByHexColor(rackDeepColor),
      },
      // Left Front Door Panel
      ...Array.from({ length: 4 }).map((_, index) => {
        const front = index < 2;
        const flip = index % 2 === 1;

        const sideExists = (front && hasFront) || (!front && hasBack);

        let angle = 0;
        if (sideExists) {
          if (flip) {
            angle = Math.PI / 4;
          } else {
            angle = -Math.PI / 4;
          }
        } else if (flip) {
          angle = -Math.PI / 2;
        } else {
          angle = Math.PI / 2;
        }

        let rotY = angle;
        if (!front) {
          rotY = Math.PI - angle;
        }

        let sides: SceneObject[] = [];
        if (sideExists) {
          sides = [
            {
              type: 'box',
              pos: [0, 0, doorPanelDepth],
              scale: [0.125, 0.25, 0.125 / 2],
              material: getMaterialByHexColor('#111111'),
            },
          ];
        }

        const group: SceneObject = {
          type: 'group',

          pos: [
            -(width + outerSideWidth / 2 + rackBackPadding / 2) * (flip ? -1 : 1),
            -outerSideHeight / 2 + shelfHeight / 2,
            (bothSideShelfDepth / 2) * (front ? 1 : -1),
          ],
          rotation: [0, rotY, 0],
          children: [
            {
              type: 'box',
              pos: [0, 0, doorPanelDepth / 2],
              scale: [doorPanelWidth / 2, doorPanelHeight / 2, doorPanelDepth / 2],
              material: getMaterialByHexColor(rackDeepColor),
            },
            ...sides,
          ],
        };

        return group;
      }),
      ...Array.from({ length: rowCount }).map(
        (_, rowIndex): SceneObject => ({
          type: 'group',
          children: [
            buildServerRackShelfModel({
              columnCount,
              width,
              pos: [0, getRackShelfPosByRowIndex(rowIndex), 0],
              scale: [1, 1, 1],
              devices: frontDeviceRows[rowIndex] ?? [],
              rackPanelName: 'front',
              targetDevice,
              deviceTypes,
            }),
            buildServerRackShelfModel({
              columnCount,
              width,
              pos: [0, getRackShelfPosByRowIndex(rowIndex), 0],
              scale: [-1, 1, -1],
              devices: backDeviceRows[rowIndex] ?? [],
              rackPanelName: 'back',
              targetDevice,
              deviceTypes,
            }),
          ],
        }),
      ),
    ],
  };
}

function buildServerRackShelfModel({
  columnCount,
  pos,
  width,
  scale,
  devices,
  rackPanelName,
  targetDevice,
  deviceTypes,
}: {
  readonly columnCount: number;
  readonly pos: Vector3Array;
  readonly width: number;
  readonly scale: Vector3Array;
  readonly devices: readonly RackDevice[];
  readonly rackPanelName: RackPanelName;
  readonly targetDevice?: RackDeviceRef | undefined;
  readonly deviceTypes: DeviceTypeLookup;
}): SceneObject {
  const hangSize: Vector3Array = [width * 2, 0.25, 0.25];

  return {
    type: 'group',
    pos,
    scale,
    children: [
      // Hang
      {
        type: 'box',
        pos: [0, hangSize[1] / 2, hangSize[2] / 2],
        scale: [hangSize[0] / 2, hangSize[1] / 2, hangSize[2] / 2],
        material: getMaterialByHexColor('#ffc800'),
      },
      // Devices
      ...Array.from({ length: columnCount })
        .flatMap((_, columnIndex) => {
          const device = devices.filter((device) => device.column === columnIndex)[0] ?? null;

          if (!device) {
            return [];
          }

          const isTarget =
            targetDevice?.deviceType === device.deviceType &&
            targetDevice?.serialNumber === device.serialNumber;

          const approximateDeviceDepth = 0.85;

          const model = buildSmallRackDeviceModel({
            device,
            pos: [
              0.3 * (columnIndex + 1) - width,
              -hangSize[1] / 2,
              hangSize[2] / 2 + approximateDeviceDepth / 2,
            ],
            deviceTypes,
            isTarget,
            rackPanelName,
          });

          return model ?? [];
        })
        .flat(),
    ],
  };
}

function buildSmallRackDeviceModel({
  pos,
  device,
  deviceTypes,
  isTarget,
  rackPanelName,
}: {
  readonly pos: Vector3Array;
  readonly device: RackDevice;
  readonly deviceTypes: DeviceTypeLookup;
  readonly isTarget: boolean;
  readonly rackPanelName: RackPanelName;
}): SceneObject | null {
  const { deviceType, posLabel } = device;

  const renderInfo = getRackDeviceRenderInfo(deviceType, deviceTypes);

  if (!renderInfo) {
    return null;
  }

  const { title: typeTitle, color: paletteName } = renderInfo;

  const palette = rackColorMap[paletteName];

  const typeTitleScale = getRackTextScale(typeTitle, {
    minScale: 0.3,
    maxScale: 1.4,
    characterImpact: 1 / 35,
  });

  const tag: RackDeviceTag = {
    type: 'smallRackDeviceModel',
    device,
    rackPanelName,
  };

  return {
    type: 'group',
    pos,
    children: [
      {
        type: 'box',
        tag,
        pos: [0, 0, 0],
        scale: [0.125, 0.35, 0.45],
        material: getMaterialByHexColor(palette.background),
      },
      {
        type: 'box',
        tag,
        pos: [0, 0, 0.45],
        scale: [0.125, 0.25, 0.125 / 8],
        material: getMaterialByHexColor(palette.frontBackground),
      },
      {
        type: 'box',
        tag,
        pos: [0, 0.35, 0.435],
        scale: [0.125, 0.125 / 8, 0.125 / 16],
        material: getMaterialByHexColor(palette.background),
      },
      ...(isTarget
        ? [
            buildArrowDownModel({
              pos: [0, 0.65, 0.2],
              flip: rackPanelName === 'back',
            }),
          ]
        : []),
      {
        type: 'text',
        text: posLabel,
        pos: [-((posLabel.length / 2) * 0.04), 0.4, 0.5],
        scale: [0.125 / 4, 0.125 / 4, 1],
        color: convertHexColorToGL(palette.posLabelColor),
      },
      {
        type: 'text',
        text: typeTitle,
        pos: [0, -(typeTitle.length / 2) * 0.04 * typeTitleScale, 0.5],
        scale: [(0.125 / 4) * typeTitleScale, (0.125 / 4) * typeTitleScale, 1],
        rotation: [0, 0, ((rackPanelName === 'back' ? -1 : 1) * Math.PI) / 2],
        color: convertHexColorToGL(palette.deviceTypeText),
      },
    ],
  };
}

function buildArrowDownModel({
  pos,
  flip = false,
}: {
  readonly pos: Vector3Array;
  readonly flip?: boolean | undefined;
}): SceneObject {
  const color = '#00ff00';

  return {
    type: 'group',
    pos,
    scale: [flip ? -1 : 1, 1, 1],
    children: [
      {
        type: 'box',
        pos: [0, -0.025, 0],
        scale: [0.125 / 4, 0.15, 0.125 / 4],
        material: getMaterialByHexColor(color),
      },
      buildPointerPartModel({ color, flip: !flip }),
      buildPointerPartModel({ color, flip }),
    ],
  };
}

function buildPointerPartModel({
  color,
  flip = false,
}: {
  readonly color: string;
  readonly flip?: boolean | undefined;
}): SceneObject {
  return {
    type: 'box',
    pos: [((-0.125 * 34) / 128) * (flip ? -1 : 1), -0.125 - 0.125 / 4, 0],
    scale: [0.125 / 4, (0.125 * 1.25) / 2, 0.125 / 4],
    rotation: [0, 0, flip ? -Math.PI / 4 : Math.PI / 4],
    material: getMaterialByHexColor(color),
  };
}

function getRackShelfPosByRowIndex(rowIndex: number) {
  const rowHeight = 0.8;
  return -rowIndex * rowHeight;
}

type BoxFaceName = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom';

type GLQuadUV = [
  [number, number], // bottom left vertex
  [number, number], // bottom right vertex
  [number, number], // top right vertex
  [number, number], // top left vertex
];

interface GLQuad {
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

interface ObjectMaterial {
  type: 'simpleBoxFaceColors';
  frontFaceColor: Vector4Array;
  backFaceColor: Vector4Array;
  topFaceColor: Vector4Array;
  bottomFaceColor: Vector4Array;
  rightFaceColor: Vector4Array;
  leftFaceColor: Vector4Array;
}

interface QuadSceneObject {
  type: 'quad';
  pos?: Vector3Array | undefined;
  scale?: Vector3Array | undefined;
  rotation?: Vector3Array | undefined;
  material: ObjectMaterial;
}

interface BoxSceneObject {
  type: 'box';
  pos?: Vector3Array | undefined;
  scale?: Vector3Array | undefined;
  rotation?: Vector3Array | undefined;
  material: ObjectMaterial;
  frontUV?: GLQuadUV | undefined;
  backUV?: GLQuadUV | undefined;
  topUV?: GLQuadUV | undefined;
  bottomUV?: GLQuadUV | undefined;
  rightUV?: GLQuadUV | undefined;
  leftUV?: GLQuadUV | undefined;
  tag?: unknown | undefined;
}

interface TextSceneObject {
  type: 'text';
  text: string;
  pos?: Vector3Array | undefined;
  scale?: Vector3Array | undefined;
  rotation?: Vector3Array | undefined;
  material?: ObjectMaterial | undefined;
  color?: Vector4Array | undefined;
}

interface GroupSceneObject {
  type: 'group';
  pos?: Vector3Array | undefined;
  scale?: Vector3Array | undefined;
  rotation?: Vector3Array | undefined;
  children: SceneObject[];
}

type SceneObject = QuadSceneObject | BoxSceneObject | TextSceneObject | GroupSceneObject;

interface Scene {
  objects: SceneObject[];
}

interface ProgramInfo {
  program: WebGLProgram;
  attribLocations: {
    vertexPos: number;
    vertexTextureCoord: number;
    vertexNormal: number;
    vertexColor: number;
    vertexColorModulator: number;
  };
  uniformLocations: {
    projectionMatrix: WebGLUniformLocation | null;
    modelViewMatrix: WebGLUniformLocation | null;
    cameraPos: WebGLUniformLocation | null;
    texture: WebGLUniformLocation | null;
  };
}

interface FontCharacterInfo {
  textureCoordX: number;
  textureCoordY: number;
  width: number;
}

type FontCharacterMap = Record<string, FontCharacterInfo>;

interface FontRenderInfo {
  characterMap: FontCharacterMap;
  fontSize: number;
  toleranceY: number;
  texture: WebGLTexture;
}

interface SceneRenderContext {
  buffers: {
    pos: WebGLBuffer | null;
    textureCoord: WebGLBuffer | null;
    normal: WebGLBuffer | null;
    color: WebGLBuffer | null;
    colorModulator: WebGLBuffer | null;
    indices: WebGLBuffer | null;
  };
  vertexCount: number;
  fontRenderInfo: FontRenderInfo | null;
}

interface Camera {
  pos: Vector3Array;
  scale: Vector3Array;
  rotation: Vector3Array;
}

function convertHexColorToGL(hex: string): [number, number, number, number] {
  const { r, g, b } = parseHexColor(hex);
  return [r / 255, g / 255, b / 255, 1];
}

function getMaterialByHexColor(hexColor: string): ObjectMaterial {
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

function makeTransformationMatrix(object: Readonly<SceneObject>) {
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

function makeTransformedVertex(
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

function flattenSceneObjects(
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

function getBoxCropUV({
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

function calcNormal(v0: Vector3Array, v1: Vector3Array, v2: Vector3Array) {
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

function convertBoxToQuads(box: BoxSceneObject): GLQuad[] {
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

function getCameraWorldPos(camera: Camera): Vector3Array {
  return [-camera.pos[0], -camera.pos[1], -camera.pos[2]];
}

function generateTransformMatrices({
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

export interface ServerRackViewProps {
  /**
   * The cabinet to draw, or `null` while it is still being loaded. The component draws what it is
   * given and never fetches: loading a rack is the caller's business, because only the caller
   * knows where a rack comes from.
   */
  readonly rack: Rack | null;
  /**
   * The caller's device types, keyed by the `deviceType` a {@link RackDevice} carries. A device
   * whose type is absent from the lookup is not drawn, so this is also how a caller leaves a
   * device type out of the drawing without editing the renderer.
   */
  readonly deviceTypes: DeviceTypeLookup;
  /**
   * The device to frame the camera on, or `undefined` to show the whole cabinet. Changing it
   * moves the camera; clearing it puts the camera back where it started.
   */
  readonly targetDevice?: RackDeviceRef & {
    readonly panel: RackPanelName;
    readonly row: number;
  };
  /**
   * Called with the device the operator clicked. The component does not navigate, open a panel or
   * report anything: what a click means belongs to the caller, which is why the built-in handler
   * in the original only logged a warning.
   */
  readonly onDeviceClick?: (device: RackDevice, panel: RackPanelName) => void;
  /**
   * The background behind the cabinet. A prop because a rack drawn on a black rectangle is one
   * look, and a consumer placing it on a page of its own may want another.
   */
  readonly backgroundColor?: string | undefined;
  /**
   * Draws the ray used to pick a device, plus a marker in the corner. A developer aid for working
   * out why a click misses, and off by default: it is switched on by whoever is debugging rather
   * than by a debug menu in the application around the library.
   */
  readonly showRayTrail?: boolean | undefined;
}

/**
 * Draws a server rack in WebGL, with the front and back panels and a draggable, zoomable camera.
 *
 * The renderer holds no application state: it draws the {@link ServerRackViewProps.rack} it is
 * given, labels devices from {@link ServerRackViewProps.deviceTypes}, and reports clicks through
 * {@link ServerRackViewProps.onDeviceClick}. It never loads a rack, picks a route, or decides what
 * a device is.
 */
export function ServerRackView({
  rack,
  deviceTypes,
  targetDevice,
  onDeviceClick,
  backgroundColor = '#101010',
  showRayTrail = false,
}: ServerRackViewProps) {
  const { t } = useLocale();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const minPosZ = -20;
  const closePosZ = -6;
  const maxPosZ = -2;

  const [posY, setPosY] = useState<number>(0);
  const [posZ, setPosZ] = useState<number>(minPosZ);
  const [rotationY, setRotationY] = useState<number>(0);

  const [manualRotationLocked, setManualRotationLocked] = useState(false);

  const [activePanel, setActivePanel] = useState<RackPanelName>('front');

  const panelButtonGroupItems: readonly {
    readonly id: RackPanelName;
    readonly title: string;
  }[] = [
    {
      id: 'front',
      title: t('ServerRack.panel.front'),
    },
    {
      id: 'back',
      title: t('ServerRack.panel.back'),
    },
  ];

  function changeRotationYSmoothly(targetRotationY: number) {
    let current = normalizeRadians(rotationY);
    const target = normalizeRadians(targetRotationY);
    const delta = cmp(target, current) * degreesToRadians(15);

    if (delta === 0) {
      return;
    }

    setManualRotationLocked(true);

    const timer = setInterval(() => {
      if ((delta > 0 && current >= target) || (delta < 0 && current <= target)) {
        setRotationY(target);
        setManualRotationLocked(false);
        clearInterval(timer);

        return;
      }

      current = current + delta;
      setRotationY(current);
    }, 50);
  }

  function changeActivePanel(panelId: RackPanelName) {
    if (manualRotationLocked) {
      return;
    }
    if (panelId === 'front') {
      changeRotationYSmoothly(0);
    } else {
      changeRotationYSmoothly(Math.PI);
    }
  }

  useEffect(() => {
    const deg = (rotationY * 180) / Math.PI;
    if (deg >= 95 && rotationY <= 200) {
      setActivePanel('back');
    } else {
      setActivePanel('front');
    }
  }, [rotationY]);

  useMouseDrag(canvasRef.current, ({ x, y }) => {
    if (Math.abs(y) > Math.abs(x * 2)) {
      setPosY((posY) => posY - Math.sign(y) * 0.1);
    } else if (!manualRotationLocked) {
      setRotationY((rotationY) =>
        modulo(rotationY + degreesToRadians(Math.sign(x) * 4), 2 * Math.PI),
      );
    }
  });

  useEventListener(
    'wheel',
    (event: WheelEvent) => {
      setPosZ((z) => clamp(z - Math.sign(event.deltaY) * 0.5, minPosZ, maxPosZ));
    },
    canvasRef.current,
  );

  const [rayTrail, setRayTrail] = useState<SceneObject[]>([]);

  const scene: Scene = {
    objects: rack
      ? [
          buildServerRackModel({
            serverRack: rack,
            targetDevice: rackHasDevice(rack, targetDevice) ? targetDevice : undefined,
            deviceTypes,
          }),
          ...rayTrail,
        ]
      : [],
  };

  const camera: Camera = {
    pos: [0, posY, posZ],
    scale: [1, 1, 1],
    rotation: [0, rotationY, 0],
  };

  useGranularEffect(
    () => {
      if (targetDevice === undefined) {
        return;
      }

      setPosZ(closePosZ);
      setPosY(-getRackShelfPosByRowIndex(targetDevice.row));
      changeActivePanel(targetDevice.panel);
    },
    [targetDevice?.panel, targetDevice?.row],
    [setPosZ, setPosY, changeActivePanel, closePosZ],
  );

  useGranularEffect(
    () => {
      if (targetDevice !== undefined) {
        return;
      }

      setPosZ(minPosZ);
      setPosY(0);
      changeActivePanel('front');
    },
    [targetDevice],
    [setPosZ, setPosY, changeActivePanel, closePosZ],
  );
  useEventListener(
    'click',
    (e: MouseEvent) => {
      function getClickedObject() {
        const canvasRect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();

        // Convert mouse pos to ray direction
        const mouseX = e.clientX - canvasRect.x;
        const mouseY = e.clientY - canvasRect.y;
        const viewportWidth = canvasRect.width;
        const viewportHeight = canvasRect.height;

        // Convert mouse coords to Normalized Device Coords
        const ndcX = lerpRange(0, viewportWidth, -1, 1, mouseX);
        const ndcY = lerpRange(0, viewportHeight, 1, -1, mouseY);

        // Convert Normalized Device Coords To Clip Coords
        const clipCoords: Vec4 = [ndcX, ndcY, -1, 1];

        const aspect = viewportWidth / viewportHeight;

        const transformMatrices = generateTransformMatrices({
          camera,
          aspect,
        });

        const invertedProjectionMatrix = glMat4Identity();
        glMat4Invert(invertedProjectionMatrix, transformMatrices.projectionMatrix);

        // Convert Clip Coordinates to Eye Coordinates
        const eyeCoords = glMat4MultiplyMatrixAndVector(
          [0, 0, 0, 0],
          invertedProjectionMatrix,
          clipCoords,
        );
        eyeCoords[2] = -1;
        eyeCoords[3] = 0;

        const rayDirection = new Vector3D(eyeCoords[0], eyeCoords[1], -1).normalize();

        const flatObjects = flattenSceneObjects(scene.objects);

        interface CheckedBox {
          box: BoxSceneObject;
          invertedBoxTransformMatrix: Mat4 | null;
        }

        const checkedBoxes: CheckedBox[] = [];
        for (const object of flatObjects) {
          if (object.type !== 'box' || object.tag === 'ray') {
            continue;
          }
          checkedBoxes.push({
            box: object,
            invertedBoxTransformMatrix: glMat4Invert(
              glMat4Identity(),
              makeTransformationMatrix(object),
            ),
          });
        }

        const rayStartPos = getCameraWorldPos(camera);
        const maxRayLength = 50;
        const rayLengthDelta = 0.125;

        let rayTrail: SceneObject[] = [];

        const clickedObject = naiveRaycast({
          rayStartPos: rayStartPos,
          maxRayLength,
          rayLengthDelta,
          rayDirection,
          camera,
          stepAction(currentPos) {
            if (showRayTrail) {
              let materialColor = '#0000ff';
              if (rayTrail.length === 0) {
                materialColor = '#ffff00';
              }
              const rayBox: SceneObject = {
                type: 'box',
                tag: 'ray',
                pos: currentPos,
                scale: [1 / 16, 1 / 16, 1 / 16],
                material: getMaterialByHexColor(materialColor),
              };

              rayTrail = [...rayTrail, rayBox];
            }

            for (const boxInfo of checkedBoxes) {
              const { box, invertedBoxTransformMatrix } = boxInfo;

              if (
                invertedBoxTransformMatrix !== null &&
                isPointInsideBox(currentPos, invertedBoxTransformMatrix)
              ) {
                return box;
              }
            }

            return null;
          },
        });

        if (showRayTrail) {
          setRayTrail(rayTrail);
        }

        return clickedObject;
      }

      const clickedObject = getClickedObject();

      if (
        clickedObject === null ||
        clickedObject.type !== 'box' ||
        !isRackDeviceTag(clickedObject.tag)
      ) {
        return;
      }

      const { device, rackPanelName } = clickedObject.tag;

      onDeviceClick?.(device, rackPanelName);
    },
    canvasRef.current,
  );

  return (
    <div
      className="relative flex w-full flex-grow flex-col items-center"
      style={{ backgroundColor }}
    >
      {showRayTrail && <div className="fixed left-0 top-0 size-10 bg-red-500" />}
      <div className="w-full flex-grow">
        <WebGLRenderer canvasRef={canvasRef} scene={scene} camera={camera} />
      </div>
      <ButtonGroup
        className="absolute top-4"
        itemId={activePanel}
        items={panelButtonGroupItems}
        onItemChange={changeActivePanel}
      />
    </div>
  );
}

/**
 * Whether `target` names a device that is actually in `rack`.
 *
 * The camera framing is driven by whatever the caller passes, and a target that is not in the rack
 * being drawn — a stale selection, a device that has been removed — has no row to frame, so nothing
 * is highlighted and the camera stays where the operator put it.
 */
function rackHasDevice(rack: Rack, target: ServerRackViewProps['targetDevice']): boolean {
  if (target === undefined) {
    return false;
  }

  const { frontPanel, backPanel } = rack;

  return [...frontPanel.devices, ...backPanel.devices].some(
    (device) =>
      device.deviceType === target.deviceType && device.serialNumber === target.serialNumber,
  );
}

function WebGLRenderer({
  canvasRef,
  scene,
  camera,
}: {
  readonly canvasRef: React.RefObject<HTMLCanvasElement | null>;
  readonly scene: Scene;
  readonly camera: Camera;
}) {
  return (
    <AutoSizer
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        flexGrow: 1,
      }}
    >
      {({
        width,
        height,
      }: {
        readonly width: number;
        readonly height: number;
      }): React.ReactNode => (
        <Canvas canvasRef={canvasRef} width={width} height={height} scene={scene} camera={camera} />
      )}
    </AutoSizer>
  );
}

function Canvas({
  canvasRef,
  width,
  height,
  scene,
  camera,
}: {
  readonly canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  readonly width: number;
  readonly height: number;
  readonly scene: Scene;
  readonly camera: Camera;
}) {
  const context = useGLCtx(canvasRef.current);

  const [sceneCtx, setSceneCtx] = useState<SceneRenderContext | null>(null);

  // Build the objects to be drawn
  useGranularEffect(
    () => {
      if (!context) {
        return undefined;
      }

      const { gl } = context;

      setSceneCtx(createSceneRenderContext(scene, gl));

      return () => {
        if (sceneCtx) {
          deleteSceneCtx(sceneCtx, gl);
        }
      };
    },
    [context, scene],
    [sceneCtx],
  );

  useGranularEffect(
    () => {
      if (context === null || sceneCtx === null) {
        return;
      }

      renderScene(context.gl, context.programInfo, sceneCtx, camera);
    },
    [context, sceneCtx, width, height, camera],
    [],
  );

  return <canvas ref={canvasRef} width={width} height={height} className="h-full w-full" />;
}

function useGLCtx(canvas: HTMLCanvasElement | null) {
  const [context, setContext] = useState<{
    gl: WebGLRenderingContext;
    programInfo: ProgramInfo;
  } | null>(null);

  useEffect(() => {
    if (!canvas) {
      return undefined;
    }

    // Initialize the GL context
    const gl = canvas.getContext('webgl');

    if (!gl) {
      console.error('Unable to initialize WebGL');
      return undefined;
    }

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Initialize a shader program; this is where all the lighting
    // for the vertices and so forth is established.
    const shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);

    if (!shaderProgram) {
      return undefined;
    }

    // Collect all the info needed to use the shader program.
    // Look up which attributes our shader program is using
    // for aVertexPosition, aVertexColor and also
    // look up uniform locations.
    const programInfo: ProgramInfo = {
      program: shaderProgram,
      attribLocations: {
        vertexPos: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        vertexTextureCoord: gl.getAttribLocation(shaderProgram, 'aVertexTextureCoord'),
        vertexNormal: gl.getAttribLocation(shaderProgram, 'aVertexNormal'),
        vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
        vertexColorModulator: gl.getAttribLocation(shaderProgram, 'aVertexColorModulator'),
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        cameraPos: gl.getUniformLocation(shaderProgram, 'uCameraPosition'),
        texture: gl.getUniformLocation(shaderProgram, 'uTexture'),
      },
    };

    setContext({ gl, programInfo });

    return () => {
      // biome-ignore lint/correctness/useHookAtTopLevel: `gl` is a WebGL context, not a React component. `useProgram` is WebGL's.
      gl.useProgram(null);
      gl.deleteProgram(shaderProgram);
    };
  }, [canvas]);

  return context;
}

function renderScene(
  gl: WebGLRenderingContext,
  programInfo: ProgramInfo,
  sceneCtx: SceneRenderContext,
  camera: Camera,
) {
  gl.clearColor(0, 0, 0, 1);
  gl.clearDepth(1);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);

  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Near things obscure far things
  gl.depthFunc(gl.LEQUAL);

  // Clear the canvas before drawing on it
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const { modelViewMatrix, projectionMatrix } = generateTransformMatrices({
    camera,
    aspect: gl.canvas.width / gl.canvas.height,
  });

  // Tell OpenGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute.
  setPosAttribute(gl, sceneCtx, programInfo);
  setTextureCoordAttribute(gl, sceneCtx, programInfo);
  setNormalAttribute(gl, sceneCtx, programInfo);
  setColorAttribute(gl, sceneCtx, programInfo);
  setColorModulatorAttribute(gl, sceneCtx, programInfo);

  // Tell OpenGL which indices to use to index the vertices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sceneCtx.buffers.indices);

  // Tell OpenGL to use our program when drawing
  // biome-ignore lint/correctness/useHookAtTopLevel: `gl` is a WebGL context, not a React component. `useProgram` is WebGL's.
  gl.useProgram(programInfo.program);

  // Set the shader uniforms
  gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);
  gl.uniform3fv(programInfo.uniformLocations.cameraPos, new Float32Array(camera.pos));

  if (sceneCtx.fontRenderInfo !== null) {
    // Bind the texture to texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneCtx.fontRenderInfo.texture);

    // Set the uniform to use texture unit 0
    gl.uniform1i(programInfo.uniformLocations.texture, 0);
  }

  const { vertexCount } = sceneCtx;
  const type = gl.UNSIGNED_SHORT;
  const offset = 0;

  gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
}

// Tell OpenGL how to pull out the positions from the position
// buffer into the vertexPosition attribute.
function setPosAttribute(
  gl: WebGLRenderingContext,
  sceneCtx: SceneRenderContext,
  programInfo: ProgramInfo,
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, sceneCtx.buffers.pos);
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexPos,
    3, // components
    gl.FLOAT, // type
    false, // normalize
    0, // stride
    0, // offset
  );
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPos);
}

function setTextureCoordAttribute(
  gl: WebGLRenderingContext,
  sceneCtx: SceneRenderContext,
  programInfo: ProgramInfo,
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, sceneCtx.buffers.textureCoord);
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexTextureCoord,
    2, // components
    gl.FLOAT, // type
    false, // normalize
    0, // stride
    0, // offset
  );
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexTextureCoord);
}

// Tell OpenGL how to pull out the normals from the normal buffer
// into the vertexNormal attribute.
function setNormalAttribute(
  gl: WebGLRenderingContext,
  sceneCtx: SceneRenderContext,
  programInfo: ProgramInfo,
) {
  const components = 3;
  const type = gl.FLOAT;
  const normalize = false;

  // How many bytes to get from one set of values to the next
  // 0 = use type and numComponents above
  const stride = 0;

  // How many bytes inside the buffer to start from
  const offset = 0;

  gl.bindBuffer(gl.ARRAY_BUFFER, sceneCtx.buffers.normal);

  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexNormal,
    components,
    type,
    normalize,
    stride,
    offset,
  );

  gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);
}

// Tell OpenGL how to pull out the colors from the color buffer
// into the vertexColor attribute.
function setColorAttribute(
  gl: WebGLRenderingContext,
  sceneCtx: SceneRenderContext,
  programInfo: ProgramInfo,
) {
  const components = 4;
  const type = gl.FLOAT;
  const normalize = false;
  const stride = 0;
  const offset = 0;

  gl.bindBuffer(gl.ARRAY_BUFFER, sceneCtx.buffers.color);

  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexColor,
    components,
    type,
    normalize,
    stride,
    offset,
  );

  gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
}

// Tell OpenGL how to pull out the color modulator from the color buffer
// into the vertexColorModulator attribute.
function setColorModulatorAttribute(
  gl: WebGLRenderingContext,
  sceneCtx: SceneRenderContext,
  programInfo: ProgramInfo,
) {
  const components = 4;
  const type = gl.FLOAT;
  const normalize = false;
  const stride = 0;
  const offset = 0;

  gl.bindBuffer(gl.ARRAY_BUFFER, sceneCtx.buffers.colorModulator);

  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexColorModulator,
    components,
    type,
    normalize,
    stride,
    offset,
  );

  gl.enableVertexAttribArray(programInfo.attribLocations.vertexColorModulator);
}

// Initialize a shader program, so OpenGL knows how to draw our data
function initShaderProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  if (!vertexShader || !fragmentShader) {
    return null;
  }

  // Create the shader program
  const shaderProgram = gl.createProgram();

  if (shaderProgram === null) {
    console.error("Couldn't create the shader program");
    return null;
  }

  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error(`Couldn't initialize the shader program: ${gl.getProgramInfoLog(shaderProgram)}`);
    return null;
  }

  return shaderProgram;
}

// Create a shader of the given type, upload its source and compile it
function loadShader(gl: WebGLRenderingContext, type: GLenum, source: string) {
  const shader = gl.createShader(type);

  if (!shader) {
    console.error('An error occurred creating shader');
    return null;
  }

  // Send the source to the shader object
  gl.shaderSource(shader, source);

  // Compile the shader program
  gl.compileShader(shader);

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createSceneRenderContext(scene: Scene, gl: WebGLRenderingContext): SceneRenderContext {
  const objs = flattenSceneObjects(scene.objects);

  let quads: GLQuad[] = [];

  const textObjs: TextSceneObject[] = [];
  const usedChars = new Set<string>();

  for (const object of objs) {
    if (object.type === 'box') {
      quads = [...quads, ...convertBoxToQuads(object)];
    } else if (object.type === 'text') {
      const chars = object.text.replace(/\s+/g, '');
      for (const c of chars) {
        usedChars.add(c);
      }
      textObjs.push(object);
    }
  }

  function createPosBuf() {
    const poses = quads.map((q) => [q.bottomLeft, q.bottomRight, q.topRight, q.topLeft]).flat(2);

    const posBuf = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(poses), gl.STATIC_DRAW);

    return posBuf;
  }

  function createTextureCoordBuffer() {
    const textureCoords = quads
      .map(
        (q) =>
          q.uv ?? [
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
          ],
      )
      .flat(2);

    const texCoordBuf = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuf);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);

    return texCoordBuf;
  }

  function createNormalBuffer() {
    const normals = quads
      .map((q) => {
        const n = calcNormal(q.bottomLeft, q.bottomRight, q.topRight);
        return [n, n, n, n];
      })
      .flat(2);

    const normBuf = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    return normBuf;
  }

  function createColorBuf() {
    const colors = quads
      .map((q) => [
        q.bottomLeftColor ?? [0, 0, 0, 0],
        q.bottomRightColor ?? [0, 0, 0, 0],
        q.topRightColor ?? [0, 0, 0, 0],
        q.topLeftColor ?? [0, 0, 0, 0],
      ])
      .flat(2);

    const colorBuf = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    return colorBuf;
  }

  function createColorModBuf() {
    const colors = quads
      .map((q) => {
        const m = q.modulator ?? [1, 1, 1, 1];
        return [m, m, m, m];
      })
      .flat(2);

    const colorModBuf = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, colorModBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    return colorModBuf;
  }

  function createIndexBuf() {
    // This array defines each quad as two triangles, using the
    // indices into the vertex array to specify each triangle's
    // position.
    const indices = quads
      .map((_, quadIndex) => {
        const quadVertices = 4;
        const offset = quadIndex * quadVertices;

        return [
          // First triangle
          offset + 0,
          offset + 1,
          offset + 2,

          // Second triangle
          offset + 0,
          offset + 2,
          offset + 3,
        ];
      })
      .flat(2);

    const indexBuf = gl.createBuffer();

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return indexBuf;
  }

  function createFontRenderInfo(usedChars: string[]) {
    if (usedChars.length === 0) {
      return null;
    }

    const fontSize = 24;
    const fontName = 'Arial';

    // Without vertical tolerance, diacritic characters or
    // the characters with bottom tails are displayed cut off
    const toleranceY = 4;

    const atlas = createFontAtlas();

    if (atlas === null) {
      return null;
    }

    const { texture, atlasWidth, atlasHeight, characterMap } = atlas;

    return {
      texture,
      characterMap,
      fontSize,
      atlasWidth,
      atlasHeight,
      toleranceY,
    };

    function determineFontAtlasSize() {
      let cols = 0;
      let rows = 0;
      let atlasSize = 1;

      const charH = fontSize + toleranceY;

      const maxAtlasSize = Math.max(2 ** 12, gl.getParameter(gl.MAX_TEXTURE_SIZE));

      while (atlasSize <= maxAtlasSize) {
        cols = Math.trunc(atlasSize / fontSize);
        rows = Math.trunc(atlasSize / charH);

        if (cols * rows >= usedChars.length) {
          break;
        }

        atlasSize = atlasSize * 2;
      }

      if (cols * rows < usedChars.length) {
        console.error(
          `Could not allocate texture atlas for text. Character set size (${usedChars.length}) or font size (${fontSize}) is too large. Multiple texture atlases are not supported yet.`,
        );
        return null;
      }

      return { atlasSize, rows, cols };
    }

    function renderChars(ctx: CanvasRenderingContext2D, rows: number, cols: number) {
      const charMap: FontCharacterMap = {};

      const handledChars = new Set<string>();

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const c = usedChars[col + row * cols];

          if (c === undefined) {
            return charMap;
          }

          const x = col * fontSize;
          const y = row * fontSize + (row + 1) * toleranceY;

          ctx.fillText(c, x, y);

          const { width } = ctx.measureText(c);

          charMap[c] = {
            textureCoordX: x,
            textureCoordY: y,
            width,
          };

          handledChars.add(c);
        }
      }

      if (handledChars.size !== usedChars.length) {
        console.error('Could not add all used characters to font atlas', {
          added: handledChars,
          all: usedChars,
        });
      }

      return charMap;
    }

    function createFontAtlas() {
      const sizeResult = determineFontAtlasSize();

      if (sizeResult === null) {
        return null;
      }

      const { atlasSize, rows, cols } = sizeResult;

      const canvas2D = document.createElement('canvas');

      canvas2D.width = atlasSize;
      canvas2D.height = atlasSize;

      const ctx = canvas2D.getContext('2d');

      if (ctx === null) {
        canvas2D.remove();
        return null;
      }

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      ctx.font = `${fontSize}px ${fontName}`;
      ctx.textBaseline = 'top';

      const characterMap = renderChars(ctx, rows, cols);

      const imageData = ctx.getImageData(0, 0, atlasSize, atlasSize);

      canvas2D.remove();

      const texture = gl.createTexture();

      if (texture === null) {
        return null;
      }

      gl.bindTexture(gl.TEXTURE_2D, texture);

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
      gl.generateMipmap(gl.TEXTURE_2D);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      return {
        texture,
        atlasWidth: atlasSize,
        atlasHeight: atlasSize,
        characterMap,
      };
    }
  }

  function renderTextObject(object: TextSceneObject) {
    if (!fontRenderInfo) {
      return;
    }

    const pos = object.pos ?? [0, 0, 0];
    const scale = object.scale ?? [1, 1, 1];
    const rot = object.rotation ?? [0, 0, 0];
    const { text, color } = object;

    const { characterMap, fontSize, toleranceY, atlasWidth, atlasHeight } = fontRenderInfo;

    const charSpacing = 0;
    const spaceW = fontSize / 4;

    const t = {
      xRotCos: Math.cos(rot[0]),
      xRotSin: Math.sin(rot[0]),
      yRotCos: Math.cos(rot[1]),
      yRotSin: Math.sin(rot[1]),
      zRotCos: Math.cos(rot[2]),
      zRotSin: Math.sin(rot[2]),
      pos,
      scale,
    };

    let x = 0;
    let y = 0;

    for (const c of text) {
      if (c === '\n') {
        x = 0;
        y--;
        continue;
      }

      const characterInfo = characterMap[c];

      let width = spaceW;
      if (characterInfo !== undefined) {
        width = characterInfo.width;
      }

      const characterWidthRatio = width / fontSize;
      const sizeX = scale[0] * characterWidthRatio;

      x += sizeX;

      if (characterInfo !== undefined) {
        const quadScale: Vector3Array = [sizeX, scale[1], scale[2]];
        const quadPos = makeTransformedVertex(x, y, 0, {
          ...t,
          scale: [1, 1, 1],
          pos,
        });

        const qt = { ...t, pos: quadPos, scale: quadScale };

        quads.push({
          bottomLeft: makeTransformedVertex(-1, -1, 0, qt),
          bottomRight: makeTransformedVertex(1, -1, 0, qt),
          topRight: makeTransformedVertex(1, 1, 0, qt),
          topLeft: makeTransformedVertex(-1, 1, 0, qt),
          modulator: color ?? [1, 1, 1, 1],
          uv: getBoxCropUV({
            cropX: characterInfo.textureCoordX,
            cropY: characterInfo.textureCoordY - toleranceY,
            cropWidth: width,
            cropHeight: fontSize + toleranceY,
            atlasWidth,
            atlasHeight,
            faceName: 'front',
          }),
        });
      }

      x += sizeX + (charSpacing / fontSize) * scale[0] * 2;
    }
  }

  const fontRenderInfo = createFontRenderInfo([...usedChars]);

  for (const object of textObjs) {
    renderTextObject(object);
  }

  const quadTriangles = 2;
  const totalTriangles = quads.length * quadTriangles;

  const triangleVertices = 3;
  const vertexCount = totalTriangles * triangleVertices;

  return {
    buffers: {
      pos: createPosBuf(),
      textureCoord: createTextureCoordBuffer(),
      normal: createNormalBuffer(),
      color: createColorBuf(),
      colorModulator: createColorModBuf(),
      indices: createIndexBuf(),
    },
    vertexCount,
    fontRenderInfo,
  };
}

function deleteSceneCtx(sceneCtx: SceneRenderContext, gl: WebGLRenderingContext) {
  if (sceneCtx.buffers.pos) {
    gl.deleteBuffer(sceneCtx.buffers.pos);
    sceneCtx.buffers.pos = null;
  }
  if (sceneCtx.buffers.textureCoord) {
    gl.deleteBuffer(sceneCtx.buffers.textureCoord);
    sceneCtx.buffers.textureCoord = null;
  }
  if (sceneCtx.buffers.normal) {
    gl.deleteBuffer(sceneCtx.buffers.normal);
    sceneCtx.buffers.normal = null;
  }
  if (sceneCtx.buffers.indices) {
    gl.deleteBuffer(sceneCtx.buffers.indices);
    sceneCtx.buffers.indices = null;
  }
  if (sceneCtx.buffers.color) {
    gl.deleteBuffer(sceneCtx.buffers.color);
    sceneCtx.buffers.color = null;
  }
  if (sceneCtx.buffers.colorModulator) {
    gl.deleteBuffer(sceneCtx.buffers.colorModulator);
    sceneCtx.buffers.colorModulator = null;
  }
  if (sceneCtx.fontRenderInfo !== null) {
    gl.deleteTexture(sceneCtx.fontRenderInfo.texture);
    sceneCtx.fontRenderInfo = null;
  }
}

interface RackDeviceInfo {
  rackId: string;
  posLabel: string;
  rackDeviceType: string;
  rackDeviceSerialNumber: number;
}

interface PosLabelTableCellInfo {
  posLabel: string;
}

export interface ServerRackEditorProps {
  /**
   * Recognises the columns of a device database, so the editor can offer automatic detection
   * instead of asking the operator to map every column by hand. Without it the editor only reads
   * databases whose columns the operator has named themselves.
   */
  readonly columns?: RackDatabaseColumns | undefined;
  /**
   * Ready-made column mappings the operator can pick from, for the exports a caller knows about.
   * A template is a suggestion: whatever the operator has typed wins.
   */
  readonly aliasMapTemplates?: readonly RackDeviceAliasMap[] | undefined;
  /**
   * The name the editor offers for a downloaded rack configuration. A prop because the file name
   * ends up in the operator's downloads folder and the convention is the caller's.
   */
  readonly configFilename?: string | undefined;
}

/**
 * Edits the device database behind a rack: the two position-label tables, the list of devices read
 * from them, and the import of a CSV database.
 *
 * What the columns are called, and which column is which, belongs to whoever produces the database.
 * This editor takes that as {@link ServerRackEditorProps.columns} and
 * {@link ServerRackEditorProps.aliasMapTemplates} and does not guess otherwise.
 */
export function SeverRackEditor({
  columns,
  aliasMapTemplates = [],
  configFilename = 'rack_config.json',
}: ServerRackEditorProps = {}) {
  const { t } = useLocale();

  const [frontPosLabelTableRows, setFrontPosLabelTableRows] = useState<PosLabelTableCellInfo[][]>(
    newPosLabelTable(),
  );
  const [backPosLabelTableRows, setBackPosLabelTableRows] = useState<PosLabelTableCellInfo[][]>(
    newPosLabelTable(),
  );

  const [rackDevices, setRackDevices] = useState<RackDeviceInfo[]>([]);

  const [curConfigFilename, setCurConfigFilename] = useState(configFilename);

  const [rackId, setRackId] = useState('');

  const [rackPanel, setRackPanel] = useState<RackPanelName>('front');

  const [csvDBFilename, setCSVDBFilename] = useState('');

  const [importDBModalOpen, setImportDBModalOpen] = useState(false);

  // IMPORTANT: Assume valid CSV content, i.e., no validation
  function loadCSVDB(csv: string, dbFieldAliasMap: RackDeviceAliasMap | null) {
    const rows = parseCSV(csv);

    const parsedRecords = parseRows(rows, {
      databaseFieldAliasMap: dbFieldAliasMap,
      columns: columns ?? noDatabaseColumns,
    });

    const sortedRecords = parsedRecords.toSorted(
      (a, b) =>
        cmp(a.rackId, b.rackId) ||
        naturalCmp(a.posLabel, b.posLabel) ||
        cmp(a.rackDeviceType, b.rackDeviceType) ||
        cmp(a.rackDeviceSerialNumber, b.rackDeviceSerialNumber),
    );

    const uniqueRecords = removeDuplicateObjectsFromArray(sortedRecords);

    setRackDevices(uniqueRecords);
  }

  // IMPORTANT: Assume valid data, no validation
  function onLoadConfig() {
    openFileDialog(
      async (file) => {
        const data = JSON.parse(await file.text());
        setCurConfigFilename(file.name);
        setRackId((data.rackId ?? '').toString());
        setFrontPosLabelTableRows(data.frontPosLabelTableRows);
        setBackPosLabelTableRows(data.backPosLabelTableRows);
        setRackDevices(data.rackDevices);
        setCSVDBFilename((data.csvDatabaseFilename ?? '').toString());
      },
      { accept: '.json' },
    );
  }

  function onSaveConfig() {
    const data = {
      rackId,
      frontPosLabelTableRows,
      backPosLabelTableRows,
      rackDevices,
      csvDatabaseFilename: csvDBFilename,
    };

    const json = JSON.stringify(data);

    downloadStringAsPlainTextFile(curConfigFilename, json);
  }

  async function onImportCsvDatabase({
    databaseFile,
    databaseFieldAliasMap,
  }: {
    readonly databaseFile: File;
    readonly databaseFieldAliasMap: RackDeviceAliasMap | null;
  }) {
    const csv = await databaseFile.text();

    setCSVDBFilename(databaseFile.name);
    loadCSVDB(csv, databaseFieldAliasMap);
  }

  function onImportDB() {
    setImportDBModalOpen(true);
  }

  const rackDevicesByPosLabelMap = groupArrayByProperty(rackDevices, (d) => d.posLabel);

  const labels = [
    ...frontPosLabelTableRows
      .map((row) => row.map((column) => column.posLabel).filter((label) => label !== ''))
      .flat(2),

    ...backPosLabelTableRows
      .map((row) => row.map((column) => column.posLabel).filter((label) => label !== ''))
      .flat(2),
  ];

  const usedPosLabels = new Set(labels);

  const posLabelCountMap = getListAsCountMap(labels, (item) => item);

  return (
    <div className="box-border flex h-screen w-screen flex-col gap-2 overflow-auto p-2">
      <div className="flex shrink-0 gap-2">
        <div className="bg-bpd flex flex-grow items-center gap-2 overflow-hidden rounded-lg p-2">
          <div className="truncate" title={curConfigFilename}>
            {curConfigFilename}
          </div>
          <IconButton
            icon="upload"
            iconClassName="size-5 fill-tpd"
            className="rounded-full p-2"
            bgClassName="hover:bg-bse"
            rippleColor="var(--color-ripple-icon-button)"
            title={t('RackDatabaseEditor.loadConfig')}
            onClick={onLoadConfig}
          />
          <IconButton
            icon="save"
            iconClassName="size-5 fill-tpd"
            className="rounded-full p-2"
            bgClassName="hover:bg-bse"
            rippleColor="var(--color-ripple-icon-button)"
            title={t('RackDatabaseEditor.saveConfig')}
            onClick={onSaveConfig}
          />
          <IconButton
            icon="server"
            iconClassName="size-5 fill-tpd"
            className="rounded-full p-2"
            bgClassName="hover:bg-bse"
            rippleColor="var(--color-ripple-icon-button)"
            title={t('RackDatabaseEditor.exportConfig')}
            onClick={() => {
              const filename = `${rackId}.json`;

              const frontSize = getPosLabelTableSize(frontPosLabelTableRows);
              const backSize = getPosLabelTableSize(backPosLabelTableRows);

              function getFlatPanel(tableRows: readonly PosLabelTableCellInfo[][]) {
                const { rows, columns } = getPosLabelTableSize(tableRows);

                const devices: {
                  row: number;
                  col: number;
                  pos: string;
                  type: string;
                  sn: number;
                }[] = [];

                for (let row = 0; row < rows; row++) {
                  for (let col = 0; col < columns; col++) {
                    const cell = tableRows[row]?.[col];

                    if (cell === undefined) {
                      continue;
                    }

                    const device = rackDevicesByPosLabelMap[cell.posLabel]?.[0];

                    if (device === undefined) {
                      continue;
                    }

                    const pos = cell.posLabel;

                    const type = device.rackDeviceType;
                    const sn = device.rackDeviceSerialNumber;

                    devices.push({ row, col, pos, type, sn });
                  }
                }

                return devices;
              }

              const json = JSON.stringify({
                GetServerRack: rackId,
                frontPanelRowCount: frontSize.rows,
                frontPanelColumnCount: frontSize.columns,
                backPanelRowCount: backSize.rows,
                backPanelColumnCount: backSize.columns,
                frontPanel: getFlatPanel(frontPosLabelTableRows),
                backPanel: getFlatPanel(backPosLabelTableRows),
              });

              downloadStringAsPlainTextFile(filename, json);
            }}
          />
        </div>
        <div className="bg-bpd flex shrink-0 items-center gap-2 rounded-lg p-2">
          <TextInput
            placeholder={t('RackDatabaseEditor.rackId')}
            value={rackId}
            onChange={(e) => setRackId(e.currentTarget.value)}
            onClearClick={() => setRackId('')}
            spellCheck={false}
          />
        </div>
        <div className="bg-bpd flex shrink-0 gap-2 rounded-lg p-2">
          <Button title={t('RackDatabaseEditor.importDatabase')} onClick={onImportDB} />
        </div>
      </div>
      <div className="flex flex-grow gap-2 overflow-hidden">
        <div className="bg-bpd flex flex-grow flex-col gap-2 overflow-hidden rounded-lg">
          <div className="mt-4 flex shrink-0 justify-center">
            <ButtonGroup
              itemId={rackPanel}
              items={[
                { id: 'front', title: t('ServerRack.panel.front') },
                { id: 'back', title: t('ServerRack.panel.back') },
              ]}
              onItemChange={setRackPanel}
            />
          </div>
          {rackPanel === 'front' ? (
            <PosLabelTable
              key="front"
              rows={frontPosLabelTableRows}
              setRows={setFrontPosLabelTableRows}
              posLabelCountMap={posLabelCountMap}
              rackDevicesByPosLabelMap={rackDevicesByPosLabelMap}
            />
          ) : (
            <PosLabelTable
              key="back"
              rows={backPosLabelTableRows}
              setRows={setBackPosLabelTableRows}
              posLabelCountMap={posLabelCountMap}
              rackDevicesByPosLabelMap={rackDevicesByPosLabelMap}
            />
          )}
        </div>
        <div className="bg-bpd flex w-[450px] shrink-0 flex-col overflow-hidden rounded-lg">
          <div className="shrink-0 p-2 text-center">
            {t('RackDatabaseEditor.databaseDevices', {
              count: rackDevices.length,
            })}
          </div>
          {csvDBFilename !== '' && (
            <div className="border-b-bsp shrink-0 truncate border-b-2 p-2" title={csvDBFilename}>
              <span className="font-bold">{t('RackDatabaseEditor.database')}</span>
              {csvDBFilename}
            </div>
          )}
          <div className="bg-bpd grid grid-cols-[repeat(4,auto)] gap-2 overflow-auto p-4">
            {rackDevices.map((rackDevice) => {
              const { posLabel, rackDeviceType, rackDeviceSerialNumber, rackId } = rackDevice;

              const title = t('RackDatabaseEditor.deviceRow', {
                posLabel,
                rackDeviceType,
                serialNumber: rackDeviceSerialNumber,
                rackId,
              });

              return (
                <div
                  key={JSON.stringify(rackDevice)}
                  className={`
              contents
              ${usedPosLabels.has(posLabel) ? 'text-tpd' : 'text-tpl'}
            `}
                  title={title}
                >
                  <div>{posLabel}</div>
                  <div>{rackDeviceType}</div>
                  <div>S/N {rackDeviceSerialNumber}</div>
                  {rackId !== '' ? (
                    <div>{t('RackDatabaseEditor.rackOf', { rackId })}</div>
                  ) : (
                    <div />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <ImportDatabaseModal
        open={importDBModalOpen}
        onOpenChange={setImportDBModalOpen}
        onImport={onImportCsvDatabase}
        aliasMapTemplates={aliasMapTemplates}
        templateLabel={(index) => t('RackDatabaseEditor.template', { index })}
      />
    </div>
  );
}

/**
 * Recognises the CSV columns of a device database.
 *
 * The header names in a device database belong to whoever produces the export, so guessing them is
 * the caller's decision: a predicate per field, given the normalised header as it appears in the
 * file. A field whose predicate never matches is simply not read, which is how a caller says a
 * database has no such column rather than this module guessing one.
 */
export interface RackDatabaseColumns {
  readonly matchRackId: (header: string) => boolean;
  readonly matchPosLabel: (header: string) => boolean;
  readonly matchDeviceType: (header: string) => boolean;
  readonly matchSerialNumber: (header: string) => boolean;
}

/** The detection used when the caller supplies no {@link RackDatabaseColumns}: match nothing. */
const noDatabaseColumns: RackDatabaseColumns = {
  matchRackId: () => false,
  matchPosLabel: () => false,
  matchDeviceType: () => false,
  matchSerialNumber: () => false,
};

function normalizeProp(property: string) {
  return property.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeVal(value: unknown) {
  return (value ?? '').toString().trim().replace(/\s+/g, ' ');
}

function parseRows(
  rows: readonly string[][],
  {
    databaseFieldAliasMap,
    columns,
  }: {
    readonly databaseFieldAliasMap: RackDeviceAliasMap | null;
    readonly columns: RackDatabaseColumns;
  },
) {
  const records = convertCsvRowsToObjectRecords(rows).map((record) =>
    Object.fromEntries(
      Object.entries(record).map(([key, value]) => [normalizeProp(key), normalizeVal(value)]),
    ),
  );

  const isAutoDetection = databaseFieldAliasMap === null;

  const rackIdAlias = normalizeProp(databaseFieldAliasMap?.rackIdAlias ?? '');
  const posLabelAlias = normalizeProp(databaseFieldAliasMap?.posLabelAlias ?? '');
  const rackDeviceTypeAlias = normalizeProp(databaseFieldAliasMap?.rackDeviceTypeAlias ?? '');
  const rackDeviceSerialNumberAlias = normalizeProp(
    databaseFieldAliasMap?.rackDeviceSerialNumberAlias ?? '',
  );

  const validRecords: RackDeviceInfo[] = [];

  for (const record of records) {
    let rackIdFieldName = rackIdAlias;
    let posLabelFiledName = posLabelAlias;
    let rackDeviceTypeFieldName = rackDeviceTypeAlias;
    let rackDeviceSerialNumberFieldName = rackDeviceSerialNumberAlias;

    if (isAutoDetection) {
      rackIdFieldName = Object.keys(record).filter(columns.matchRackId)[0] ?? '';
      posLabelFiledName = Object.keys(record).filter(columns.matchPosLabel)[0] ?? '';
      rackDeviceTypeFieldName = Object.keys(record).filter(columns.matchDeviceType)[0] ?? '';
      rackDeviceSerialNumberFieldName =
        Object.keys(record).filter(columns.matchSerialNumber)[0] ?? '';
    }

    if (posLabelFiledName === undefined || rackDeviceTypeFieldName === undefined) {
      continue;
    }

    const parsedRecord = {
      rackId: record[rackIdFieldName] ?? '',
      posLabel: record[posLabelFiledName] ?? '',
      rackDeviceType: record[rackDeviceTypeFieldName] ?? '',
      rackDeviceSerialNumber:
        record[rackDeviceSerialNumberFieldName] !== undefined
          ? Number(record[rackDeviceSerialNumberFieldName]) || 0
          : 0,
    };

    if (
      parsedRecord.posLabel === '' ||
      parsedRecord.posLabel === '-' ||
      parsedRecord.rackDeviceType === '' ||
      parsedRecord.rackDeviceType === '-'
    ) {
      continue;
    }

    validRecords.push(parsedRecord);
  }

  return validRecords;
}

function convertCsvRowsToObjectRecords(rows: readonly string[][]) {
  let records: Record<string, string>[] = [];

  const [headerRow] = rows;

  if (!headerRow) {
    return [];
  }

  const bodyRows = rows.slice(1);

  for (const row of bodyRows) {
    const record: Record<string, string> = {};

    for (const [columnIndex, value] of row.entries()) {
      const property = headerRow[columnIndex];

      // A row longer than its header carries a cell with no property to record it under.
      if (property === undefined) {
        continue;
      }

      record[property] = value;
    }

    records = [...records, record];
  }

  return records;
}

interface RackDeviceAliasMap {
  rackIdAlias: string;
  posLabelAlias: string;
  rackDeviceTypeAlias: string;
  rackDeviceSerialNumberAlias: string;
}

function ImportDatabaseModal({
  open,
  onOpenChange,
  onImport,
  aliasMapTemplates,
  templateLabel,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * Ready-made column mappings to offer. Empty means the operator names every column, which is
   * the right default for a database whose headers this module has never seen.
   */
  readonly aliasMapTemplates: readonly RackDeviceAliasMap[];
  /**
   * Names the mapping chooser, and numbers the entries: a template is shown as
   * `${templateLabel(index + 1)}`.
   */
  readonly templateLabel: (index: number) => string;
  readonly onImport: ({
    databaseFile,
    databaseFieldAliasMap,
  }: {
    readonly databaseFile: File;
    readonly databaseFieldAliasMap: RackDeviceAliasMap | null;
  }) => void;
}) {
  const { t } = useLocale();

  const [dbFile, setDBFile] = useState<File | null>(null);

  const [autoFieldDetectionEnabled, setAutoFieldDetectionEnabled] = useState(true);

  const [dbFieldAliasMap, setDBFieldAliasMap] = useState<RackDeviceAliasMap>({
    rackIdAlias: '',
    posLabelAlias: '',
    rackDeviceTypeAlias: '',
    rackDeviceSerialNumberAlias: '',
  });

  const [fileUploaderKey, setFileUploaderKey] = useState(false);

  useEffect(() => {
    if (!open) {
      setFileUploaderKey((key) => !key);
      setDBFile(null);
    }
  }, [open]);

  const isAliasMapValid =
    autoFieldDetectionEnabled ||
    (dbFieldAliasMap.rackIdAlias !== '' &&
      dbFieldAliasMap.posLabelAlias !== '' &&
      dbFieldAliasMap.rackDeviceTypeAlias !== '' &&
      dbFieldAliasMap.rackDeviceSerialNumberAlias !== '' &&
      new Set([
        dbFieldAliasMap.rackIdAlias,
        dbFieldAliasMap.posLabelAlias,
        dbFieldAliasMap.rackDeviceTypeAlias,
        dbFieldAliasMap.rackDeviceSerialNumberAlias,
      ]).size === Object.keys(dbFieldAliasMap).length);

  const templateMenu = aliasMapTemplates.map<DropDownMenuItem>((t, i) => ({
    path: [i.toString()],
    title: templateLabel(i + 1),
    onSelect: () => setDBFieldAliasMap({ ...t }),
  }));

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('RackDatabaseEditor.importDatabase')}>
      <section className="border-t-bsp mt-4 flex flex-col gap-2 border-t-2 pt-4">
        <h2 className="text-center">{t('RackDatabaseEditor.databaseFields')}</h2>
        <ToggleSwitch
          label={t('RackDatabaseEditor.detectFields')}
          shouldLabelGrow
          enabled={autoFieldDetectionEnabled}
          onChange={() => setAutoFieldDetectionEnabled(!autoFieldDetectionEnabled)}
          style={{ marginTop: '1rem' }}
        />
        <div
          className={`
            relative flex flex-col gap-2 transition-[filter]
            ${autoFieldDetectionEnabled ? 'pointer-events-none brightness-75' : ''}
          `}
        >
          <div className="relative mx-auto">
            <DropDownButton
              variant="regular"
              triggerTitle={t('RackDatabaseEditor.chooseTemplate')}
              menu={templateMenu}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label htmlFor="rack-database-editor-rackId">{t('RackDatabaseEditor.rackId')}</label>
            <TextInput
              id="rack-database-editor-rackId"
              value={dbFieldAliasMap.rackIdAlias}
              onChange={(e) =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  rackIdAlias: e.currentTarget.value,
                }))
              }
              onClearClick={() =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  rackIdAlias: '',
                }))
              }
            />
            <label htmlFor="rack-database-editor-posLabel">
              {t('RackDatabaseEditor.posLabel')}
            </label>
            <TextInput
              id="rack-database-editor-posLabel"
              value={dbFieldAliasMap.posLabelAlias}
              onChange={(e) =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  posLabelAlias: e.currentTarget.value,
                }))
              }
              onClearClick={() =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  posLabelAlias: '',
                }))
              }
            />
            <label htmlFor="rack-database-editor-deviceType">
              {t('RackDatabaseEditor.deviceType')}
            </label>
            <TextInput
              id="rack-database-editor-deviceType"
              value={dbFieldAliasMap.rackDeviceTypeAlias}
              onChange={(e) =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  rackDeviceTypeAlias: e.currentTarget.value,
                }))
              }
              onClearClick={() =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  rackDeviceTypeAlias: '',
                }))
              }
            />
            <label htmlFor="rack-database-editor-serialNumber">
              {t('RackDatabaseEditor.serialNumber')}
            </label>
            <TextInput
              id="rack-database-editor-serialNumber"
              value={dbFieldAliasMap.rackDeviceSerialNumberAlias}
              onChange={(e) =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  rackDeviceSerialNumberAlias: e.currentTarget.value,
                }))
              }
              onClearClick={() =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  rackDeviceSerialNumberAlias: '',
                }))
              }
            />
          </div>
        </div>
      </section>
      <section className="border-t-bsp mt-4 flex flex-col items-center justify-center gap-2 border-t-2 pt-4">
        <h2>{t('RackDatabaseEditor.csvFile')}</h2>
        <UploadConfig
          key={Number(fileUploaderKey)}
          hint={t('RackDatabaseEditor.csvHint')}
          onlyDrop
          onFileChange={setDBFile}
          onFileUpload={async () => {}}
        />
      </section>
      <section className="border-t-bsp mt-4 flex justify-center border-t-2">
        <Button
          type={dbFile !== null && isAliasMapValid ? 'encouraging' : 'inactive'}
          title={t('RackDatabaseEditor.import')}
          onClick={() => {
            if (dbFile === null) {
              return;
            }

            onImport({
              databaseFile: dbFile,
              databaseFieldAliasMap: autoFieldDetectionEnabled ? null : dbFieldAliasMap,
            });

            onOpenChange(false);
          }}
          style={{
            marginLeft: 'auto',
            marginRight: 'auto',
            marginTop: '2rem',
          }}
        />
      </section>
    </Modal>
  );
}

const minRows = 0;
const maxRows = 10;
const minColumns = 0;
const maxColumns = 20;

const defaultRows = clamp(3, minRows, maxRows);
const defaultColumns = clamp(4, minColumns, maxColumns);

function PosLabelTable({
  rows,
  setRows,
  posLabelCountMap,
  rackDevicesByPosLabelMap,
}: {
  readonly rows: PosLabelTableCellInfo[][];
  readonly setRows: React.Dispatch<React.SetStateAction<PosLabelTableCellInfo[][]>>;
  readonly posLabelCountMap: Record<string, number>;
  readonly rackDevicesByPosLabelMap: Record<string, RackDeviceInfo[]>;
}) {
  const { t } = useLocale();

  const size = getPosLabelTableSize(rows);

  function dealWithPosLabelLayoutChange() {
    setLastFocusedPosLabelTableCell(null);
  }

  useGranularEffect(
    () => {
      dealWithPosLabelLayoutChange();
    },
    [size.rows, size.columns],
    [dealWithPosLabelLayoutChange],
  );

  const [lastFocusedPosLabelTableCell, setLastFocusedPosLabelTableCell] = useState<{
    row: number;
    column: number;
  } | null>(null);

  function onAddColumn() {
    if (size.rows === 0 || size.columns === 0) {
      setRows([[newPosLabelTableCell()]]);
    } else {
      setRows((rows) => rows.map((row) => [...row, newPosLabelTableCell()]));
    }

    dealWithPosLabelLayoutChange();
  }

  function onRemoveColumn() {
    if (lastFocusedPosLabelTableCell === null) {
      return;
    }

    const { column } = lastFocusedPosLabelTableCell;

    setRows((rows) => rows.map((row) => row.toSpliced(column, 1)));

    dealWithPosLabelLayoutChange();
  }

  function onAddRow() {
    if (size.rows === 0 || size.columns === 0) {
      setRows([[newPosLabelTableCell()]]);
    } else {
      setRows((rows) => [
        ...rows,
        Array.from({
          length: getPosLabelTableSize(rows).columns,
        }).map(newPosLabelTableCell),
      ]);
    }

    dealWithPosLabelLayoutChange();
  }

  function onRemoveRow() {
    if (lastFocusedPosLabelTableCell === null) {
      return;
    }

    const { row } = lastFocusedPosLabelTableCell;

    setRows((rows) => rows.toSpliced(row, 1));

    dealWithPosLabelLayoutChange();
  }

  const removeRowActive = size.rows > minRows && lastFocusedPosLabelTableCell !== null;

  const removeColumnActive = size.columns > minColumns && lastFocusedPosLabelTableCell !== null;

  return (
    <div className="flex flex-col gap-2 overflow-hidden p-2">
      <div className="flex shrink-0 gap-2">
        <IconButton
          icon="removeTableRow"
          iconClassName={`size-7 ${removeRowActive ? 'fill-tda' : 'fill-tpd'}`}
          className={`rounded-full p-2 ${!removeRowActive ? 'pointer-events-none' : ''}`}
          bgClassName={removeRowActive ? 'hover:bg-bse' : ''}
          rippleColor="var(--color-ripple-icon-button)"
          inactive={!removeRowActive}
          title={t('RackDatabaseEditor.removeRow')}
          onClick={onRemoveRow}
        />
        <IconButton
          icon="removeTableColumn"
          iconClassName={`
            size-7
            ${removeColumnActive ? 'fill-tda' : 'fill-tpd'}
          `}
          className={`rounded-full p-2 ${!removeRowActive ? 'pointer-events-none' : ''}`}
          bgClassName={removeRowActive ? 'hover:bg-bse' : ''}
          rippleColor="var(--color-ripple-icon-button)"
          inactive={!removeColumnActive}
          title={t('RackDatabaseEditor.removeColumn')}
          onClick={onRemoveColumn}
        />
      </div>
      <div className="flex w-full flex-grow flex-col gap-2 overflow-auto p-2">
        <div className="flex w-max flex-col gap-2">
          <div className="flex gap-2">
            <table className="w-max">
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((column, columnIndex) => {
                      const { posLabel } = column;

                      const isNonEmptyLabel = posLabel !== '';

                      const isDuplicateLabel =
                        isNonEmptyLabel && (posLabelCountMap[posLabel] ?? 0) > 1;

                      const rackDevicesWithLabel = rackDevicesByPosLabelMap[posLabel];

                      const isNonExistentLabel =
                        isNonEmptyLabel && rackDevicesWithLabel === undefined;

                      const isValidLabel = isDuplicateLabel || isNonExistentLabel;

                      return (
                        <td
                          key={columnIndex}
                          className="border-bsp relative h-6 w-20 truncate border-2"
                          title={(rackDevicesWithLabel ?? [])
                            .map(
                              (device) =>
                                `${posLabel}: ${device.rackDeviceType} (S/N ${device.rackDeviceSerialNumber})`,
                            )
                            .join('\n')}
                        >
                          {isValidLabel && (
                            <div className="border-tda pointer-events-none absolute left-0 top-0 h-full w-full border-2" />
                          )}
                          <input
                            value={posLabel}
                            onChange={(e) => {
                              const value = e.currentTarget.value.trim().replace(/\s+/g, ' ');

                              setRows((rows) => {
                                const cell = rows[rowIndex]?.[columnIndex];

                                if (cell === undefined) {
                                  return rows;
                                }

                                // The cell is copied as well as the row and the list. Copying only the
                                // two containers would leave the cell object shared with the state being
                                // replaced, so editing it would change the previous render's data too.
                                const newRows = [...rows];
                                const newRow = [...(rows[rowIndex] ?? [])];

                                newRow[columnIndex] = { ...cell, posLabel: value };
                                newRows[rowIndex] = newRow;

                                return newRows;
                              });
                            }}
                            onFocus={() =>
                              setLastFocusedPosLabelTableCell({
                                row: rowIndex,
                                column: columnIndex,
                              })
                            }
                            spellcheck={false}
                            className={'w-full border-none bg-transparent p-1 outline-none'}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {size.columns < maxColumns && (
              <div className="my-auto">
                <IconButton
                  icon="plus"
                  iconClassName="size-5 fill-tpd"
                  className="rounded-full p-2"
                  bgClassName="hover:bg-bse"
                  rippleColor="var(--color-ripple-icon-button)"
                  title={t('RackDatabaseEditor.addColumn')}
                  onClick={onAddColumn}
                />
              </div>
            )}
          </div>
          {size.columns !== 0 && size.rows < maxRows && (
            <div className="mx-auto">
              <IconButton
                icon="plus"
                iconClassName="size-5 fill-tpd"
                className="rounded-full p-2"
                bgClassName="hover:bg-bse"
                rippleColor="var(--color-ripple-icon-button)"
                title={t('RackDatabaseEditor.addRow')}
                onClick={onAddRow}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function newPosLabelTableCell(): PosLabelTableCellInfo {
  return { posLabel: '' };
}

function newPosLabelTable() {
  return Array.from({ length: defaultRows }).map(() =>
    Array.from({ length: defaultColumns }).map(newPosLabelTableCell),
  );
}

function getPosLabelTableSize(rows: readonly PosLabelTableCellInfo[][]) {
  return { rows: rows.length, columns: rows[0]?.length ?? 0 };
}
