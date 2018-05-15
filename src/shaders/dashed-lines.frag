varying float lineU;
uniform float opacity;
uniform vec3 diffuse;
uniform float dashSteps;
uniform float dashSmooth;
uniform float dashDistance;

void main() {
  float lineUMod = mod(lineU, 1.0/dashSteps) * dashSteps;
  float dash = smoothstep(dashDistance, dashDistance+dashSmooth, length(lineUMod-0.5));
  gl_FragColor = vec4(diffuse, opacity * dash);
}
