// SPDX-License-Identifier: MIT
/**
 * The WebGL renderer's contract, against a fake GL context.
 *
 * jsdom implements no WebGL, so every canvas here answers `getContext` with an object that carries
 * the real WebGL 1 enum values and records every call. The assertions are about what the renderer
 * compiles, binds and draws — the shaders the library ships, the buffers a scene uploads, the
 * uniforms a camera produces and the objects a context frees — never about the fake's own behaviour.
 *
 * `useGLCtx` is a hook, so it renders through the shared render helper; its cleanup runs when the
 * tree unmounts. Everything else is a plain call. The one branch nothing can reach is left uncovered
 * and reported, not papered over with a stub.
 */
// @vitest-environment jsdom
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { degreesToRadians } from '@/util/math';
import { render } from '@/util/testing/render';
import {
  createSceneRenderContext,
  deleteSceneRenderContext,
  renderScene,
  type SceneRenderContext,
  useGLCtx,
} from './renderer';
import type { Camera, FontRenderInfo } from './scene';

/**
 * The shaders the renderer imports are text modules the vite test transform cannot read as itself
 * (the `moduleTypes` mapping belongs to the build, and no node module is importable in a library
 * test), so both are mocked with distinct payloads. What the tests can claim is that the program is
 * compiled from these two default exports, vertex first, each exactly once.
 */
vi.mock('./vertex.glsl?import', () => ({ default: 'mock vertex shader source' }));
vi.mock('./fragment.glsl?import', () => ({ default: 'mock fragment shader source' }));

/** The payloads the mocked shader modules hand the renderer, spelled out where they are asserted. */
const MOCK_VERTEX_SHADER = 'mock vertex shader source';
const MOCK_FRAGMENT_SHADER = 'mock fragment shader source';

/** The WebGL 1 enum values, numbered as the spec numbers them; the code reads them off `gl`. */
const GL = {
  COLOR_BUFFER_BIT: 0x4000,
  DEPTH_BUFFER_BIT: 0x100,
  VERTEX_SHADER: 0x8b31,
  FRAGMENT_SHADER: 0x8b30,
  COMPILE_STATUS: 0x8b81,
  LINK_STATUS: 0x8b82,
  ARRAY_BUFFER: 0x8892,
  ELEMENT_ARRAY_BUFFER: 0x8893,
  STATIC_DRAW: 0x88e4,
  FLOAT: 0x1406,
  TRIANGLES: 0x4,
  UNSIGNED_SHORT: 0x1403,
  DEPTH_TEST: 0xb71,
  BLEND: 0xbe2,
  SRC_ALPHA: 0x302,
  ONE_MINUS_SRC_ALPHA: 0x303,
  LEQUAL: 0x203,
  TEXTURE_2D: 0xde1,
  TEXTURE0: 0x84c0,
  RGBA: 0x1908,
  UNSIGNED_BYTE: 0x1401,
  TEXTURE_MIN_FILTER: 0x2801,
  TEXTURE_MAG_FILTER: 0x2800,
  LINEAR: 0x2601,
  MAX_TEXTURE_SIZE: 0xd33,
} as const;

/** A canvas big enough that its width over height is a recognizable fraction, 4/3 here. */
const CANVAS_SIZE = { width: 800, height: 600 };

/** The smallest texture size a real implementation reports; it also keeps the atlas math small. */
const MINIMUM_MAX_TEXTURE = 64;

/** How wide the fake 2d context says a glyph is, which is the font size the renderer rasterises at. */
const GLYPH_WIDTH = 24;

/** The renderer's fixed font choices for the atlas. */
const FONT_SIZE = 24;
const FONT_NAME = 'Arial';
const TOLERANCE_Y = 4;

/** The white RGBA a flat scene material reads as. */
const WHITE: [number, number, number, number] = [1, 1, 1, 1];

/** The red RGBA a flat scene material reads as, for a quad distinguishable from a white box. */
const RED: [number, number, number, number] = [1, 0, 0, 1];

/** What a fake context may be told to fail at; absent means it succeeds. */
interface FakeSettings {
  readonly shaderCreationFails?: boolean;
  readonly fragmentShaderCreationFails?: boolean;
  readonly shaderCompilationFails?: boolean;
  readonly programCreationFails?: boolean;
  readonly programLinkingFails?: boolean;
  readonly bufferCreationFails?: boolean;
  readonly textureCreationFails?: boolean;
  readonly maxTextureSize?: number;
}

/** The atlas texture uploaded at the end of a font build. */
type UploadedRaster = Float32Array | Uint16Array | ImageData;

/**
 * A WebGL context that returns the spec's enums, remembers what it was asked, and answers every
 * query with what its settings say. Every created shader, program, buffer and texture is a distinct
 * object, so a test can compare against the exact handle the code carried, not a structurally equal
 * stand-in. The `gl` of the answer is this same object typed the way the code receives it.
 */
function createFakeWebGL(settings: FakeSettings = {}) {
  /** Distinct numbers per attribute, so an assertion on a pointer call names the right attribute. */
  const attribByName = new Map<string, number>([
    ['aVertexPosition', 0],
    ['aVertexTextureCoord', 1],
    ['aVertexNormal', 2],
    ['aVertexColor', 3],
    ['aVertexColorModulator', 4],
  ]);

  const uniformByName = new Map<string, WebGLUniformLocation>();

  /** The number of shader creations this is, because the fragment shader is requested second. */
  let shaderRequests = 0;

  const fake = {
    canvas: { ...CANVAS_SIZE },
    ...GL,
    clearColor: vi.fn<(red: number, green: number, blue: number, alpha: number) => void>(),
    clear: vi.fn<(mask: number) => void>(),
    clearDepth: vi.fn<(depth: number) => void>(),
    enable: vi.fn<(capability: number) => void>(),
    blendFunc: vi.fn<(source: number, destination: number) => void>(),
    depthFunc: vi.fn<(func: number) => void>(),
    createShader: vi.fn<() => WebGLShader | null>(() => {
      shaderRequests += 1;

      if (settings.shaderCreationFails === true) {
        return null;
      }

      if (settings.fragmentShaderCreationFails === true && shaderRequests === 2) {
        return null;
      }

      return {};
    }),
    shaderSource: vi.fn<(shader: WebGLShader | null, source: string) => void>(),
    compileShader: vi.fn<(shader: WebGLShader | null) => void>(),
    getShaderParameter: vi.fn<() => boolean>(() => settings.shaderCompilationFails !== true),
    getShaderInfoLog: vi.fn<() => string>(() => 'shader info log'),
    deleteShader: vi.fn<(shader: WebGLShader | null) => void>(),
    createProgram: vi.fn<() => WebGLProgram | null>(() =>
      settings.programCreationFails === true ? null : {},
    ),
    attachShader: vi.fn<(program: WebGLProgram | null, shader: WebGLShader | null) => void>(),
    linkProgram: vi.fn<(program: WebGLProgram | null) => void>(),
    getProgramParameter: vi.fn<(program: WebGLProgram | null, pname: number) => boolean>(
      () => settings.programLinkingFails !== true,
    ),
    getProgramInfoLog: vi.fn<(program: WebGLProgram | null) => string | null>(
      () => 'program info log',
    ),
    deleteProgram: vi.fn<(program: WebGLProgram | null) => void>(),
    getAttribLocation: vi.fn<(program: WebGLProgram | null, name: string) => number>(
      (_program, name) => attribByName.get(name) ?? -1,
    ),
    getUniformLocation: vi.fn<
      (program: WebGLProgram | null, name: string) => WebGLUniformLocation | null
    >((_program, name) => {
      const found = uniformByName.get(name);

      if (found !== undefined) {
        return found;
      }

      const location: WebGLUniformLocation = {};
      uniformByName.set(name, location);

      return location;
    }),
    useProgram: vi.fn<(program: WebGLProgram | null) => void>(),
    createBuffer: vi.fn<() => WebGLBuffer | null>(() =>
      settings.bufferCreationFails === true ? null : {},
    ),
    bindBuffer: vi.fn<(target: number, buffer: WebGLBuffer | null) => void>(),
    bufferData: vi.fn<(target: number, data: UploadedRaster, usage: number) => void>(),
    deleteBuffer: vi.fn<(buffer: WebGLBuffer | null) => void>(),
    createTexture: vi.fn<() => WebGLTexture | null>(() =>
      settings.textureCreationFails === true ? null : {},
    ),
    bindTexture: vi.fn<(target: number, texture: WebGLTexture | null) => void>(),
    deleteTexture: vi.fn<(texture: WebGLTexture | null) => void>(),
    texImage2D:
      vi.fn<
        (
          target: number,
          level: number,
          internalFormat: number,
          format: number,
          type: number,
          pixels: ImageData,
        ) => void
      >(),
    generateMipmap: vi.fn<(target: number) => void>(),
    texParameteri: vi.fn<(target: number, pname: number, param: number) => void>(),
    getParameter: vi.fn<(pname: number) => number>(
      () => settings.maxTextureSize ?? MINIMUM_MAX_TEXTURE,
    ),
    drawElements: vi.fn<(mode: number, count: number, type: number, offset: number) => void>(),
    activeTexture: vi.fn<(texture: number) => void>(),
    uniformMatrix4fv:
      vi.fn<
        (
          location: WebGLUniformLocation | null,
          transpose: boolean,
          value: readonly number[],
        ) => void
      >(),
    uniform3fv: vi.fn<(location: WebGLUniformLocation | null, value: Float32Array) => void>(),
    uniform1i: vi.fn<(location: WebGLUniformLocation | null, x: number) => void>(),
    vertexAttribPointer:
      vi.fn<
        (
          index: number,
          size: number,
          type: number,
          normalized: boolean,
          stride: number,
          offset: number,
        ) => void
      >(),
    enableVertexAttribArray: vi.fn<(index: number) => void>(),
  };

  return { fake, gl: fake as unknown as WebGLRenderingContext, uniforms: uniformByName };
}

/** The buffers the fake bound on `target`, in call order, so their identity can be asserted. */
function boundOn(
  bindBuffer: Mock<(target: number, buffer: WebGLBuffer | null) => void>,
  target: number,
): readonly (WebGLBuffer | null)[] {
  return bindBuffer.mock.calls.filter((call) => call[0] === target).map((call) => call[1]);
}

/** The typed arrays uploaded on `target`, in call order. */
function uploadedOn(
  bufferData: Mock<(target: number, data: UploadedRaster, usage: number) => void>,
  target: number,
): readonly (Float32Array | Uint16Array)[] {
  return bufferData.mock.calls
    .filter((call) => call[0] === target)
    .map((call) => call[1] as Float32Array | Uint16Array);
}

/** A canvas whose `getContext` answers `gl` for every request, with the request recorded. */
function canvasRendering(gl: WebGLRenderingContext | null): {
  readonly canvas: HTMLCanvasElement;
  readonly getContext: Mock<() => WebGLRenderingContext | null>;
} {
  const canvas = document.createElement('canvas');
  const getContext = vi.fn(() => gl);

  Object.defineProperty(canvas, 'getContext', { configurable: true, value: getContext });

  return { canvas, getContext };
}

/** What `useGLCtx` answers, captured from the last probe render. */
type GLContext = NonNullable<ReturnType<typeof useGLCtx>>;

/**
 * Renders one canvas and reads back what `useGLCtx` made of it, after its effect has run. The
 * unmount carries the hook's cleanup, which is how a test exercises it.
 */
async function mountCanvas(
  canvas: HTMLCanvasElement | null,
): Promise<{ readonly context: GLContext | null; unmount(): void }> {
  let captured: GLContext | null = null;

  function Probe({ canvas: probed }: { readonly canvas: HTMLCanvasElement | null }): null {
    captured = useGLCtx(probed);

    return null;
  }

  const mounted = await render(<Probe canvas={canvas} />);

  return { context: captured, unmount: mounted.unmount };
}

/** A scene context whose buffers are one object each, so their identity is assertable. */
function sceneContextOf(
  vertexCount: number,
  fontRenderInfo: FontRenderInfo | null,
): SceneRenderContext {
  return {
    buffers: { pos: {}, textureCoord: {}, normal: {}, color: {}, colorModulator: {}, indices: {} },
    vertexCount,
    fontRenderInfo,
  };
}

let savedGetContext: PropertyDescriptor | undefined;

/** Answers every canvas the code creates with `twoDimensional` for the 2d request and null else. */
function stubCanvas2D(twoDimensional: CanvasRenderingContext2D | null): void {
  savedGetContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: (contextId: string) => (contextId === '2d' ? twoDimensional : null),
  });
}

/** One drawn glyph's metrics, as the 2d context reports width and nothing else. */
function fakeMetrics(width: number): TextMetrics {
  return { width } as unknown as TextMetrics;
}

/** The pixels of an atlas the fake 2d context claims to have drawn into. */
function fakeImageData(width: number, height: number): ImageData {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
    colorSpace: 'srgb',
  } as unknown as ImageData;
}

/**
 * A 2d context that records what it drew and reports one width for every glyph. It reads back the
 * style properties through the same object, so a test asserts on the font a run was rasterised with.
 */
function createFake2DContext(): {
  readonly canvas2D: CanvasRenderingContext2D;
  readonly fillText: Mock;
  readonly getImageData: Mock;
} {
  const canvas2D = {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textBaseline: '',
    fillText: vi.fn<(text: string, x: number, y: number) => void>(),
    measureText: vi.fn<(text: string) => TextMetrics>(() => fakeMetrics(GLYPH_WIDTH)),
    getImageData: vi.fn<(sx: number, sy: number, sw: number, sh: number) => ImageData>(
      (_sx, _sy, sw, sh) => fakeImageData(sw, sh),
    ),
  };

  return {
    canvas2D: canvas2D as unknown as CanvasRenderingContext2D,
    fillText: canvas2D.fillText,
    getImageData: canvas2D.getImageData,
  };
}

/** A text run of `count` distinct characters from a code point range holding no whitespace. */
function glyphsBeyondOneAtlas(count: number): string {
  let text = '';

  for (let index = 0; index < count; index++) {
    text += String.fromCodePoint(0x4e00 + index);
  }

  return text;
}

/**
 * How many distinct glyphs one atlas holds and one more that cannot fit. The atlas is capped at
 * 4096, which for the renderer's font holds 4096 / 24 columns * 4096 / 28 rows = 24820 glyphs.
 */
const GLYPHS_BEYOND_ONE_ATLAS = 24821;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  if (savedGetContext !== undefined) {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', savedGetContext);
    savedGetContext = undefined;
  }

  vi.restoreAllMocks();
});

describe('useGLCtx', () => {
  test('compiles the shipped shaders into the canvas context and reports every binding', async () => {
    const { gl, uniforms } = createFakeWebGL();

    const mounted = await mountCanvas(canvasRendering(gl).canvas);

    if (mounted.context === null) {
      throw new Error('every query on this context answers, so this cannot be reached');
    }

    expect(mounted.context.gl).toBe(gl);
    expect(mounted.context.programInfo.attribLocations).toEqual({
      vertexPos: 0,
      vertexTextureCoord: 1,
      vertexNormal: 2,
      vertexColor: 3,
      vertexColorModulator: 4,
    });

    expect(mounted.context.programInfo.uniformLocations.projectionMatrix).toBe(
      uniforms.get('uProjectionMatrix'),
    );
    expect(mounted.context.programInfo.uniformLocations.modelViewMatrix).toBe(
      uniforms.get('uModelViewMatrix'),
    );
    expect(mounted.context.programInfo.uniformLocations.cameraPos).toBe(
      uniforms.get('uCameraPosition'),
    );
    expect(mounted.context.programInfo.uniformLocations.texture).toBe(uniforms.get('uTexture'));
  });

  test('compiles a vertex and a fragment shader into one program, in that order', async () => {
    const { fake, gl } = createFakeWebGL();

    const mounted = await mountCanvas(canvasRendering(gl).canvas);

    if (mounted.context === null) {
      throw new Error('every query on this context answers, so this cannot be reached');
    }

    // The module's two default exports are uploaded once each, vertex before fragment, and the
    // program is exactly the one the context created.
    expect(fake.shaderSource.mock.calls.map((call) => call[1])).toEqual([
      MOCK_VERTEX_SHADER,
      MOCK_FRAGMENT_SHADER,
    ]);

    const program = fake.createProgram.mock.results[0]?.value ?? null;

    expect(mounted.context.programInfo.program).toBe(program);
    expect(fake.attachShader.mock.calls).toEqual([
      [program, fake.createShader.mock.results[0]?.value ?? null],
      [program, fake.createShader.mock.results[1]?.value ?? null],
    ]);
    expect(fake.deleteShader).not.toHaveBeenCalled();
  });

  test('clears the canvas black before anything is drawn', async () => {
    const { fake, gl } = createFakeWebGL();

    await mountCanvas(canvasRendering(gl).canvas);

    expect(fake.clearColor).toHaveBeenCalledWith(0, 0, 0, 1);
    expect(fake.clear).toHaveBeenCalledWith(GL.COLOR_BUFFER_BIT);
  });

  test('deletes the program when the canvas goes away', async () => {
    const { fake, gl } = createFakeWebGL();

    const mounted = await mountCanvas(canvasRendering(gl).canvas);

    if (mounted.context === null) {
      throw new Error('every query on this context answers, so this cannot be reached');
    }

    const program = fake.createProgram.mock.results[0]?.value ?? null;

    mounted.unmount();

    expect(fake.useProgram).toHaveBeenCalledWith(null);
    expect(fake.deleteProgram).toHaveBeenCalledWith(program);
  });

  test('answers null for a null canvas and never asks it for a context', async () => {
    const rendered = canvasRendering(createFakeWebGL().gl);

    const mounted = await mountCanvas(null);

    expect(mounted.context).toBeNull();
    expect(rendered.getContext).not.toHaveBeenCalled();
  });

  test('answers null and reports when the canvas has no WebGL', async () => {
    const rendered = canvasRendering(null);

    const mounted = await mountCanvas(rendered.canvas);

    expect(mounted.context).toBeNull();
    expect(rendered.getContext).toHaveBeenCalledWith('webgl');
    expect(console.error).toHaveBeenCalledWith('Unable to initialize WebGL');
  });

  test('answers null and reports a shader that cannot be created', async () => {
    const { fake, gl } = createFakeWebGL({ shaderCreationFails: true });

    const mounted = await mountCanvas(canvasRendering(gl).canvas);

    expect(mounted.context).toBeNull();
    expect(console.error).toHaveBeenCalledWith('An error occurred creating shader');
    expect(fake.deleteShader).not.toHaveBeenCalled();
  });

  test('answers null and reports a shader that fails to compile', async () => {
    const { fake, gl } = createFakeWebGL({ shaderCompilationFails: true });

    const mounted = await mountCanvas(canvasRendering(gl).canvas);

    expect(mounted.context).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'An error occurred compiling the shaders: shader info log',
    );

    // Both shaders fail the same way, and neither is left behind.
    expect(fake.deleteShader).toHaveBeenCalledTimes(2);
  });

  test('answers null when only the fragment shader cannot be created', async () => {
    const { fake, gl } = createFakeWebGL({ fragmentShaderCreationFails: true });

    const mounted = await mountCanvas(canvasRendering(gl).canvas);

    expect(mounted.context).toBeNull();

    // The missing fragment shader bails before a program is ever made.
    expect(fake.createProgram).not.toHaveBeenCalled();
    expect(fake.createProgram.mock.results[0]?.value).toBeUndefined();
  });

  test('answers null and reports a program that cannot be created', async () => {
    const { gl } = createFakeWebGL({ programCreationFails: true });

    const mounted = await mountCanvas(canvasRendering(gl).canvas);

    expect(mounted.context).toBeNull();
    expect(console.error).toHaveBeenCalledWith("Couldn't create the shader program");
  });

  test('answers null and reports a program that fails to link', async () => {
    const { gl } = createFakeWebGL({ programLinkingFails: true });

    const mounted = await mountCanvas(canvasRendering(gl).canvas);

    expect(mounted.context).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "Couldn't initialize the shader program: program info log",
    );
  });
});
describe('renderScene', () => {
  test('draws a scene from the camera, binding every buffer and drawing its indices', async () => {
    const { fake, gl, uniforms } = createFakeWebGL();

    const mounted = await mountCanvas(canvasRendering(gl).canvas);

    if (mounted.context === null) {
      throw new Error('every query on this context answers, so this cannot be reached');
    }

    const camera: Camera = { pos: [1, 2, 3], rotation: [0, 0, 0], scale: [1, 1, 1] };
    const sceneCtx = sceneContextOf(36, null);

    renderScene(mounted.context.gl, mounted.context.programInfo, sceneCtx, camera);

    // The state the draw happens under: black clear, near-over-far blending, LEQUAL depth test.
    expect(fake.clearColor).toHaveBeenCalledWith(0, 0, 0, 1);
    expect(fake.clearDepth).toHaveBeenCalledWith(1);
    expect(fake.enable.mock.calls).toEqual([[GL.DEPTH_TEST], [GL.BLEND]]);
    expect(fake.blendFunc).toHaveBeenCalledWith(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
    expect(fake.depthFunc).toHaveBeenCalledWith(GL.LEQUAL);
    expect(fake.clear).toHaveBeenCalledWith(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

    // The five attribute buffers are bound in scene-context order, all on the array buffer.
    const boundArrays = boundOn(fake.bindBuffer, GL.ARRAY_BUFFER);

    expect(boundArrays).toHaveLength(5);
    expect(boundArrays[0]).toBe(sceneCtx.buffers.pos);
    expect(boundArrays[1]).toBe(sceneCtx.buffers.textureCoord);
    expect(boundArrays[2]).toBe(sceneCtx.buffers.normal);
    expect(boundArrays[3]).toBe(sceneCtx.buffers.color);
    expect(boundArrays[4]).toBe(sceneCtx.buffers.colorModulator);

    // The index buffer is the one binding on the element array buffer.
    const boundElements = boundOn(fake.bindBuffer, GL.ELEMENT_ARRAY_BUFFER);

    expect(boundElements).toHaveLength(1);
    expect(boundElements[0]).toBe(sceneCtx.buffers.indices);

    // Each attribute reads its buffer: 3 components for positions and normals, 2 for texture
    // coordinates, 4 for both colour attributes, at the location the shader reports for each.
    expect(fake.vertexAttribPointer.mock.calls).toEqual([
      [0, 3, GL.FLOAT, false, 0, 0],
      [1, 2, GL.FLOAT, false, 0, 0],
      [2, 3, GL.FLOAT, false, 0, 0],
      [3, 4, GL.FLOAT, false, 0, 0],
      [4, 4, GL.FLOAT, false, 0, 0],
    ]);
    expect(fake.enableVertexAttribArray.mock.calls).toEqual([[0], [1], [2], [3], [4]]);

    expect(fake.useProgram).toHaveBeenCalledWith(mounted.context.programInfo.program);

    // The projection is the perspective for a 4/3 canvas; the model-view is the camera placement
    // with nothing rotated or scaled.
    const focal = 1 / Math.tan(degreesToRadians(45) / 2);
    const depthFactor = 1 / (0.1 - 100);

    expect(fake.uniformMatrix4fv).toHaveBeenCalledWith(uniforms.get('uProjectionMatrix'), false, [
      focal / (800 / 600),
      0,
      0,
      0,
      0,
      focal,
      0,
      0,
      0,
      0,
      (100 + 0.1) * depthFactor,
      -1,
      0,
      0,
      2 * 100 * 0.1 * depthFactor,
      0,
    ]);
    expect(fake.uniformMatrix4fv).toHaveBeenCalledWith(
      uniforms.get('uModelViewMatrix'),
      false,
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1],
    );
    expect(fake.uniform3fv).toHaveBeenCalledWith(
      uniforms.get('uCameraPosition'),
      new Float32Array([1, 2, 3]),
    );

    // A scene without text binds no atlas: the texture unit and its uniform stay untouched.
    expect(fake.activeTexture).not.toHaveBeenCalled();
    expect(fake.uniform1i).not.toHaveBeenCalled();

    expect(fake.drawElements).toHaveBeenCalledWith(GL.TRIANGLES, 36, GL.UNSIGNED_SHORT, 0);
    expect(fake.drawElements).toHaveBeenCalledTimes(1);
  });

  test('binds the font atlas to texture unit 0 when the scene has text', async () => {
    const { fake, gl, uniforms } = createFakeWebGL();

    const mounted = await mountCanvas(canvasRendering(gl).canvas);

    if (mounted.context === null) {
      throw new Error('every query on this context answers, so this cannot be reached');
    }

    const texture: WebGLTexture = {};
    const fontRenderInfo: FontRenderInfo = {
      texture,
      characterMap: {},
      fontSize: FONT_SIZE,
      toleranceY: TOLERANCE_Y,
      atlasWidth: 64,
      atlasHeight: 64,
    };

    renderScene(
      mounted.context.gl,
      mounted.context.programInfo,
      sceneContextOf(6, fontRenderInfo),
      { pos: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    );

    expect(fake.activeTexture).toHaveBeenCalledWith(GL.TEXTURE0);
    expect(fake.bindTexture).toHaveBeenCalledWith(GL.TEXTURE_2D, texture);
    expect(fake.uniform1i).toHaveBeenCalledWith(uniforms.get('uTexture'), 0);
    expect(fake.drawElements).toHaveBeenCalledWith(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
  });
});

describe('createSceneRenderContext', () => {
  test('uploads a box as six quads across five float buffers and one index buffer', () => {
    const { fake, gl } = createFakeWebGL();

    const context = createSceneRenderContext(
      { objects: [{ type: 'box', pos: [10, 0, 0], material: WHITE }] },
      gl,
    );

    expect(fake.createBuffer).toHaveBeenCalledTimes(6);
    expect(fake.bufferData).toHaveBeenCalledTimes(6);

    // Everything is uploaded as a static draw, into five float arrays and then the indices.
    expect(fake.bufferData.mock.calls.map((call) => call[2])).toEqual([
      GL.STATIC_DRAW,
      GL.STATIC_DRAW,
      GL.STATIC_DRAW,
      GL.STATIC_DRAW,
      GL.STATIC_DRAW,
      GL.STATIC_DRAW,
    ]);
    expect(fake.bufferData.mock.calls.map((call) => call[0])).toEqual([
      GL.ARRAY_BUFFER,
      GL.ARRAY_BUFFER,
      GL.ARRAY_BUFFER,
      GL.ARRAY_BUFFER,
      GL.ARRAY_BUFFER,
      GL.ELEMENT_ARRAY_BUFFER,
    ]);

    // A box at [10, 0, 0] draws its front face one unit out on each side of the centre, first the
    // bottom two corners of the front face.
    const positions = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[0] ?? new Float32Array(),
    );

    expect(positions).toHaveLength(72);
    expect(positions.slice(0, 6)).toEqual([9, -1, 1, 11, -1, 1]);

    // An untextured quad's texture coordinates are zeros, one pair per corner.
    const textureCoords = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[1] ?? new Float32Array(),
    );

    expect(textureCoords).toHaveLength(48);
    expect(textureCoords.every((coord) => coord === 0)).toBe(true);

    // The front face's normal is the unit normal of its first corner triangle, one per corner.
    const normals = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[2] ?? new Float32Array(),
    );

    expect(normals.slice(0, 12)).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);

    // A flat material's colour lands on every corner; the modulator is always full white.
    const colors = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[3] ?? new Float32Array(),
    );
    const modulators = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[4] ?? new Float32Array(),
    );

    expect(colors.every((component) => component === 1)).toBe(true);
    expect(modulators.every((component) => component === 1)).toBe(true);

    // Every quad is two triangles over its four vertices: 0-1-2 and 0-2-3, offset by 4 per quad.
    const indices = Array.from(
      uploadedOn(fake.bufferData, GL.ELEMENT_ARRAY_BUFFER)[0] ?? new Uint16Array(),
    );

    expect(indices).toEqual([
      0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18,
      16, 18, 19, 20, 21, 22, 20, 22, 23,
    ]);

    expect(context.vertexCount).toBe(36);
    expect(context.fontRenderInfo).toBeNull();
  });

  test('rasterises every character a text run uses across the whole atlas grid', () => {
    const fakeTwoD = createFake2DContext();
    stubCanvas2D(fakeTwoD.canvas2D);

    // The atlas canvas is created by the renderer itself, so watching the prototype's `remove`
    // proves the temporary canvas is taken down once its pixels are read.
    const removeSpy = vi.spyOn(HTMLCanvasElement.prototype, 'remove');

    const { fake, gl } = createFakeWebGL();

    const context = createSceneRenderContext(
      {
        objects: [
          { type: 'box', pos: [0, 0, 0], material: WHITE },
          { type: 'text', text: 'abcd', pos: [1, 2, 3], scale: [2, 2, 2], color: [1, 0, 0, 1] },
        ],
      },
      gl,
    );

    // The 24 px font with a 4 px tolerance needs columns of 24 and rows of 28 pixels, so a 64
    // atlas holds a 2 * 2 grid, and exactly four distinct characters fill it. Row y grows by the
    // tolerance per row, which is what keeps descenders and diacritics off the cell above.
    expect(fakeTwoD.fillText).toHaveBeenCalledWith('a', 0, TOLERANCE_Y);
    expect(fakeTwoD.fillText).toHaveBeenCalledWith('b', FONT_SIZE, TOLERANCE_Y);
    expect(fakeTwoD.fillText).toHaveBeenCalledWith('c', 0, FONT_SIZE + 2 * TOLERANCE_Y);
    expect(fakeTwoD.fillText).toHaveBeenCalledWith('d', FONT_SIZE, FONT_SIZE + 2 * TOLERANCE_Y);
    expect(fakeTwoD.canvas2D.fillStyle).toBe('#ffffff');
    expect(fakeTwoD.canvas2D.strokeStyle).toBe('#ffffff');
    expect(fakeTwoD.canvas2D.font).toBe(`${FONT_SIZE}px ${FONT_NAME}`);
    expect(fakeTwoD.canvas2D.textBaseline).toBe('top');
    expect(fakeTwoD.getImageData).toHaveBeenCalledWith(0, 0, 64, 64);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();

    expect(fake.createTexture).toHaveBeenCalledTimes(1);
    expect(fake.bindTexture.mock.calls).toEqual([
      [GL.TEXTURE_2D, fake.createTexture.mock.results[0]?.value],
    ]);
    expect(fake.texImage2D).toHaveBeenCalledWith(
      GL.TEXTURE_2D,
      0,
      GL.RGBA,
      GL.RGBA,
      GL.UNSIGNED_BYTE,
      fakeTwoD.getImageData.mock.results[0]?.value,
    );
    expect(fake.generateMipmap).toHaveBeenCalledWith(GL.TEXTURE_2D);
    expect(fake.texParameteri.mock.calls).toEqual([
      [GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR],
      [GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR],
    ]);

    if (context.fontRenderInfo === null) {
      throw new Error('four characters of a 2 * 2 atlas fit, so this cannot be reached');
    }

    expect(context.fontRenderInfo).toEqual({
      texture: fake.createTexture.mock.results[0]?.value,
      characterMap: {
        a: { textureCoordX: 0, textureCoordY: TOLERANCE_Y, width: GLYPH_WIDTH },
        b: { textureCoordX: FONT_SIZE, textureCoordY: TOLERANCE_Y, width: GLYPH_WIDTH },
        c: { textureCoordX: 0, textureCoordY: FONT_SIZE + 2 * TOLERANCE_Y, width: GLYPH_WIDTH },
        d: {
          textureCoordX: FONT_SIZE,
          textureCoordY: FONT_SIZE + 2 * TOLERANCE_Y,
          width: GLYPH_WIDTH,
        },
      },
      fontSize: FONT_SIZE,
      atlasWidth: 64,
      atlasHeight: 64,
      toleranceY: TOLERANCE_Y,
    });

    // Six box quads plus one quad per glyph, each worth six indices.
    expect(context.vertexCount).toBe(60);

    // The last quad is the 'd' glyph, drawn after the others at each glyph's tracked offset.
    const positions = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[0] ?? new Float32Array(),
    );

    expect(positions).toHaveLength(120);
    expect(positions.slice(108)).toEqual([13, 0, 3, 17, 0, 3, 17, 4, 3, 13, 4, 3]);

    // Its texture crop covers the 'd' cell trimmed by the tolerance row: x in [.375,.75] and
    // y in [28/64, 56/64] = [.4375,.875].
    const textureCoords = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[1] ?? new Float32Array(),
    );

    expect(textureCoords).toHaveLength(80);
    expect(textureCoords.slice(72)).toEqual([
      0.375, 0.875, 0.75, 0.875, 0.75, 0.4375, 0.375, 0.4375,
    ]);

    // A text quad has no corner colours of its own; its colour lands in the modulator instead.
    const colors = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[3] ?? new Float32Array(),
    );
    const modulators = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[4] ?? new Float32Array(),
    );

    expect(colors.slice(0, 96).every((component) => component === 1)).toBe(true);
    expect(colors.slice(96)).toEqual(new Array(64).fill(0));
    expect(modulators.slice(0, 96).every((component) => component === 1)).toBe(true);
    expect(modulators.slice(96)).toEqual([
      1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0,
      1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0,
      0, 1,
    ]);
  });

  test('rasterises no atlas for a run whose text is all whitespace', () => {
    const { fake, gl } = createFakeWebGL();

    const context = createSceneRenderContext({ objects: [{ type: 'text', text: ' \t' }] }, gl);

    expect(context.fontRenderInfo).toBeNull();
    expect(fake.createTexture).not.toHaveBeenCalled();
    expect(fake.createBuffer).toHaveBeenCalledTimes(6);
    expect(context.vertexCount).toBe(0);
  });

  test('keeps drawing the boxes when the atlas cannot be drawn into', () => {
    stubCanvas2D(null);

    const removeSpy = vi.spyOn(HTMLCanvasElement.prototype, 'remove');
    const { fake, gl } = createFakeWebGL();

    const context = createSceneRenderContext(
      {
        objects: [
          { type: 'box', pos: [0, 0, 0], material: WHITE },
          { type: 'text', text: 'a' },
        ],
      },
      gl,
    );

    // The canvas was taken down and the atlas given up, but the boxes still draw.
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(fake.createTexture).not.toHaveBeenCalled();
    expect(fake.createBuffer).toHaveBeenCalledTimes(6);
    expect(context.fontRenderInfo).toBeNull();
    expect(context.vertexCount).toBe(36);

    const positions = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[0] ?? new Float32Array(),
    );

    // Only the box's six quads made it into the buffers; the text contributed nothing.
    expect(positions).toHaveLength(72);
  });

  test('keeps the scene when the atlas texture cannot be created', () => {
    const fakeTwoD = createFake2DContext();
    stubCanvas2D(fakeTwoD.canvas2D);

    const removeSpy = vi.spyOn(HTMLCanvasElement.prototype, 'remove');
    const { fake, gl } = createFakeWebGL({ textureCreationFails: true });

    const context = createSceneRenderContext({ objects: [{ type: 'text', text: 'a' }] }, gl);

    // The glyphs were rasterised into pixels that never became a texture.
    expect(fakeTwoD.fillText).toHaveBeenCalledWith('a', 0, TOLERANCE_Y);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(fake.generateMipmap).not.toHaveBeenCalled();
    expect(context.fontRenderInfo).toBeNull();
    expect(context.vertexCount).toBe(0);
  });

  test('reports an atlas too small for the characters a scene uses', () => {
    const { fake, gl } = createFakeWebGL({ maxTextureSize: 4096 });

    const context = createSceneRenderContext(
      { objects: [{ type: 'text', text: glyphsBeyondOneAtlas(GLYPHS_BEYOND_ONE_ATLAS) }] },
      gl,
    );

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Could not allocate texture atlas for text'),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Character set size (${GLYPHS_BEYOND_ONE_ATLAS}) or font size (${FONT_SIZE}) is too large`,
      ),
    );
    expect(fake.createTexture).not.toHaveBeenCalled();
    expect(context.fontRenderInfo).toBeNull();
    expect(context.vertexCount).toBe(0);
  });

  test('keeps the atlas within the texture size the device reports', () => {
    const fakeTwoD = createFake2DContext();
    stubCanvas2D(fakeTwoD.canvas2D);

    // Five distinct glyphs need a 128 atlas, which a device reporting 64 cannot hold. The cap is
    // the device's texture limit, so the too-small error path is the behaviour and nothing is
    // allocated past what the device says it can hold — before the fix the atlas was sized to 128.
    const { fake, gl } = createFakeWebGL({ maxTextureSize: MINIMUM_MAX_TEXTURE });

    const context = createSceneRenderContext({ objects: [{ type: 'text', text: 'abcde' }] }, gl);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Could not allocate texture atlas for text'),
    );
    expect(fakeTwoD.getImageData).not.toHaveBeenCalled();
    expect(fake.createTexture).not.toHaveBeenCalled();
    expect(context.fontRenderInfo).toBeNull();
    expect(context.vertexCount).toBe(0);
  });

  test('sizes the atlas to a small device limit when the glyphs fit within it', () => {
    const fakeTwoD = createFake2DContext();
    stubCanvas2D(fakeTwoD.canvas2D);

    const { fake, gl } = createFakeWebGL({ maxTextureSize: 32 });

    const context = createSceneRenderContext({ objects: [{ type: 'text', text: 'a' }] }, gl);

    if (context.fontRenderInfo === null) {
      throw new Error('one glyph of a 1 * 1 atlas at 32 fits, so this cannot be reached');
    }

    // A device reporting 32 gets an atlas of exactly 32: the reported limit is a ceiling on the
    // doubled size, not a floor under the 4096 default cap.
    expect(fakeTwoD.fillText).toHaveBeenCalledWith('a', 0, TOLERANCE_Y);
    expect(fakeTwoD.getImageData).toHaveBeenCalledWith(0, 0, 32, 32);
    expect(context.fontRenderInfo.atlasWidth).toBe(32);
    expect(context.fontRenderInfo.atlasHeight).toBe(32);
    expect(fake.createTexture).toHaveBeenCalledTimes(1);
  });

  test('draws a text run across a line break and leaves the blanks blank', () => {
    const fakeTwoD = createFake2DContext();
    stubCanvas2D(fakeTwoD.canvas2D);

    const { fake, gl } = createFakeWebGL();

    const context = createSceneRenderContext({ objects: [{ type: 'text', text: 'a\nb ' }] }, gl);

    if (context.fontRenderInfo === null) {
      throw new Error('two characters of a 2 * 2 atlas fit, so this cannot be reached');
    }

    expect(context.fontRenderInfo.characterMap).toEqual({
      a: { textureCoordX: 0, textureCoordY: TOLERANCE_Y, width: GLYPH_WIDTH },
      b: { textureCoordX: FONT_SIZE, textureCoordY: TOLERANCE_Y, width: GLYPH_WIDTH },
    });

    // Two glyph quads: the first at the default position, the second one line below, since a line
    // break zeroes x and steps y; the blank space draws nothing of its own.
    const positions = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[0] ?? new Float32Array(),
    );

    expect(context.vertexCount).toBe(12);
    expect(positions).toHaveLength(24);
    expect(positions).toEqual([
      0, -1, 0, 2, -1, 0, 2, 1, 0, 0, 1, 0, 0, -2, 0, 2, -2, 0, 2, 0, 0, 0, 0, 0,
    ]);

    // An unplaced, uncoloured run defaults its geometry and modulates with plain white.
    const modulators = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[4] ?? new Float32Array(),
    );

    expect(modulators.every((component) => component === 1)).toBe(true);
  });

  test('uploads a quad object as its single front-face quad', () => {
    // A `quad` object is drawn as the unit front face a box has: four vertices, the material's
    // colour on every corner, zero texture coordinates and two triangles of indices.
    const { fake, gl } = createFakeWebGL();

    const context = createSceneRenderContext({ objects: [{ type: 'quad', material: WHITE }] }, gl);

    expect(console.error).not.toHaveBeenCalled();
    expect(fake.createBuffer).toHaveBeenCalledTimes(6);
    expect(fake.bufferData).toHaveBeenCalledTimes(6);
    expect(context.fontRenderInfo).toBeNull();
    expect(context.vertexCount).toBe(6);

    const positions = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[0] ?? new Float32Array(),
    );

    expect(positions).toEqual([-1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1]);

    // Untextured: one zero pair per corner.
    const textureCoords = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[1] ?? new Float32Array(),
    );

    expect(textureCoords).toHaveLength(8);
    expect(textureCoords.every((coord) => coord === 0)).toBe(true);

    // Facing the camera, one normal per corner.
    const normals = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[2] ?? new Float32Array(),
    );

    expect(normals).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);

    // The flat material's colour lands on every corner; the modulator is always full white.
    const colors = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[3] ?? new Float32Array(),
    );
    const modulators = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[4] ?? new Float32Array(),
    );

    expect(colors).toHaveLength(16);
    expect(colors.every((component) => component === 1)).toBe(true);
    expect(modulators).toHaveLength(16);
    expect(modulators.every((component) => component === 1)).toBe(true);

    // One quad is two triangles over its four vertices: 0-1-2 and 0-2-3.
    const indices = Array.from(
      uploadedOn(fake.bufferData, GL.ELEMENT_ARRAY_BUFFER)[0] ?? new Uint16Array(),
    );

    expect(indices).toEqual([0, 1, 2, 0, 2, 3]);
  });

  test('uploads a quad next to a box, in the order the scene lists them', () => {
    const { fake, gl } = createFakeWebGL();

    const context = createSceneRenderContext(
      {
        objects: [
          { type: 'quad', material: RED },
          { type: 'box', pos: [10, 0, 0], material: WHITE },
        ],
      },
      gl,
    );

    // Seven quads all told — the quad's one first, then the box's six — each worth six indices.
    expect(context.vertexCount).toBe(42);

    const positions = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[0] ?? new Float32Array(),
    );

    expect(positions).toHaveLength(84);

    // The first four corners are the quad's; the box's front face follows as the second quad.
    expect(positions.slice(0, 12)).toEqual([-1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1]);
    expect(positions.slice(12, 18)).toEqual([9, -1, 1, 11, -1, 1]);

    // The quad's corners carry its own material, not the box's.
    const colors = Array.from(
      uploadedOn(fake.bufferData, GL.ARRAY_BUFFER)[3] ?? new Float32Array(),
    );

    expect(colors.slice(0, 16)).toEqual([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]);

    // The quad object's one quad opens the index buffer as indices 0..3, and the box's six follow.
    const indices = Array.from(
      uploadedOn(fake.bufferData, GL.ELEMENT_ARRAY_BUFFER)[0] ?? new Uint16Array(),
    );

    expect(indices).toEqual([
      0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18,
      16, 18, 19, 20, 21, 22, 20, 22, 23, 24, 25, 26, 24, 26, 27,
    ]);
  });
});

describe('deleteSceneRenderContext', () => {
  test('frees every buffer and the atlas texture, then empties the context', () => {
    const fakeTwoD = createFake2DContext();
    stubCanvas2D(fakeTwoD.canvas2D);

    const { fake, gl } = createFakeWebGL();

    const context = createSceneRenderContext({ objects: [{ type: 'text', text: 'a' }] }, gl);

    if (context.fontRenderInfo === null) {
      throw new Error('characters of a drawn atlas are kept, so this cannot be reached');
    }

    // The handles are read before anything is deleted, since deleting empties the context itself.
    const buffers = { ...context.buffers };
    const fontTexture = context.fontRenderInfo.texture;

    deleteSceneRenderContext(context, gl);

    expect(fake.deleteBuffer.mock.calls).toEqual([
      [buffers.pos],
      [buffers.textureCoord],
      [buffers.normal],
      [buffers.indices],
      [buffers.color],
      [buffers.colorModulator],
    ]);
    expect(fake.deleteTexture).toHaveBeenCalledWith(fontTexture);

    expect(context.buffers.pos).toBeNull();
    expect(context.buffers.textureCoord).toBeNull();
    expect(context.buffers.normal).toBeNull();
    expect(context.buffers.indices).toBeNull();
    expect(context.buffers.color).toBeNull();
    expect(context.buffers.colorModulator).toBeNull();
    expect(context.fontRenderInfo).toBeNull();

    // A freed context has nothing left to free.
    deleteSceneRenderContext(context, gl);

    expect(fake.deleteBuffer).toHaveBeenCalledTimes(6);
    expect(fake.deleteTexture).toHaveBeenCalledTimes(1);
  });
});
