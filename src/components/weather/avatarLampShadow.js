import * as THREE from "three";
import { streetLampState } from "./streetLampLight";

// Real-time shadows of the avatar from the street lamps at night, without shadow maps: the animated
// avatar is drawn once more per lamp, flattened onto the ground along the rays from that lamp
// (planar projected shadow), so the legs and arms move in the shadow. Cost: the avatar's own few
// thousand vertices once more per shadow (two lamps at most), nothing for the rest of the scene.
// A real lamp shadow map would make every material in the scene sample it.
// The stencil buffer keeps overlapping parts (arm over body) from darkening twice.

export const MAX_LAMP_SHADOWS = 2;
const SHADOW_OPACITY = 0.55;
const SHADOW_REACH = 28; // metres: lamps further away cast no visible avatar shadow
const SHADOW_FADE = [1.2, 7]; // metres from the feet: the shadow fades out over this range

const vertexShader = /* glsl */ `
    #include <common>
    #include <skinning_pars_vertex>
    #include <logdepthbuf_pars_vertex>
    uniform vec3 uLampPos;   // lamp head, world
    uniform float uGroundY;  // ground height at the feet, world
    uniform vec3 uFeet;
    varying float vFromFeet;
    void main() {
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 world = modelMatrix * vec4(transformed, 1.0);
        // Along the ray from the lamp through the point, down to the ground.
        float lampHeight = max(uLampPos.y - uGroundY, 0.5);
        float above = clamp(world.y - uGroundY, 0.0, lampHeight - 0.3);
        vec3 ground = uLampPos + (world.xyz - uLampPos) * (lampHeight / (lampHeight - above));
        ground.y = uGroundY + 0.03;
        vFromFeet = length(ground.xz - uFeet.xz);
        gl_Position = projectionMatrix * viewMatrix * vec4(ground, 1.0);
        #include <logdepthbuf_vertex>
    }
`;

const fragmentShader = /* glsl */ `
    #include <logdepthbuf_pars_fragment>
    uniform float uOpacity;
    varying float vFromFeet;
    void main() {
        #include <logdepthbuf_fragment>
        float fade = 1.0 - smoothstep(${SHADOW_FADE[0].toFixed(1)}, ${SHADOW_FADE[1].toFixed(1)}, vFromFeet);
        gl_FragColor = vec4(0.0, 0.0, 0.0, uOpacity * fade);
    }
`;

/** Shadow meshes for a skinned avatar mesh: added next to it, sharing its geometry and skeleton. */
export function createAvatarLampShadows(person) {
    const shadows = [];
    for (let i = 0; i < MAX_LAMP_SHADOWS; i++) {
        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uLampPos: { value: new THREE.Vector3() },
                uGroundY: { value: 0 },
                uFeet: { value: new THREE.Vector3() },
                uOpacity: { value: 0 },
            },
            transparent: true,
            depthWrite: false,
            fog: false,
            // Each shadow marks its pixels in the stencil and skips pixels it already darkened.
            stencilWrite: true,
            stencilRef: i + 1,
            stencilFunc: THREE.NotEqualStencilFunc,
            stencilZPass: THREE.ReplaceStencilOp,
        });
        const mesh = new THREE.SkinnedMesh(person.geometry, material);
        mesh.name = "avatar-lamp-shadow";
        mesh.bind(person.skeleton, person.bindMatrix);
        mesh.position.copy(person.position);
        mesh.quaternion.copy(person.quaternion);
        mesh.scale.copy(person.scale);
        mesh.frustumCulled = false;
        mesh.renderOrder = 6; // after the ground light pools (5): the shadow also darkens them
        mesh.visible = false;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        person.parent.add(mesh);
        shadows.push(mesh);
    }
    return {
        shadows,
        dispose() {
            for (const mesh of shadows) {
                mesh.removeFromParent();
                mesh.material.dispose();
            }
        },
    };
}

const best = Array.from({ length: MAX_LAMP_SHADOWS }, () => ({ index: -1, weight: 0 }));

/** Points each shadow at one of the strongest lamps around `feet` (world); hides unused ones. */
export function updateAvatarLampShadows(handle, feet) {
    const { heads, count, level, height } = streetLampState;
    for (const slot of best) {
        slot.index = -1;
        slot.weight = 0;
    }
    if (heads && level > 0.01) {
        for (let i = 0; i < count; i++) {
            const dx = heads[i * 3] - feet.x;
            const dz = heads[i * 3 + 2] - feet.z;
            if (Math.abs(dx) > SHADOW_REACH || Math.abs(dz) > SHADOW_REACH) continue;
            const weight = Math.pow(1 + (dx * dx + dz * dz) / (height * height), -1.5);
            // Keep the strongest MAX_LAMP_SHADOWS (insertion into a tiny sorted list).
            for (let s = 0; s < best.length; s++) {
                if (weight > best[s].weight) {
                    for (let m = best.length - 1; m > s; m--) {
                        best[m].index = best[m - 1].index;
                        best[m].weight = best[m - 1].weight;
                    }
                    best[s].index = i;
                    best[s].weight = weight;
                    break;
                }
            }
        }
    }
    handle.shadows.forEach((mesh, s) => {
        const slot = best[s];
        const opacity = slot.index >= 0 ? SHADOW_OPACITY * level * Math.min(1, slot.weight * 2.5) : 0;
        mesh.visible = opacity > 0.02;
        if (!mesh.visible) return;
        const u = mesh.material.uniforms;
        u.uLampPos.value.fromArray(heads, slot.index * 3);
        u.uGroundY.value = feet.y;
        u.uFeet.value.copy(feet);
        u.uOpacity.value = opacity;
    });
}
