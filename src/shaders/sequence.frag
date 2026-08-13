

varying vec2 vUvRaw;
uniform sampler2D uAtlas;
uniform vec2  uGrid;       // (cols, rows)
uniform float uFrameCount;
uniform float uTime;
uniform float uFps;
uniform float uSpeed;

// sample a specific tile index in the atlas
vec4 sampleTile(float index, vec2 uv) {
    float cols = uGrid.x;
    float rows = uGrid.y;
    float col = mod(index, cols);
    float row = floor(index / cols);
    vec2 tileSize = 1.0 / vec2(cols, rows);

    // keep uv repeating within tile
    vec2 fuv = fract(uv);
    vec2 atlasUv = (fuv + vec2(col, row)) * tileSize;

    return texture2D(uAtlas, atlasUv);
}

void main() {
    float total = max(uFrameCount, 1.0);

    // time -> frame index (scaled)
    float t = uTime * uFps * uSpeed;   // <- speed control
    float base = floor(t);
    float alpha = fract(t);

    float i1 = mod(base, total);
    float i2 = mod(base + 1.0, total);

    vec4 c1 = sampleTile(i1, vUvRaw);
    vec4 c2 = sampleTile(i2, vUvRaw);
    vec4 col = mix(c1, c2, alpha);

    if (col.a < 0.001) discard;
    gl_FragColor = col;

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
