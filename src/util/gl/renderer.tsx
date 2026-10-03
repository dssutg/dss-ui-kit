/**
 * The WebGL scene renderer.
 *
 * A caller holds a canvas, builds a {@link Scene}, and draws it: {@link useGLCtx} creates the context
 * and compiles the shaders, {@link createSceneRenderContext} uploads the scene into buffers, and
 * {@link renderScene} draws those buffers from a camera. Nothing here knows what a scene depicts, so
 * the renderer is usable for any of it.
 *
 * Buffers are uploaded once per scene and reused across frames, which is why the scene context is a
 * separate object from the scene: moving the camera is a `renderScene` call, and only a changed scene
 * is worth a new `createSceneRenderContext`.
 */

import { useEffect, useState } from 'react';
import fragmentShaderSource from '@/util/gl/fragment.glsl?raw';
import vertexShaderSource from '@/util/gl/vertex.glsl?raw';
import {
  calcNormal,
  convertBoxToQuads,
  flattenSceneObjects,
  type GLQuad,
  generateTransformMatrices,
  getBoxCropUV,
  makeTransformedVertex,
} from './geometry';
import type {
  Camera,
  FontCharacterInfo,
  FontCharacterMap,
  FontRenderInfo,
  Scene,
  TextSceneObject,
  Vector3Array,
} from './scene';

/**
 * The compiled shader program and the locations of everything the shaders bind.
 *
 * Built once per context by {@link useGLCtx}; `attribLocations` of `-1` means the shader does not read
 * that attribute, which is a valid program rather than a broken one.
 */
export interface ProgramInfo {
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

/**
 * A scene uploaded into GPU buffers.
 *
 * The `vertexCount` is in indices rather than vertices, because that is what `drawElements` takes.
 * Free it with {@link deleteSceneRenderContext} when the scene is replaced.
 */
export interface SceneRenderContext {
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

/**
 * Creates a WebGL context for a canvas and compiles the scene shaders into it.
 *
 * Returns `null` until the context exists and again if WebGL is unavailable, so a caller renders
 * whatever it shows instead of a WebGL scene. The program is deleted when the canvas goes away.
 */
export function useGLCtx(canvas: HTMLCanvasElement | null): {
  gl: WebGLRenderingContext;
  programInfo: ProgramInfo;
} | null {
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

/**
 * Draws an uploaded scene from a camera, clearing the canvas first.
 *
 * Call it once per frame: it reuses the buffers in the scene context and recomputes only the two
 * matrices the camera moved.
 */
export function renderScene(
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

function determineFontAtlasSize({
  gl,
  charCount,
  fontSize,
  toleranceY,
}: {
  readonly gl: WebGLRenderingContext;
  readonly charCount: number;
  readonly fontSize: number;
  readonly toleranceY: number;
}): { readonly atlasSize: number; readonly rows: number; readonly cols: number } | null {
  let cols = 0;
  let rows = 0;
  let atlasSize = 1;

  const charH = fontSize + toleranceY;

  const maxAtlasSize = Math.max(2 ** 12, gl.getParameter(gl.MAX_TEXTURE_SIZE));

  while (atlasSize <= maxAtlasSize) {
    cols = Math.trunc(atlasSize / fontSize);
    rows = Math.trunc(atlasSize / charH);

    if (cols * rows >= charCount) {
      break;
    }

    atlasSize = atlasSize * 2;
  }

  if (cols * rows < charCount) {
    console.error(
      `Could not allocate texture atlas for text. Character set size (${charCount}) or font size (${fontSize}) is too large. Multiple texture atlases are not supported yet.`,
    );
    return null;
  }

  return { atlasSize, rows, cols };
}

function drawAtlasCharacter({
  ctx,
  character,
  x,
  y,
  charMap,
}: {
  readonly ctx: CanvasRenderingContext2D;
  readonly character: string;
  readonly x: number;
  readonly y: number;
  readonly charMap: FontCharacterMap;
}) {
  ctx.fillText(character, x, y);

  const { width } = ctx.measureText(character);

  charMap[character] = {
    textureCoordX: x,
    textureCoordY: y,
    width,
  };
}

function renderFontAtlasChars({
  ctx,
  rows,
  cols,
  chars,
  fontSize,
  toleranceY,
}: {
  readonly ctx: CanvasRenderingContext2D;
  readonly rows: number;
  readonly cols: number;
  readonly chars: string[];
  readonly fontSize: number;
  readonly toleranceY: number;
}): FontCharacterMap {
  const charMap: FontCharacterMap = {};

  const handledChars = new Set<string>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const c = chars[col + row * cols];

      if (c === undefined) {
        return charMap;
      }

      const x = col * fontSize;
      const y = row * fontSize + (row + 1) * toleranceY;

      drawAtlasCharacter({ ctx, character: c, x, y, charMap });

      handledChars.add(c);
    }
  }

  if (handledChars.size !== chars.length) {
    console.error('Could not add all used characters to font atlas', {
      added: handledChars,
      all: chars,
    });
  }

  return charMap;
}

function createFontAtlas({
  gl,
  chars,
  fontSize,
  fontName,
  toleranceY,
}: {
  readonly gl: WebGLRenderingContext;
  readonly chars: string[];
  readonly fontSize: number;
  readonly fontName: string;
  readonly toleranceY: number;
}) {
  const sizeResult = determineFontAtlasSize({
    gl,
    charCount: chars.length,
    fontSize,
    toleranceY,
  });

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

  const characterMap = renderFontAtlasChars({ ctx, rows, cols, chars, fontSize, toleranceY });

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

function createFontRenderInfo(gl: WebGLRenderingContext, usedChars: string[]) {
  if (usedChars.length === 0) {
    return null;
  }

  const fontSize = 24;
  const fontName = 'Arial';

  // Without vertical tolerance, diacritic characters or
  // the characters with bottom tails are displayed cut off
  const toleranceY = 4;

  const atlas = createFontAtlas({ gl, chars: usedChars, fontSize, fontName, toleranceY });

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
}

function renderTextObject(
  object: TextSceneObject,
  fontRenderInfo: ReturnType<typeof createFontRenderInfo>,
  quads: GLQuad[],
) {
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

  function buildCharacterQuad(
    characterInfo: FontCharacterInfo,
    width: number,
    quadPos: Vector3Array,
    quadScale: Vector3Array,
  ) {
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

  function renderCharacter(c: string) {
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

      buildCharacterQuad(characterInfo, width, quadPos, quadScale);
    }

    x += sizeX + (charSpacing / fontSize) * scale[0] * 2;
  }

  for (const c of text) {
    if (c === '\n') {
      x = 0;
      y--;
      continue;
    }

    renderCharacter(c);
  }
}

/**
 * Flattens a scene into quads and uploads them into freshly created buffers.
 *
 * Text is rasterised into a font atlas here rather than per frame, and only the characters the scene
 * actually uses are rasterised. The atlas is one texture, so a scene needing more than the largest
 * supported texture's worth of distinct glyphs reports an error instead of drawing half its labels.
 */
export function createSceneRenderContext(
  scene: Scene,
  gl: WebGLRenderingContext,
): SceneRenderContext {
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

  const fontRenderInfo = createFontRenderInfo(gl, [...usedChars]);

  for (const object of textObjs) {
    renderTextObject(object, fontRenderInfo, quads);
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

/** Frees every buffer and the font atlas a scene context holds. */
export function deleteSceneRenderContext(
  sceneCtx: SceneRenderContext,
  gl: WebGLRenderingContext,
): void {
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
