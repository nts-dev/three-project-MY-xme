import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ambientLightLevel, useSkyStore, useWeatherStore } from "./weatherStore";
import { applyLampMap, buildLampMap, lampMapUniforms, streetLampState, wantsLampMap } from "./streetLampLight";
import { buildLampTreeShadows, collectTrees, lampShadowUniforms } from "./lampTreeShadows";

// Street lights switch on automatically when it gets dark (dusk, a gloomy overcast evening, a storm)
// and off when it is light again, like photocell lamps (light level from the real sun and live weather):
//  - the LED bulb material of the street-light model glows (emissive), so the real lamp is lit;
//  - a soft glow around each lamp head (camera-facing, additive);
//  - a warm pool of light on the ground under each lamp (flat, additive).
// No real light sources: 87 point lights would make every material in the scene far more expensive.
// Glows and pools are two instanced meshes (2 draw calls), placed from the lamp instances.

const LAMP_MESH = /^TrafficStreetLight$/i;
const TREE_MESH = /PineTree|Tree0?\d/i;
const SCAN_SECONDS = 4;
const MAX_LAMPS = 2048;
// Outdoor light level (0..1, ambientLightLevel) at which the lamps start to come on / are fully on.
// Clear sky: on ~20 min before sunset; grey evening: ~45 min before; a storm in daytime: dimmed on.
const ON_LEVEL = 0.3;
const LAMP_MAP_STRENGTH = 0.9; // lamp light on trees and walls
const FULL_LEVEL = 0.15;
const POOL_RADIUS = 26; // metres: lamps stand ~35-40 m apart, so neighbouring pools overlap
const LAMP_HEIGHT = 10; // metres, sets how quickly the ground light falls off
const GLOW_SIZE = 4.5; // metres across
const LAMP_COLOR = new THREE.Color("#ffd8a0"); // warm white LED

const logDepthVertex = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>
`;

const glowVertex = /* glsl */ `
    ${logDepthVertex}
    attribute vec3 offset; // lamp head, world
    uniform float uSize;
    varying vec2 vUv;
    void main() {
        vUv = position.xy;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 world = offset + (right * position.x + up * position.y) * uSize;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        #include <logdepthbuf_vertex>
    }
`;

const glowFragment = /* glsl */ `
    #include <logdepthbuf_pars_fragment>
    uniform vec3 uColor;
    uniform float uOn;
    varying vec2 vUv;
    void main() {
        #include <logdepthbuf_fragment>
        float r = length(vUv) * 2.0; // 0 centre .. 1 edge
        float glow = (exp(-r * r * 9.0) * 2.0 + exp(-r * r * 2.5) * 0.6) * (1.0 - smoothstep(0.6, 1.0, r));
        gl_FragColor = vec4(uColor * glow * uOn, 1.0);
    }
`;

const poolVertex = /* glsl */ `
    ${logDepthVertex}
    attribute vec3 offset; // ground under the lamp, world
    uniform float uRadius;
    varying vec2 vUv;
    varying vec2 vGround; // world x, z
    void main() {
        vUv = position.xy;
        vec3 world = offset + vec3(position.x, 0.0, position.y) * uRadius * 2.0;
        vGround = world.xz;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        #include <logdepthbuf_vertex>
    }
`;

const poolFragment = /* glsl */ `
    #include <logdepthbuf_pars_fragment>
    uniform vec3 uColor;
    uniform float uOn;
    uniform float uRadius;
    uniform sampler2D uLampShadow;
    uniform vec2 uLampShadowOrigin;
    uniform vec2 uLampShadowSize;
    uniform float uLampShadowOn;
    varying vec2 vUv;
    varying vec2 vGround;
    void main() {
        #include <logdepthbuf_fragment>
        float r = length(vUv) * 2.0; // 0 centre .. 1 edge of the pool quad
        float d = r * uRadius;       // metres from the foot of the lamp
        // Ground light from a lamp LAMP_HEIGHT up (cosine-cubed law): bright under the lamp with a long
        // soft tail, so pools of lamps ~35-40 m apart meet and blend between them.
        float k = d / ${LAMP_HEIGHT.toFixed(1)};
        float pool = 0.8 * pow(1.0 + k * k, -1.5) * (1.0 - smoothstep(0.75, 1.0, r));
        // Tree shadows in the lamp light (baked, lampTreeShadows.js): the share of light trees block here.
        if (uLampShadowOn > 0.5) {
            vec2 shadowUv = (vGround - uLampShadowOrigin) / uLampShadowSize + 0.5 / vec2(textureSize(uLampShadow, 0));
            pool *= 1.0 - 0.85 * texture2D(uLampShadow, shadowUv).r;
        }
        gl_FragColor = vec4(uColor * pool * uOn, 1.0);
    }
`;

/** Centroid of the bulb material's vertices and of the pole's foot, in the model's local space. */
function lampAnchors(mesh) {
    const geometry = mesh.geometry;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const bulbIndex = materials.findIndex((material) => /bulb|lamp_?glass|light/i.test(material?.name || ""));
    const position = geometry.attributes.position;
    const index = geometry.index;
    const bulb = new THREE.Vector3();
    let count = 0;
    const group = geometry.groups.find((g) => g.materialIndex === bulbIndex);
    if (group) {
        for (let i = group.start; i < group.start + group.count; i++) {
            bulb.add(new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i) : i));
            count++;
        }
    }
    if (!count) return null;
    bulb.divideScalar(count);
    return { bulb, bulbIndex };
}

export default function StreetLights() {
    const scene = useThree((state) => state.scene);
    const state = useRef({ mesh: null, anchors: null, version: -1, scannedAt: -Infinity, bulbMaterial: null, bulbBase: null, treeKey: null });
    const on = useRef(0);
    const glowRef = useRef(null);
    const poolRef = useRef(null);

    const { glowGeometry, poolGeometry, glowMaterial, poolMaterial } = useMemo(() => {
        const quad = () => {
            const g = new THREE.InstancedBufferGeometry();
            g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0]), 3));
            g.setIndex([0, 1, 2, 2, 1, 3]);
            // Full-size from the start, filled in place: three.js fixes an instanced geometry's
            // maximum instance count the first time it is drawn, so a buffer swapped in later
            // would stay capped at the placeholder's size (only one lamp lit).
            g.setAttribute("offset", new THREE.InstancedBufferAttribute(new Float32Array(MAX_LAMPS * 3), 3));
            g.instanceCount = 0;
            return g;
        };
        const material = (vertexShader, fragmentShader, extra) => new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: { uColor: { value: LAMP_COLOR.clone() }, uOn: { value: 0 }, ...extra },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            fog: false,
        });
        return {
            glowGeometry: quad(),
            poolGeometry: quad(),
            glowMaterial: material(glowVertex, glowFragment, { uSize: { value: GLOW_SIZE } }),
            poolMaterial: Object.assign(material(poolVertex, poolFragment, { uRadius: { value: POOL_RADIUS }, ...lampShadowUniforms }), {
                polygonOffset: true,
                polygonOffsetFactor: -6,
                polygonOffsetUnits: -12,
            }),
        };
    }, []);

    useEffect(() => () => {
        const s = state.current;
        if (s.bulbMaterial && s.bulbBase) {
            s.bulbMaterial.emissive.copy(s.bulbBase.emissive);
            s.bulbMaterial.emissiveIntensity = s.bulbBase.intensity;
        }
        streetLampState.heads = null;
        streetLampState.count = 0;
        streetLampState.level = 0;
        lampMapUniforms.uLampMapLevel.value = 0;
        buildLampMap(null, 0);
        buildLampTreeShadows(null, 0, [], 1);
        glowGeometry.dispose();
        poolGeometry.dispose();
        glowMaterial.dispose();
        poolMaterial.dispose();
    }, [glowGeometry, poolGeometry, glowMaterial, poolMaterial]);

    useFrame(({ clock }, delta) => {
        const s = state.current;
        const time = clock.getElapsedTime();
        if (time - s.scannedAt > SCAN_SECONDS) {
            s.scannedAt = time;
            let mesh = null;
            const treeMeshes = [];
            scene.traverse((object) => {
                if (!mesh && object.isInstancedMesh && LAMP_MESH.test(object.name || "") && !object.userData.isCullCompanion) mesh = object;
                if (object.isMesh && TREE_MESH.test(object.name || "") && !object.userData.isCullCompanion && !/^shadow-proxy/.test(object.name)) treeMeshes.push(object);
                // Trees, building walls, fences... get the lamp light map (patched once, by day too, so
                // switching the lamps on never recompiles anything).
                if (object.isMesh) {
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    for (const material of materials) if (wantsLampMap(object, material)) applyLampMap(material);
                }
            });
            if (mesh !== s.mesh) {
                s.mesh = mesh;
                s.anchors = mesh ? lampAnchors(mesh) : null;
                s.version = -1;
                const materials = mesh ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
                s.bulbMaterial = s.anchors ? materials[s.anchors.bulbIndex] : null;
                s.bulbBase = s.bulbMaterial?.emissive ? { emissive: s.bulbMaterial.emissive.clone(), intensity: s.bulbMaterial.emissiveIntensity } : null;
            }
            // Lamp heads and the ground under them (world), rebuilt when lamps are added or moved.
            if (s.mesh && s.anchors && s.mesh.instanceMatrix.version !== s.version) {
                s.version = s.mesh.instanceMatrix.version;
                s.mesh.updateWorldMatrix(true, false);
                const count = Math.min(s.mesh.count, MAX_LAMPS);
                const headAttribute = glowGeometry.getAttribute("offset");
                const poolAttribute = poolGeometry.getAttribute("offset");
                const heads = headAttribute.array;
                const pools = poolAttribute.array;
                const matrix = new THREE.Matrix4();
                const point = new THREE.Vector3();
                const foot = new THREE.Vector3();
                for (let i = 0; i < count; i++) {
                    s.mesh.getMatrixAt(i, matrix);
                    matrix.premultiply(s.mesh.matrixWorld);
                    point.copy(s.anchors.bulb).applyMatrix4(matrix);
                    foot.setFromMatrixPosition(matrix); // the model stands on its origin
                    heads.set([point.x, point.y - 0.15, point.z], i * 3);
                    pools.set([point.x, foot.y + 0.12, point.z], i * 3);
                }
                headAttribute.needsUpdate = true;
                poolAttribute.needsUpdate = true;
                streetLampState.heads = heads; // for lamp light on the avatar (streetLampLight.js)
                streetLampState.count = count;
                buildLampMap(heads, count); // and on trees, walls... (lamp light map)
                s.treeKey = null; // re-bake the tree shadows for the new lamps
                glowGeometry.instanceCount = count;
                poolGeometry.instanceCount = count;
            }
            // Tree shadows in the lamp light: baked when the lamps or the trees change.
            if (streetLampState.heads && streetLampState.count) {
                const treeKey = treeMeshes.map((t) => `${t.uuid}:${t.isInstancedMesh ? t.count : 1}:${t.isInstancedMesh ? t.instanceMatrix.version : 0}`).join("|");
                if (treeKey !== s.treeKey) {
                    s.treeKey = treeKey;
                    buildLampTreeShadows(streetLampState.heads, streetLampState.count, collectTrees(treeMeshes), streetLampState.height);
                }
            }
        }

        // Automatic, like a photocell: on when the outdoor light falls below ON_LEVEL (dusk, a dark
        // overcast evening, a storm), fully on below FULL_LEVEL, off again when it is brighter. The
        // light level follows the live weather and the real sun (ambientLightLevel).
        const { weather, preview } = useWeatherStore.getState();
        const light = ambientLightLevel(useSkyStore.getState(), weather, preview);
        const target = 1 - THREE.MathUtils.smoothstep(light, FULL_LEVEL, ON_LEVEL);
        on.current += (target - on.current) * (1 - Math.exp(-1.5 * Math.min(delta, 0.1)));
        const level = on.current;

        if (s.bulbMaterial && s.bulbBase) {
            s.bulbMaterial.emissive.copy(s.bulbBase.emissive).lerp(LAMP_COLOR, level);
            s.bulbMaterial.emissiveIntensity = THREE.MathUtils.lerp(s.bulbBase.intensity, 4, level);
        }
        streetLampState.level = s.mesh ? level : 0;
        lampMapUniforms.uLampMapLevel.value = s.mesh ? level * LAMP_MAP_STRENGTH : 0;
        glowMaterial.uniforms.uOn.value = level;
        poolMaterial.uniforms.uOn.value = level;
        if (glowRef.current) glowRef.current.visible = level > 0.01;
        if (poolRef.current) poolRef.current.visible = level > 0.01;
    });

    return (
        <>
            <mesh ref={poolRef} geometry={poolGeometry} material={poolMaterial} frustumCulled={false} renderOrder={5} visible={false} />
            <mesh ref={glowRef} geometry={glowGeometry} material={glowMaterial} frustumCulled={false} renderOrder={21} visible={false} />
        </>
    );
}
