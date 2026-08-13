
// graffiti.frag.glsl
varying vec2 vUv;

uniform sampler2D uMask;
uniform float uTime;
uniform float uWobbleAmp;
uniform float uWobbleFreq;

uniform vec3  uTextColor;
uniform vec3  uBgColor;
uniform float uBgAlpha;

void main() {
    // UV wobble (GPU)
    vec2 uv = vUv;
    uv += vec2(
    sin((uv.y + uTime) * uWobbleFreq),
    cos((uv.x + uTime * 0.9) * (uWobbleFreq * 0.95))
    ) * uWobbleAmp;

    // text alpha from mask
    float a = texture2D(uMask, uv).a;

    // composite: grey background + solid text color
    vec3 outRgb = mix(uBgColor, uTextColor, a);
    float outA  = mix(uBgAlpha, 1.0, a);

    gl_FragColor = vec4(outRgb, outA);

    // correct tonemapping & sRGB conversion
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}

