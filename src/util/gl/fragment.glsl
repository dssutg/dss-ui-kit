// Scene fragment shader: flat-shaded diffuse lighting from the camera, with the vertex
// colour modulated by an optional texture.
varying lowp vec4 vPosition;
varying lowp vec2 vTextureCoord;
varying lowp vec4 vNormal;
varying lowp vec4 vColor;
varying lowp vec4 vColorModulator;

uniform lowp vec3 uCameraPosition;
uniform sampler2D uTexture;

uniform lowp mat4 uModelViewMatrix;
uniform lowp mat4 uProjectionMatrix;

void main(void) {
  lowp vec3 pos = (uModelViewMatrix * vPosition).xyz;
  lowp vec3 cam = vec3(uCameraPosition.x, 0.0, uCameraPosition.z);

  lowp vec3 normal = normalize(vNormal.xyz);
  lowp vec3 lightDirection = normalize(pos - cam);

  lowp float cameraDistance = length(pos - cam);
  // Attenuation keeps a near face from blowing out and a far one from going flat black.
  lowp float attenuation = clamp(10.0 / (cameraDistance * cameraDistance + 0.1), 0.5, 2.0);
  lowp float diffuse = abs(dot(normal, lightDirection));
  lowp float ambient = 0.25;
  lowp float finalIllumination = clamp(diffuse * attenuation, 0.0, 1.2) + ambient;

  lowp vec4 illumination = vec4(finalIllumination, finalIllumination, finalIllumination, 1.0);
  gl_FragColor = (vColor + texture2D(uTexture, vTextureCoord)) * vColorModulator * illumination;
}
