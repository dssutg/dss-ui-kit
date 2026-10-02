// A server rack drawn in WebGL, and the editor for the CSV device database behind it.
//
// What is rendered here is a set of boxes on shelves, so the geometry, the camera and the palette
// belong to this module. What goes *in* the boxes does not: which device sits in which slot, what a
// device type is called, and what colour stands for it are the caller's facts, and every one of them
// arrives as a prop or a field of a descriptor. Nothing here reads application state, asks for a
// route, or fetches anything.
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { AutoSizer } from '@/lib/AutoSizer';
import { groupArrayByProperty } from '@/lib/array';
import {
  clamp,
  cmp,
  degreesToRadians,
  glMat4Identity,
  glMat4Invert,
  glMat4MultiplyMatrixAndVector,
  lerp,
  lerpRange,
  type Mat4,
  modulo,
  normalizeRadians,
  type Vec4,
  Vector3D,
} from '@/lib/math';
import { useEventListener } from '@/lib/use_event_listener';
import { useGranularEffect } from '@/lib/use_granular_effect';
import { useMouseDrag } from '@/lib/use_mouse_drag';
import { useLocale } from '@/locale';
import {
  convertHexColorToGL,
  flattenSceneObjects,
  generateTransformMatrices,
  getCameraWorldPos,
  getMaterialByHexColor,
  isPointInsideBox,
  makeTransformationMatrix,
  naiveRaycast,
  rackColorMap,
  rackDeepColor,
} from '@/server_rack_geometry';
import {
  createSceneRenderContext,
  deleteSceneCtx,
  renderScene,
  type SceneRenderContext,
  useGLCtx,
} from '@/server_rack_render';
import type { BoxSceneObject, Camera, Scene, SceneObject, Vector3Array } from '@/server_rack_scene';
import type {
  DeviceTypeLookup,
  Rack,
  RackDevice,
  RackDeviceRef,
  RackDeviceVariant,
  RackPanelName,
} from '@/server_rack_types';
import { ButtonGroup } from '@/ui/ButtonGroup';

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

const rackBackPadding = 2;

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

/**
 * How far a door panel is swung open: an angled leaf where the panel exists, a flat one against the
 * cabinet side where it does not.
 */
function getRackDoorPanelAngle({
  sideExists,
  flip,
}: {
  readonly sideExists: boolean;
  readonly flip: boolean;
}) {
  if (sideExists) {
    return flip ? Math.PI / 4 : -Math.PI / 4;
  }

  return flip ? -Math.PI / 2 : Math.PI / 2;
}

/** The leaf hinge next to a door panel that exists: one box, drawn only when there is a panel. */
function buildRackDoorPanelSide({
  doorPanelDepth,
}: {
  readonly doorPanelDepth: number;
}): SceneObject[] {
  return [
    {
      type: 'box',
      pos: [0, 0, doorPanelDepth],
      scale: [0.125, 0.25, 0.125 / 2],
      material: getMaterialByHexColor('#111111'),
    },
  ];
}

function buildRackDoorPanel({
  index,
  hasFront,
  hasBack,
  width,
  outerSideWidth,
  outerSideHeight,
  shelfHeight,
  bothSideShelfDepth,
  doorPanelWidth,
  doorPanelHeight,
  doorPanelDepth,
}: {
  readonly index: number;
  readonly hasFront: boolean;
  readonly hasBack: boolean;
  readonly width: number;
  readonly outerSideWidth: number;
  readonly outerSideHeight: number;
  readonly shelfHeight: number;
  readonly bothSideShelfDepth: number;
  readonly doorPanelWidth: number;
  readonly doorPanelHeight: number;
  readonly doorPanelDepth: number;
}): SceneObject {
  const front = index < 2;
  const flip = index % 2 === 1;

  const sideExists = (front && hasFront) || (!front && hasBack);

  const angle = getRackDoorPanelAngle({ sideExists, flip });

  let rotY = angle;
  if (!front) {
    rotY = Math.PI - angle;
  }

  const sides: SceneObject[] = sideExists ? buildRackDoorPanelSide({ doorPanelDepth }) : [];

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
      ...Array.from({ length: 4 }).map((_, index) =>
        buildRackDoorPanel({
          index,
          hasFront,
          hasBack,
          width,
          outerSideWidth,
          outerSideHeight,
          shelfHeight,
          bothSideShelfDepth,
          doorPanelWidth,
          doorPanelHeight,
          doorPanelDepth,
        }),
      ),
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

/** A box the click ray is tested against, together with the transform that undoes its own. */
interface CheckedBox {
  box: BoxSceneObject;
  invertedBoxTransformMatrix: Mat4 | null;
}

/** The drawn box the ray passes through at `currentPos`, or `null` where it passes through empty air. */
function findBoxAtPosition(
  checkedBoxes: readonly CheckedBox[],
  currentPos: Vector3Array,
): BoxSceneObject | null {
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
}

/** One drawn step of the ray trail; the first step is drawn in the highlight colour. */
function buildRayTrailBox(currentPos: Vector3Array, isFirstStep: boolean): SceneObject {
  const materialColor = isFirstStep ? '#ffff00' : '#0000ff';

  return {
    type: 'box',
    tag: 'ray',
    pos: currentPos,
    scale: [1 / 16, 1 / 16, 1 / 16],
    material: getMaterialByHexColor(materialColor),
  };
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
              rayTrail = [...rayTrail, buildRayTrailBox(currentPos, rayTrail.length === 0)];
            }

            return findBoxAtPosition(checkedBoxes, currentPos);
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
