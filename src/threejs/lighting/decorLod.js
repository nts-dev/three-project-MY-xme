import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshoptSimplifier } from "meshoptimizer";

// Far level of detail for street decor (DecorCulling): a simplified copy of a model's geometry with
// the same attributes, material groups and materials, so its shaders (wind sway, lamp light) and
// look carry over and no new shader program is compiled. Built once per source geometry, in the
// background; until it is ready the full model is drawn.

const cache = new WeakMap(); // source geometry -> Promise<BufferGeometry | null>
const weldCache = new WeakMap(); // source geometry -> welded copy (or the source)

const triangles = (geometry) => (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;

const copyBounds = (from, to) => {
    if (!from.boundingBox) from.computeBoundingBox();
    if (!from.boundingSphere) from.computeBoundingSphere();
    to.boundingBox = from.boundingBox.clone();
    to.boundingSphere = from.boundingSphere.clone();
};

/**
 * The same model with identical corners shared (same position, normal and uv): it looks exactly the
 * same, but exported decor is often unwelded (a pine: 25k vertices for 8k triangles), and each
 * vertex runs the vertex shader (wind sway) once instead of up to six times. The source when
 * welding saves little.
 */
export function weldedGeometry(geometry) {
    if (weldCache.has(geometry)) return weldCache.get(geometry);
    let result = geometry;
    if (!Object.values(geometry.attributes).some((a) => a.isInterleavedBufferAttribute) && !Object.keys(geometry.morphAttributes).length) {
        const welded = mergeVertices(geometry, 1e-5);
        if (welded.attributes.position.count < geometry.attributes.position.count * 0.8) {
            copyBounds(geometry, welded);
            welded.name = `${geometry.name || "decor"}:welded`;
            result = welded;
        } else {
            welded.dispose();
        }
    }
    weldCache.set(geometry, result);
    return result;
}

/**
 * Simplified copy of `geometry`. `groups[materialIndex]` = { ratio, error }: the share of triangles to
 * keep (at most) and the allowed error as a fraction of the model size; materials not listed use
 * `fallback`. Resolves to null when it cannot be built (or saves too little).
 */
export function farGeometry(geometry, groups = {}, fallback = { ratio: 0.2, error: 0.02 }) {
    if (!cache.has(geometry)) {
        cache.set(geometry, build(geometry, groups, fallback).catch((error) => {
            console.warn("[decorLod] far model not built", error);
            return null;
        }));
    }
    return cache.get(geometry);
}

async function build(geometry, groups, fallback) {
    await MeshoptSimplifier.ready;
    if (Object.values(geometry.attributes).some((a) => a.isInterleavedBufferAttribute)) return null;
    // Exported models are often unwelded (each triangle its own corners): weld identical corners
    // (same position, normal and uv) so the simplifier sees connected surfaces.
    const welded = mergeVertices(geometry, 1e-4);
    if (!welded.index) return null;
    const positions = welded.attributes.position.array;
    const source = new Uint32Array(welded.index.array);
    const ranges = welded.groups.length ? welded.groups : [{ start: 0, count: source.length, materialIndex: 0 }];
    const index = [];
    const outGroups = [];
    for (const group of ranges) {
        const { ratio, error } = groups[group.materialIndex ?? 0] || fallback;
        const slice = source.subarray(group.start, group.start + group.count);
        const target = Math.max(3, Math.floor((slice.length * ratio) / 3) * 3);
        let [result] = MeshoptSimplifier.simplify(slice, positions, 3, target, error, []);
        if (!result.length) result = slice;
        outGroups.push({ start: index.length, count: result.length, materialIndex: group.materialIndex ?? 0 });
        for (let i = 0; i < result.length; i++) index.push(result[i]);
    }
    if (index.length / 3 > triangles(geometry) * 0.7) return null; // not worth a second model

    // Only the vertices still used, so the far model is small on the GPU too.
    const remap = new Int32Array(welded.attributes.position.count).fill(-1);
    let used = 0;
    for (let i = 0; i < index.length; i++) {
        if (remap[index[i]] === -1) remap[index[i]] = used++;
        index[i] = remap[index[i]];
    }
    const far = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(welded.attributes)) {
        const size = attribute.itemSize;
        const array = new attribute.array.constructor(used * size);
        for (let v = 0; v < remap.length; v++) {
            if (remap[v] === -1) continue;
            for (let c = 0; c < size; c++) array[remap[v] * size + c] = attribute.array[v * size + c];
        }
        far.setAttribute(name, new THREE.BufferAttribute(array, size, attribute.normalized));
    }
    far.setIndex(new THREE.BufferAttribute(used > 65535 ? Uint32Array.from(index) : Uint16Array.from(index), 1));
    outGroups.forEach((g) => far.addGroup(g.start, g.count, g.materialIndex));
    copyBounds(geometry, far); // same bounds as the full model, so culling treats both alike
    far.name = `${geometry.name || "decor"}:far`;
    far.userData.sourceTriangles = triangles(geometry);
    return far;
}
