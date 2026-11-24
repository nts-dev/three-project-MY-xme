import * as THREE from "three";

// Wet ground for rain, and the ground's night dimming (driven by RainEffect through `wetSurfaceUniforms`), added to the road / lawn
// materials when they are created, so changing the weather never recompiles them.
//  - Wet asphalt: darker, a thin reflective film.
//  - Puddles: a fixed world-space noise pattern (they stay put), filling up with the wetness; dark
//    water that mirrors the sky with a Fresnel falloff (strong at grazing angles), with light ripples
//    from the falling rain.
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
            .replace("#include <project_vertex>", "#include <project_vertex>\nvWetWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
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
                if (puddle > 0.0 && uRain > 0.0) {
                    vec2 q = vWetWorld.xz * 3.0;
                    float t = uWetTime * 2.3;
                    wetNormal.xz += (vec2(wetNoise(q + t), wetNoise(q - t + 3.1)) - 0.5) * 0.12 * uRain;
                    wetNormal = normalize(wetNormal);
                }
                vec3 wetReflect = reflect(wetView, wetNormal);
                vec3 wetSky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.5, wetReflect.y));
                float fresnel = 0.04 + 0.96 * pow(1.0 - clamp(dot(-wetView, wetNormal), 0.0, 1.0), 5.0);
                // Seen from above water is mostly dark; it mirrors the sky towards grazing angles.
                float mirror = puddle * mix(0.1, 0.95, fresnel) + wetAmount * 0.5 * fresnel;
                outgoingLight = mix(outgoingLight, wetSky * 0.85, clamp(mirror, 0.0, 0.9));
                #include <opaque_fragment>`);
    };
    const key = `wet:${puddles ? 1 : 0}:${strength}`;
    const previousKey = material.customProgramCacheKey?.bind(material);
    material.customProgramCacheKey = () => `${previousKey ? previousKey() : ""}|${key}`;
    return material;
}
