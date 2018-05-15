attribute vec3 customColor;
uniform float size;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  gl_PointSize = size;
  gl_Position = projectionMatrix * mvPosition;
}
