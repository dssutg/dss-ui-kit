export type Vector2Array = [number, number];
export type Vector3Array = [number, number, number];
export type Vector4Array = [number, number, number, number];

export type GLQuadUV = [
  [number, number], // bottom left vertex
  [number, number], // bottom right vertex
  [number, number], // top right vertex
  [number, number], // top left vertex
];

export interface ObjectMaterial {
  type: 'simpleBoxFaceColors';
  frontFaceColor: Vector4Array;
  backFaceColor: Vector4Array;
  topFaceColor: Vector4Array;
  bottomFaceColor: Vector4Array;
  rightFaceColor: Vector4Array;
  leftFaceColor: Vector4Array;
}

export interface QuadSceneObject {
  type: 'quad';
  pos?: Vector3Array | undefined;
  scale?: Vector3Array | undefined;
  rotation?: Vector3Array | undefined;
  material: ObjectMaterial;
}

export interface BoxSceneObject {
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

export interface TextSceneObject {
  type: 'text';
  text: string;
  pos?: Vector3Array | undefined;
  scale?: Vector3Array | undefined;
  rotation?: Vector3Array | undefined;
  material?: ObjectMaterial | undefined;
  color?: Vector4Array | undefined;
}

export interface GroupSceneObject {
  type: 'group';
  pos?: Vector3Array | undefined;
  scale?: Vector3Array | undefined;
  rotation?: Vector3Array | undefined;
  children: SceneObject[];
}

export type SceneObject = QuadSceneObject | BoxSceneObject | TextSceneObject | GroupSceneObject;

export interface Scene {
  objects: SceneObject[];
}

export interface Camera {
  pos: Vector3Array;
  scale: Vector3Array;
  rotation: Vector3Array;
}

export interface FontCharacterInfo {
  textureCoordX: number;
  textureCoordY: number;
  width: number;
}

export type FontCharacterMap = Record<string, FontCharacterInfo>;

export interface FontRenderInfo {
  characterMap: FontCharacterMap;
  fontSize: number;
  toleranceY: number;
  texture: WebGLTexture;
}
