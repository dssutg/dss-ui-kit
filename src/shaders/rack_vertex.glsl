// Rack Section Vertex shader
attribute vec4 aVertexPosition;
attribute vec2 aVertexTextureCoord;
attribute vec4 aVertexNormal;
attribute vec4 aVertexColor;
attribute vec4 aVertexColorModulator;

uniform lowp vec3 uCameraPosition;
uniform lowp mat4 uModelViewMatrix;
uniform lowp mat4 uProjectionMatrix;

varying lowp vec4 vPosition;
varying lowp vec2 vTextureCoord;
varying lowp vec4 vNormal;
varying lowp vec4 vColor;
varying lowp vec4 vColorModulator;

void main(void) {
  vPosition = aVertexPosition;
  vTextureCoord = aVertexTextureCoord;
  vNormal = aVertexNormal;
  vColor = aVertexColor;
  vColorModulator = aVertexColorModulator;

  gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
}
