/**
 * The scene the WebGL renderer draws.
 *
 * A scene is a flat list of boxes, quads, text runs and groups in world space, plus a camera. It is
 * deliberately not a scene graph: an object carries its own position, scale and rotation and the
 * renderer applies them, so a caller composes a hierarchy by nesting groups and never walks one.
 *
 * Colours are RGBA in `0..1` rather than CSS strings, because they end up in vertex attributes.
 * `convertHexColorToGL` turns a design token into one.
 */

export type Vector2Array = [number, number];
export type Vector3Array = [number, number, number];
export type Vector4Array = [number, number, number, number];

/** Texture coordinates for the four corners of a face, clockwise from the bottom left. */
export type GLQuadUV = [[number, number], [number, number], [number, number], [number, number]];

/** One colour per face of a box, in RGBA, for an object whose faces differ. */
export interface BoxFaceColors {
  readonly frontFaceColor: Vector4Array;
  readonly backFaceColor: Vector4Array;
  readonly topFaceColor: Vector4Array;
  readonly bottomFaceColor: Vector4Array;
  readonly rightFaceColor: Vector4Array;
  readonly leftFaceColor: Vector4Array;
}

/** How an object is drawn: one colour per face, or the flat colour every face shares. */
export type ObjectMaterial = BoxFaceColors | Vector4Array;

/** A single quad in space. Two dimensions of its scale are ignored by the renderer. */
export interface QuadSceneObject {
  readonly type: 'quad';
  readonly pos?: Vector3Array | undefined;
  readonly scale?: Vector3Array | undefined;
  readonly rotation?: Vector3Array | undefined;
  readonly material: ObjectMaterial;
}

/** A box in space, with optional per-face texture crops and an opaque tag for the caller's own use. */
export interface BoxSceneObject {
  readonly type: 'box';
  readonly pos?: Vector3Array | undefined;
  readonly scale?: Vector3Array | undefined;
  readonly rotation?: Vector3Array | undefined;
  readonly material: ObjectMaterial;
  readonly frontUV?: GLQuadUV | undefined;
  readonly backUV?: GLQuadUV | undefined;
  readonly topUV?: GLQuadUV | undefined;
  readonly bottomUV?: GLQuadUV | undefined;
  readonly rightUV?: GLQuadUV | undefined;
  readonly leftUV?: GLQuadUV | undefined;
  /** Carried through untouched, so a caller can identify what a picked box was. */
  readonly tag?: unknown | undefined;
}

/**
 * A run of text, drawn from the font atlas the renderer rasterises on first use.
 *
 * The colour is the object's own rather than the material's, because text is drawn as one textured
 * quad and has no faces to colour individually.
 */
export interface TextSceneObject {
  readonly type: 'text';
  readonly text: string;
  readonly pos?: Vector3Array | undefined;
  readonly scale?: Vector3Array | undefined;
  readonly rotation?: Vector3Array | undefined;
  readonly material?: ObjectMaterial | undefined;
  readonly color?: Vector4Array | undefined;
}

/** Several objects drawn as one, by transforming them together. */
export interface GroupSceneObject {
  readonly type: 'group';
  readonly pos?: Vector3Array | undefined;
  readonly scale?: Vector3Array | undefined;
  readonly rotation?: Vector3Array | undefined;
  readonly children: readonly SceneObject[];
}

export type SceneObject = QuadSceneObject | BoxSceneObject | TextSceneObject | GroupSceneObject;

/** A scene: what is drawn, and the camera it is drawn from. */
export interface Scene {
  readonly objects: readonly SceneObject[];
}

/** A camera position, scale and rotation, in degrees for the rotation. */
export interface Camera {
  readonly pos: Vector3Array;
  readonly scale: Vector3Array;
  readonly rotation: Vector3Array;
}

/** One glyph in the rasterised font atlas, and where in it that glyph sits. */
export interface FontCharacterInfo {
  readonly textureCoordX: number;
  readonly textureCoordY: number;
  readonly width: number;
}

export type FontCharacterMap = Record<string, FontCharacterInfo>;

/** The atlas the renderer rasterised for {@link TextSceneObject}s, kept so it can be reloaded and freed. */
export interface FontRenderInfo {
  readonly characterMap: FontCharacterMap;
  readonly fontSize: number;
  /** Extra pixels per line below the baseline, so descenders and diacritics are not clipped. */
  readonly toleranceY: number;
  /** The side length of the square atlas texture, in pixels. */
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly texture: WebGLTexture;
}
