import * as THREE from "three";

// "Is there a roof above this point?" for the rain (RainEffect, WeatherSound). Once per building
// model a coarse top-down map is built: 0.5 m cells holding the highest roughly horizontal surface
// (roof, upper floor) above 2.5 m. A check is then, per building instance near the point, one
// matrix inverse and one table lookup (microseconds). The source InstancedMeshes are used (the
// visible buildings are culling companions), over all their instances.

const BUILDINGS = /environmentbuildings|goldribbonfactory|araresidence|tollplaza/i;
const CELL = 0.5; // model units
const MIN_ROOF = 2.5; // model units above the model base

const maps = new WeakMap(); // geometry -> { axis, a, b, min, w, h, heights }
const matrix = new THREE.Matrix4();
const inverse = new THREE.Matrix4();
const local = new THREE.Vector3();
const upLocal = new THREE.Vector3();
const tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const e1 = new THREE.Vector3();
const e2 = new THREE.Vector3();
const n = new THREE.Vector3();
let sources = [];
let scannedAt = -Infinity;

export const shelter = { indoors: false };

/** Top-down height map of a geometry's horizontal surfaces, `axis` = its up axis (0 x, 1 y, 2 z). */
function roofMap(geometry, axis) {
    const key = maps.get(geometry);
    if (key && key.axis === axis) return key;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const [a, b] = [0, 1, 2].filter((i) => i !== axis);
    const box = geometry.boundingBox;
    const min = [box.min.getComponent(a), box.min.getComponent(b), box.min.getComponent(axis)];
    const w = Math.ceil((box.max.getComponent(a) - min[0]) / CELL) + 1;
    const h = Math.ceil((box.max.getComponent(b) - min[1]) / CELL) + 1;
    const heights = new Float32Array(w * h).fill(-Infinity);
    const pos = geometry.attributes.position;
    const index = geometry.index;
    const count = index ? index.count : pos.count;
    for (let i = 0; i < count; i += 3) {
        for (let k = 0; k < 3; k++) tri[k].fromBufferAttribute(pos, index ? index.getX(i + k) : i + k);
        n.crossVectors(e1.subVectors(tri[1], tri[0]), e2.subVectors(tri[2], tri[0]));
        const len = n.length();
        if (!len || Math.abs(n.getComponent(axis)) / len < 0.7) continue; // walls
        const top = Math.max(tri[0].getComponent(axis), tri[1].getComponent(axis), tri[2].getComponent(axis));
        if (top - min[2] < MIN_ROOF) continue; // ground-level slabs, yard
        const ca0 = Math.floor((Math.min(tri[0].getComponent(a), tri[1].getComponent(a), tri[2].getComponent(a)) - min[0]) / CELL);
        const ca1 = Math.floor((Math.max(tri[0].getComponent(a), tri[1].getComponent(a), tri[2].getComponent(a)) - min[0]) / CELL);
        const cb0 = Math.floor((Math.min(tri[0].getComponent(b), tri[1].getComponent(b), tri[2].getComponent(b)) - min[1]) / CELL);
        const cb1 = Math.floor((Math.max(tri[0].getComponent(b), tri[1].getComponent(b), tri[2].getComponent(b)) - min[1]) / CELL);
        for (let y = cb0; y <= cb1; y++) for (let x = ca0; x <= ca1; x++) {
            const c = y * w + x;
            if (top > heights[c]) heights[c] = top;
        }
    }
    const map = { axis, a, b, min, w, h, heights };
    maps.set(geometry, map);
    return map;
}

const pending = new Set(); // "geometry|axis" maps queued for idle time
const idle = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 200));
function queueMap(geometry, axis) {
    const k = geometry.uuid + "|" + axis;
    if (pending.has(k)) return;
    pending.add(k);
    idle(() => { roofMap(geometry, axis); pending.delete(k); });
}

function scan(scene) {
    sources = [];
    scene.traverse((o) => {
        if (o.isInstancedMesh && !o.userData.isCullCompanion && !o.userData.isShadowProxy && BUILDINGS.test(o.name)) {
            const geometry = o.geometry;
            if (!geometry.boundingSphere) geometry.computeBoundingSphere();
            sources.push(o);
        }
    });
}

/** True when a building roof (or upper floor) is directly above `point` (scene coordinates). */
export function roofAbove(scene, point) {
    const now = performance.now();
    if (now - scannedAt > 5000) {
        scan(scene);
        scannedAt = now;
    }
    for (const mesh of sources) {
        mesh.updateWorldMatrix(true, false);
        const geometry = mesh.geometry;
        const sphere = geometry.boundingSphere;
        for (let i = 0; i < mesh.instanceMatrix.count; i++) {
            mesh.getMatrixAt(i, matrix);
            matrix.premultiply(mesh.matrixWorld);
            // Quick reject: horizontal distance to the instance beyond its (scaled) bounding radius.
            const e = matrix.elements;
            const scale = Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
            const dx = point.x - e[12];
            const dz = point.z - e[14];
            const reach = (sphere.radius + sphere.center.length()) * scale;
            if (dx * dx + dz * dz > reach * reach) continue;
            inverse.copy(matrix).invert();
            local.copy(point).applyMatrix4(inverse);
            upLocal.set(e[1], e[5], e[9]); // world up in local axes (rows of the rotation-scale)
            const axis = Math.abs(upLocal.x) > Math.abs(upLocal.y) ? (Math.abs(upLocal.x) > Math.abs(upLocal.z) ? 0 : 2) : (Math.abs(upLocal.y) > Math.abs(upLocal.z) ? 1 : 2);
            const map = maps.get(geometry);
            if (!map || map.axis !== axis) { queueMap(geometry, axis); continue; } // built in idle time
            const x = Math.floor((local.getComponent(map.a) - map.min[0]) / CELL);
            const y = Math.floor((local.getComponent(map.b) - map.min[1]) / CELL);
            if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
            const roof = map.heights[y * map.w + x];
            const sign = Math.sign(upLocal.getComponent(axis)) || 1;
            if (roof > -Infinity && sign * (roof - local.getComponent(axis)) > 0) return true;
        }
    }
    return false;
}
