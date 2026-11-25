import * as THREE from "three";

// Shadows of the trees in the street-lamp light, baked once into a top-down texture: lamps and trees
// never move, so nothing is computed per frame. For every lamp, each tree near it is projected onto
// the ground along the lamp's rays (trunk + a few crown discs, like a planar shadow), and each ground
// cell stores the share of its lamp light that trees block (weighted by how much light each lamp
// gives there). The ground light pools (StreetLights) multiply their light by it: one texture lookup
// per pool pixel. Rebuilt only when the lamps or the trees change (a few tens of ms).

const CELL = 0.5; // metres per texel
const REACH = 30; // metres: tree shadows within this distance of a lamp
const MAX_STRETCH = 3.5; // a shadow is at most this many times the tree's size (crowns near lamp height)
const MAX_TEXELS = 2048;

export const lampShadowUniforms = {
    uLampShadow: { value: null },
    uLampShadowOrigin: { value: new THREE.Vector2() },
    uLampShadowSize: { value: new THREE.Vector2(1, 1) },
    uLampShadowOn: { value: 0 }, // 0 until a map exists
};

const corner = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const box = new THREE.Box3();

/** World-space size of every tree: { x, z, base, height, radius } per tree. */
export function collectTrees(meshes) {
    const trees = [];
    for (const mesh of meshes) {
        const geometry = mesh.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        const local = geometry.boundingBox;
        mesh.updateWorldMatrix(true, false);
        const count = mesh.isInstancedMesh ? mesh.count : 1;
        for (let i = 0; i < count; i++) {
            if (mesh.isInstancedMesh) mesh.getMatrixAt(i, matrix).premultiply(mesh.matrixWorld);
            else matrix.copy(mesh.matrixWorld);
            box.makeEmpty();
            for (let c = 0; c < 8; c++) {
                corner.set(c & 1 ? local.max.x : local.min.x, c & 2 ? local.max.y : local.min.y, c & 4 ? local.max.z : local.min.z).applyMatrix4(matrix);
                box.expandByPoint(corner);
            }
            const height = box.max.y - box.min.y;
            if (height < 1) continue;
            trees.push({
                x: (box.min.x + box.max.x) / 2,
                z: (box.min.z + box.max.z) / 2,
                base: box.min.y,
                height,
                radius: Math.min(box.max.x - box.min.x, box.max.z - box.min.z) / 2,
            });
        }
    }
    return trees;
}

/** Bakes the tree shadow map from the lamp heads (x y z per lamp) and the trees (collectTrees). */
export function buildLampTreeShadows(heads, count, trees, lampHeight) {
    const old = lampShadowUniforms.uLampShadow.value;
    if (!heads || !count || !trees.length) {
        old?.dispose();
        lampShadowUniforms.uLampShadow.value = null;
        lampShadowUniforms.uLampShadowOn.value = 0;
        return;
    }
    const startedAt = performance.now();
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < count; i++) {
        minX = Math.min(minX, heads[i * 3]); maxX = Math.max(maxX, heads[i * 3]);
        minZ = Math.min(minZ, heads[i * 3 + 2]); maxZ = Math.max(maxZ, heads[i * 3 + 2]);
    }
    const margin = REACH + 2;
    const cell = Math.max(CELL, (Math.max(maxX - minX, maxZ - minZ) + 2 * margin) / (MAX_TEXELS - 2));
    const originX = minX - margin, originZ = minZ - margin;
    const width = Math.ceil((maxX - minX + 2 * margin) / cell) + 1;
    const depth = Math.ceil((maxZ - minZ + 2 * margin) / cell) + 1;
    const lightSum = new Float32Array(width * depth); // all lamp light per cell (same falloff as the pools)
    const blocked = new Float32Array(width * depth); // lamp light blocked by trees
    const stampLamp = new Int32Array(width * depth).fill(-1); // per lamp: the most coverage so far
    const stampValue = new Float32Array(width * depth);
    const h2 = lampHeight * lampHeight;
    const lampWeight = (lx, lz, k) => {
        const tx = k % width, tz = (k / width) | 0;
        const dx = lx - (originX + tx * cell), dz = lz - (originZ + tz * cell);
        return Math.pow(1 + (dx * dx + dz * dz) / h2, -1.5);
    };

    // Trees by grid bucket, to find the ones near a lamp quickly.
    const bucket = 16;
    const buckets = new Map();
    for (const tree of trees) {
        const key = `${Math.floor(tree.x / bucket)},${Math.floor(tree.z / bucket)}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(tree);
    }

    const reachCells = Math.ceil(REACH / cell);
    for (let i = 0; i < count; i++) {
        const lx = heads[i * 3], ly = heads[i * 3 + 1], lz = heads[i * 3 + 2];
        const cx = Math.round((lx - originX) / cell), cz = Math.round((lz - originZ) / cell);
        // This lamp's light on the ground (the denominator).
        for (let tz = Math.max(0, cz - reachCells); tz <= Math.min(depth - 1, cz + reachCells); tz++) {
            for (let tx = Math.max(0, cx - reachCells); tx <= Math.min(width - 1, cx + reachCells); tx++) {
                const dx = lx - (originX + tx * cell), dz = lz - (originZ + tz * cell);
                const d2 = dx * dx + dz * dz;
                if (d2 <= REACH * REACH) lightSum[tz * width + tx] += Math.pow(1 + d2 / h2, -1.5);
            }
        }
        // Shadow of each nearby tree: trunk and three crown discs, projected from the lamp.
        const stamp = (px, pz, r, strength) => {
            const r2 = r * r;
            const x0 = Math.max(0, Math.floor((px - r - originX) / cell)), x1 = Math.min(width - 1, Math.ceil((px + r - originX) / cell));
            const z0 = Math.max(0, Math.floor((pz - r - originZ) / cell)), z1 = Math.min(depth - 1, Math.ceil((pz + r - originZ) / cell));
            for (let tz = z0; tz <= z1; tz++) {
                for (let tx = x0; tx <= x1; tx++) {
                    const dx = originX + tx * cell - px, dz = originZ + tz * cell - pz;
                    const d2 = dx * dx + dz * dz;
                    if (d2 >= r2) continue;
                    // Soft edge (penumbra) over the outer third.
                    const edge = Math.min(1, (1 - Math.sqrt(d2) / r) * 3);
                    const coverage = strength * edge;
                    const k = tz * width + tx;
                    if (stampLamp[k] !== i) {
                        stampLamp[k] = i;
                        stampValue[k] = coverage;
                        blocked[k] += lampWeight(lx, lz, k) * coverage;
                    } else if (coverage > stampValue[k]) {
                        blocked[k] += lampWeight(lx, lz, k) * (coverage - stampValue[k]);
                        stampValue[k] = coverage;
                    }
                }
            }
        };
        const project = (tree, heightAbove, radius, strength) => {
            const ground = tree.base;
            const lampAbove = ly - ground;
            if (lampAbove <= 0.5) return;
            const h = Math.min(heightAbove, lampAbove - 0.5);
            const stretch = Math.min(lampAbove / (lampAbove - h), MAX_STRETCH);
            stamp(lx + (tree.x - lx) * stretch, lz + (tree.z - lz) * stretch, radius * stretch, strength);
        };
        const b0x = Math.floor((lx - REACH) / bucket), b1x = Math.floor((lx + REACH) / bucket);
        const b0z = Math.floor((lz - REACH) / bucket), b1z = Math.floor((lz + REACH) / bucket);
        for (let bx = b0x; bx <= b1x; bx++) {
            for (let bz = b0z; bz <= b1z; bz++) {
                for (const tree of buckets.get(`${bx},${bz}`) || []) {
                    const d = Math.hypot(tree.x - lx, tree.z - lz);
                    if (d > REACH || d < 0.8) continue;
                    const H = tree.height, R = Math.max(tree.radius, 0.6);
                    // Trunk: a row of small discs from the foot up to the crown.
                    for (let t = 0.05; t < 0.35; t += 0.06) project(tree, H * t, 0.18, 0.9);
                    // Crown (pine-like: wide low, narrow high), a little see-through.
                    project(tree, H * 0.4, R * 0.85, 0.75);
                    project(tree, H * 0.6, R * 0.65, 0.75);
                    project(tree, H * 0.8, R * 0.4, 0.7);
                }
            }
        }
    }

    const data = new Uint8Array(width * depth);
    for (let k = 0; k < data.length; k++) {
        if (blocked[k] > 0 && lightSum[k] > 0) data[k] = Math.round(255 * Math.min(1, blocked[k] / lightSum[k]));
    }
    const texture = new THREE.DataTexture(data, width, depth, THREE.RedFormat, THREE.UnsignedByteType);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    texture.userData = { bakeMs: performance.now() - startedAt, trees: trees.length, size: [width, depth] };
    lampShadowUniforms.uLampShadow.value = texture;
    lampShadowUniforms.uLampShadowOrigin.value.set(originX, originZ);
    lampShadowUniforms.uLampShadowSize.value.set(width * cell, depth * cell);
    lampShadowUniforms.uLampShadowOn.value = 1;
    old?.dispose();
}
