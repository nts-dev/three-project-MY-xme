

varying vec2 vUvRaw;
uniform vec2 uRepeat;
uniform vec2 uOffset;
uniform float uScaleY;
void main() {
    vec2 tuv = uv * uRepeat + uOffset;
    // vertical scale around center
    float c = 0.5;
    tuv.y = (tuv.y - c) / max(uScaleY, 0.0001) + c;
    vUvRaw = tuv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
