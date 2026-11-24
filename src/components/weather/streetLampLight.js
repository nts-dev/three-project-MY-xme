import * as THREE from "three";

// Street-lamp light on chosen objects (the avatar) without real lights. StreetLights publishes the
// lamp heads and how far they are switched on; an object's material gets two uniforms (light colour
// and direction, view space) that its own useFrame fills from the lamps around it, and adds the light
// in its shader. A real PointLight per lamp (or even one following the avatar) would make every
// material in the scene more expensive; this is a few multiplications per avatar pixel, and a loop
// over the lamps on the CPU once per frame.

export const streetLampState = {
    heads: null, // Float32Array of lamp head positions (world), x y z per lamp
    count: 0,
    level: 0, // 0 off .. 1 fully on
    color: new THREE.Color("#ffd8a0"),
    height: 10, // metres the lamps stand above the ground (falloff scale, as the ground pools)
};

const REACH = 30; // metres: lamps further away do not light the object
const STRENGTH = 1.1;

/** Adds the street-lamp term to a Phong / Standard material; returns its uniforms for updates. */
export function applyStreetLampLight(material) {
    const uniforms = {
        uLampColor: { value: new THREE.Color(0, 0, 0) },
        uLampDir: { value: new THREE.Vector3(0, 1, 0) }, // towards the light, view space
    };
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
        previous?.(shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nuniform vec3 uLampColor;\nuniform vec3 uLampDir;")
            .replace("#include <opaque_fragment>", `
                // Street lamps: mostly from the lit side, a little wrap-around so the dark side is not black.
                outgoingLight += diffuseColor.rgb * uLampColor * (0.25 + 0.75 * max(dot(normal, uLampDir), 0.0));
                #include <opaque_fragment>`);
    };
    const previousKey = material.customProgramCacheKey?.bind(material);
    material.customProgramCacheKey = () => `${previousKey ? previousKey() : ""}|streetLamp`;
    material.needsUpdate = true;
    return uniforms;
}

const toLamp = new THREE.Vector3();
const direction = new THREE.Vector3();

/** Fills `uniforms` (from applyStreetLampLight) with the lamps' light at `position` (world). */
export function updateStreetLampLight(uniforms, position, camera) {
    const { heads, count, level, color, height } = streetLampState;
    if (!heads || level <= 0.01) {
        uniforms.uLampColor.value.setRGB(0, 0, 0);
        return;
    }
    let total = 0;
    direction.set(0, 0, 0);
    for (let i = 0; i < count; i++) {
        const dx = heads[i * 3] - position.x;
        const dz = heads[i * 3 + 2] - position.z;
        if (Math.abs(dx) > REACH || Math.abs(dz) > REACH) continue;
        // Same falloff as the ground pools (cosine-cubed): bright under a lamp, a soft tail.
        const k2 = (dx * dx + dz * dz) / (height * height);
        const light = Math.pow(1 + k2, -1.5);
        if (light < 0.01) continue;
        toLamp.set(dx, heads[i * 3 + 1] - position.y, dz).normalize();
        direction.addScaledVector(toLamp, light);
        total += light;
    }
    if (total <= 0) {
        uniforms.uLampColor.value.setRGB(0, 0, 0);
        return;
    }
    uniforms.uLampColor.value.copy(color).multiplyScalar(Math.min(total, 1.5) * level * STRENGTH);
    uniforms.uLampDir.value.copy(direction.normalize()).transformDirection(camera.matrixWorldInverse);
}

// ---------------------------------------------------------------------------------------------
// Lamp light map for the rest of the scene (trees, building walls, fences...): a top-down texture over
// the estate, rebuilt only when the lamps change (a few ms on the CPU), holding per ~1.5 m cell:
//   R  how much lamp light reaches it (same cosine-cubed falloff as the ground pools, summed),
//   G  the (light-weighted) height of the lamp heads lighting it,
//   BA the horizontal direction towards those lamps.
// Each patched material reads it once per pixel and adds the warm light on the lamp-facing side,
// below the lamp heads. No real lights, no extra pass: one texture lookup per pixel.

const MAP_CELL = 1.5; // metres per texel
const MAP_REACH = 32; // metres around each lamp
const MAP_MAX = 1.5; // light level stored as 0..MAP_MAX

export const lampMapUniforms = {
    uLampMap: { value: null },
    uLampMapOrigin: { value: new THREE.Vector2() }, // world x, z of texel (0, 0)
    uLampMapSize: { value: new THREE.Vector2(1, 1) }, // metres covered in x, z
    uLampMapY: { value: new THREE.Vector2(0, 1) }, // lamp height range: min, range
    uLampMapLevel: { value: 0 }, // lamps on 0..1 (times the strength)
    uLampMapColor: { value: new THREE.Color("#ffd8a0") },
};

/** Rebuilds the lamp light map from the lamp heads (world x y z per lamp). */
export function buildLampMap(heads, count) {
    const old = lampMapUniforms.uLampMap.value;
    if (!heads || !count) {
        old?.dispose();
        lampMapUniforms.uLampMap.value = null;
        return;
    }
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < count; i++) {
        const x = heads[i * 3], y = heads[i * 3 + 1], z = heads[i * 3 + 2];
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    // One empty texel of margin all round, so the edges (clamped) read as "no light".
    const originX = minX - MAP_REACH - MAP_CELL;
    const originZ = minZ - MAP_REACH - MAP_CELL;
    const width = Math.min(2048, Math.ceil((maxX - minX + 2 * MAP_REACH) / MAP_CELL) + 3);
    const depth = Math.min(2048, Math.ceil((maxZ - minZ + 2 * MAP_REACH) / MAP_CELL) + 3);
    const light = new Float32Array(width * depth);
    const heightSum = new Float32Array(width * depth);
    const dirX = new Float32Array(width * depth);
    const dirZ = new Float32Array(width * depth);
    const h2 = streetLampState.height * streetLampState.height;
    const reachCells = Math.ceil(MAP_REACH / MAP_CELL);
    for (let i = 0; i < count; i++) {
        const lx = heads[i * 3], ly = heads[i * 3 + 1], lz = heads[i * 3 + 2];
        const cx = Math.round((lx - originX) / MAP_CELL), cz = Math.round((lz - originZ) / MAP_CELL);
        for (let tz = Math.max(1, cz - reachCells); tz <= Math.min(depth - 2, cz + reachCells); tz++) {
            for (let tx = Math.max(1, cx - reachCells); tx <= Math.min(width - 2, cx + reachCells); tx++) {
                const dx = lx - (originX + tx * MAP_CELL), dz = lz - (originZ + tz * MAP_CELL);
                const d2 = dx * dx + dz * dz;
                if (d2 > MAP_REACH * MAP_REACH) continue;
                const w = Math.pow(1 + d2 / h2, -1.5);
                const k = tz * width + tx;
                const d = Math.sqrt(d2) || 1;
                light[k] += w;
                heightSum[k] += w * ly;
                dirX[k] += (w * dx) / d;
                dirZ[k] += (w * dz) / d;
            }
        }
    }
    const yRange = Math.max(maxY - minY, 0.01);
    const data = new Uint8Array(width * depth * 4);
    for (let k = 0; k < width * depth; k++) {
        const w = light[k];
        if (w <= 0) {
            data[k * 4 + 2] = 128;
            data[k * 4 + 3] = 128;
            continue;
        }
        data[k * 4] = Math.round(255 * Math.min(w / MAP_MAX, 1));
        data[k * 4 + 1] = Math.round(255 * Math.min(Math.max((heightSum[k] / w - minY) / yRange, 0), 1));
        data[k * 4 + 2] = Math.round(255 * (0.5 + 0.5 * Math.max(-1, Math.min(1, dirX[k] / w))));
        data[k * 4 + 3] = Math.round(255 * (0.5 + 0.5 * Math.max(-1, Math.min(1, dirZ[k] / w))));
    }
    const texture = new THREE.DataTexture(data, width, depth, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
    lampMapUniforms.uLampMap.value = texture;
    lampMapUniforms.uLampMapOrigin.value.set(originX, originZ);
    lampMapUniforms.uLampMapSize.value.set(width * MAP_CELL, depth * MAP_CELL);
    lampMapUniforms.uLampMapY.value.set(minY, yRange);
    old?.dispose();
}

const LAMP_MAP_VERTEX = /* glsl */ `
    #include <fog_vertex>
    vec4 lampWorld = vec4(transformed, 1.0);
    #ifdef USE_BATCHING
        lampWorld = batchingMatrix * lampWorld;
    #endif
    #ifdef USE_INSTANCING
        lampWorld = instanceMatrix * lampWorld;
    #endif
    vLampWorld = (modelMatrix * lampWorld).xyz;
`;

const LAMP_MAP_FRAGMENT = /* glsl */ `
    if (uLampMapLevel > 0.001) {
        // Texel centres sit at origin + i * cell: half a texel shift to sample them.
        vec2 lampUv = (vLampWorld.xz - uLampMapOrigin) / uLampMapSize + 0.5 / vec2(textureSize(uLampMap, 0));
        vec4 lampTex = texture2D(uLampMap, lampUv);
        float lampLight = lampTex.r * ${MAP_MAX.toFixed(1)} * uLampMapLevel;
        if (lampLight > 0.002) {
            float lampY = uLampMapY.x + lampTex.g * uLampMapY.y;
            // Lamps shine down: nothing above the lamp heads gets their light.
            lampLight *= 1.0 - smoothstep(-0.5, 2.5, vLampWorld.y - lampY);
            vec2 lampXZ = lampTex.ba * 2.0 - 1.0;
            vec3 toLamp = normalize(vec3(lampXZ.x, 0.35 + 0.1 * max(lampY - vLampWorld.y, 0.0), lampXZ.y));
            vec3 lampView = normalize((viewMatrix * vec4(toLamp, 0.0)).xyz);
            outgoingLight += diffuseColor.rgb * uLampMapColor * lampLight * (0.15 + 0.85 * max(dot(normal, lampView), 0.0));
        }
    }
`;

/** Adds the lamp light map to a lit material (Phong / Lambert / Standard). One recompile, once. */
export function applyLampMap(material) {
    if (!material || material.userData.lampMap) return;
    material.userData.lampMap = true;
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
        previous?.(shader, renderer);
        Object.assign(shader.uniforms, lampMapUniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vLampWorld;")
            .replace("#include <fog_vertex>", LAMP_MAP_VERTEX);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
                varying vec3 vLampWorld;
                uniform sampler2D uLampMap;
                uniform vec2 uLampMapOrigin;
                uniform vec2 uLampMapSize;
                uniform vec2 uLampMapY;
                uniform float uLampMapLevel;
                uniform vec3 uLampMapColor;`)
            .replace("#include <opaque_fragment>", `${LAMP_MAP_FRAGMENT}\n#include <opaque_fragment>`);
    };
    const previousKey = material.customProgramCacheKey?.bind(material);
    material.customProgramCacheKey = () => `${previousKey ? previousKey() : ""}|lampMap`;
    material.needsUpdate = true;
}

/** Whether a scene material should get the lamp light map (lit, not ground / avatar / effects). */
export function wantsLampMap(object, material) {
    if (!material || material.userData.lampMap) return false;
    if (!(material.isMeshPhongMaterial || material.isMeshLambertMaterial || material.isMeshStandardMaterial)) return false;
    if (object.isSkinnedMesh || object.userData?.isBuildingLabel || /^shadow-proxy/.test(object.name || "")) return false;
    const key = material.customProgramCacheKey?.() || "";
    return !/wet:|streetLamp/.test(key); // ground (lit by the light pools) and the avatar (own lamp light)
}
