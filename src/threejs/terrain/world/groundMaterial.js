import * as THREE from "three";

// Ground surfaces (terrain photo, painted/3D roads, lawn strips) lit the same way as the FBX ground models
// of the hand-built scenes (e.g. 153_L1's Malaysia Roads / Pavement): Phong with the texture as a weak
// emissive map, so the ground is as bright as the models standing on it.
const GLOW = 0.2;
const SPECULAR = 0x505050;

export function groundMaterial({ map = null, color, ...options } = {}) {
    return new THREE.MeshPhongMaterial({
        map,
        color: color ?? 0xffffff,
        emissive: map ? 0xffffff : new THREE.Color(color ?? 0xffffff),
        emissiveMap: map,
        emissiveIntensity: GLOW,
        specular: SPECULAR,
        shininess: 25,
        ...options,
    });
}
