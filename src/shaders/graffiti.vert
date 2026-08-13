
// graffiti.vert.glsl
varying vec2 vUv;
uniform vec2 uRepeat;
uniform vec2 uOffset;

void main() {
    vUv = uv * uRepeat + uOffset;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
