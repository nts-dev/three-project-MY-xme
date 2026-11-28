import * as THREE from "three";

// Wet ground for rain, and the ground's night dimming (driven by RainEffect through `wetSurfaceUniforms`), added to the road / lawn
// materials when they are created, so changing the weather never recompiles them.
//  - Wet asphalt: darker, a thin reflective film.
//  - Puddles: a fixed world-space noise pattern (they stay put), filling up with the wetness; dark
//    water that mirrors the sky with a Fresnel falloff (strong at grazing angles), with raindrop rings
//    near the viewer (procedural, in this shader: no extra geometry or passes).
// Reflections are of the sky colour only (no extra render pass or reflection camera): a few
// instructions per ground pixel, no measurable cost.

export const wetSurfaceUniforms = {
    uWetness: { value: 0 }, // 0 dry .. 1 soaked
    uRain: { value: 0 }, // current rain 0..1 (ripples)
    uWetTime: { value: 0 },
    uDaylight: { value: 1 }, // 0 night .. 1 day: the ground's self-glow (emissive photo) fades at night
    uSkyTop: { value: new THREE.Color("#7c8794") },
    uSkyHorizon: { value: new THREE.Color("#a9b2bb") },
};

const PARS = /* glsl */ `
    uniform float uWetness;
    uniform float uRain;
    uniform float uWetTime;
    uniform float uDaylight;
    uniform vec3 uSkyTop;
    uniform vec3 uSkyHorizon;
    varying vec3 vWetWorld;
    float wetHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float wetNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(wetHash(i), wetHash(i + vec2(1.0, 0.0)), u.x), mix(wetHash(i + vec2(0.0, 1.0)), wetHash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    // Raindrop rings: one drop per grid cell at a random spot, its ring spreading and fading; cells
    // are active in proportion to the rain. Returns the slope (normal xz offset) of the rings.
    vec2 wetRippleLayer(vec2 p, float t, float rain) {
        vec2 id = floor(p);
        vec2 f = fract(p);
        float h = wetHash(id);
        if (wetHash(id + 17.3) > rain) return vec2(0.0);
        vec2 c = 0.25 + 0.5 * vec2(wetHash(id + 3.1), wetHash(id + 9.7));
        float phase = fract(t * (0.8 + 0.6 * h) + h);
        vec2 v = f - c;
        float d = length(v) + 1e-4;
        float r = phase * 0.5;
        float band = 1.0 - smoothstep(0.0, 0.07, abs(d - r));
        float wave = sin((d - r) * 60.0) * band * (1.0 - phase) * (1.0 - phase);
        return v / d * wave;
    }
    vec2 wetRipples(vec2 xz, float t, float rain) {
        vec2 p = xz * 2.0; // 0.5 m cells
        return wetRippleLayer(p, t, rain) + wetRippleLayer(p * 1.3 + vec2(0.37, 0.61), t * 1.1 + 0.5, rain);
    }
`;

/**
 * Adds the wet look to a Phong ground material. `puddles`: standing water (asphalt);
 * `strength`: how wet the surface gets (markings and lawns less than asphalt).
 */
export function applyWetSurface(material, { puddles = true, strength = 1 } = {}) {
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
        previous?.(shader, renderer);
        Object.assign(shader.uniforms, wetSurfaceUniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vWetWorld;")
            .replace("#include <project_vertex>", `#include <project_vertex>
                vec4 wetPosition = vec4(transformed, 1.0);
                #ifdef USE_INSTANCING
                    wetPosition = instanceMatrix * wetPosition;
                #endif
                vWetWorld = (modelMatrix * wetPosition).xyz;`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\n${PARS}`)
            // Wet surfaces are darker (water fills the pores); puddles darkest.
            .replace("#include <map_fragment>", `#include <map_fragment>
                float wetAmount = clamp(uWetness * ${strength.toFixed(2)}, 0.0, 1.0);
                float puddle = 0.0;
                ${puddles ? `
                // Two octaves of noise, metres: puddles a few metres across, growing with the wetness.
                float field = wetNoise(vWetWorld.xz * 0.11) * 0.7 + wetNoise(vWetWorld.xz * 0.37 + 7.3) * 0.3;
                float level = mix(0.82, 0.5, wetAmount);
                puddle = smoothstep(level, level + 0.06, field) * smoothstep(0.15, 0.45, wetAmount);` : ""}
                diffuseColor.rgb *= mix(1.0, 0.62, wetAmount) * mix(1.0, 0.55, puddle);`)
            .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
                totalEmissiveRadiance *= mix(1.0, 0.55, wetAmount) * mix(1.0, 0.5, puddle) * mix(0.12, 1.0, uDaylight);`)
            // Sky reflection on the wet film and in puddles (Fresnel), with rain ripples in puddles.
            .replace("#include <opaque_fragment>", `
                vec3 wetView = normalize(vWetWorld - cameraPosition);
                vec3 wetNormal = vec3(0.0, 1.0, 0.0);
                float rippleHighlight = 0.0;
                ${puddles ? `
                // Raindrop ripples near the viewer (fade out by 45 m: too small to see further away).
                float rippleNear = 1.0 - smoothstep(15.0, 45.0, length(vWetWorld - cameraPosition));
                if (uRain > 0.0 && rippleNear > 0.0 && (puddle > 0.0 || wetAmount > 0.2)) {
                    vec2 slope = wetRipples(vWetWorld.xz, uWetTime, clamp(0.25 + uRain, 0.0, 1.0)) * rippleNear * mix(0.35, 1.0, puddle);
                    wetNormal.xz += slope * 0.35;
                    wetNormal = normalize(wetNormal);
                    rippleHighlight = length(slope);
                }` : ""}
                vec3 wetReflect = reflect(wetView, wetNormal);
                vec3 wetSky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.5, wetReflect.y));
                float fresnel = 0.04 + 0.96 * pow(1.0 - clamp(dot(-wetView, wetNormal), 0.0, 1.0), 5.0);
                // Seen from above water is mostly dark; it mirrors the sky towards grazing angles.
                float mirror = puddle * mix(0.1, 0.95, fresnel) + wetAmount * 0.5 * fresnel;
                outgoingLight = mix(outgoingLight, wetSky * 0.85, clamp(mirror, 0.0, 0.9));
                // Ring crests catch the light (also at night, from the street lamps' glow).
                outgoingLight += rippleHighlight * mix(0.05, 0.12, uDaylight) * vec3(0.9, 0.92, 1.0);
                #include <opaque_fragment>`);
    };
    const key = `wet:${puddles ? 1 : 0}:${strength}`;
    const previousKey = material.customProgramCacheKey?.bind(material);
    material.customProgramCacheKey = () => `${previousKey ? previousKey() : ""}|${key}`;
    return material;
}
