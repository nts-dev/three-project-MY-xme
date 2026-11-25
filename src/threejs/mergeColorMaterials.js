import * as THREE from "three";

// Fewer draw calls for multi-material models: materials that differ only in colour (no textures, not
// transparent, same lighting setup) are merged into one material that takes its colour from the
// vertices. Each remaining material is one draw call per (instanced) mesh, so an estate unit with
// 20 materials, 12 of them plain colours, drops to 10 draw calls per batch.
// The result is a new geometry (the index reordered so each merged material is one range, plus a
// vertex colour attribute); the source geometry and materials are left untouched.

const TEXTURE_SLOTS = ["map", "alphaMap", "normalMap", "bumpMap", "emissiveMap", "specularMap", "aoMap", "lightMap", "displacementMap", "envMap"];

function mergeKey(material) {
    if (!material || material.transparent || material.alphaTest > 0 || material.vertexColors) return null;
    if (TEXTURE_SLOTS.some((slot) => material[slot])) return null;
    return [
        material.type,
        material.side,
        material.flatShading ? 1 : 0,
        material.emissive?.getHexString() ?? "",
        material.emissiveIntensity ?? 1,
        material.wireframe ? 1 : 0,
        JSON.stringify(material.userData?.originalGameplayCollisionSide ?? null),
    ].join("|");
}

/** Returns { geometry, materials } with plain-colour materials merged, or null when nothing merges. */
export function mergeColorMaterials(geometry, materials) {
    if (!Array.isArray(materials) || !geometry.index || !geometry.groups.length) return null;
    if (Object.values(geometry.attributes).some((a) => a.isInterleavedBufferAttribute) || Object.keys(geometry.morphAttributes).length) return null;
    const keys = materials.map(mergeKey);
    const buckets = new Map(); // key -> material indices
    keys.forEach((key, i) => {
        if (!key) return;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(i);
    });
    const merging = [...buckets.values()].filter((list) => list.length > 1);
    if (!merging.length) return null;

    // Per-vertex colour. A vertex used by materials of different colours is copied (one copy per
    // colour), so every triangle keeps its own material's colour.
    const sourceIndex = geometry.index;
    const vertexCount = geometry.attributes.position.count;
    const indexValues = Array.from(sourceIndex.array);
    const owner = new Int32Array(vertexCount).fill(-1); // material whose colour the vertex has
    const extra = []; // copies: source vertex
    const extraColor = []; // copies: material index
    const copies = new Map(); // `${vertex}|${material}` -> copied vertex index
    const mergedOf = new Map(); // material index -> bucket number
    merging.forEach((list, b) => list.forEach((m) => mergedOf.set(m, b)));
    const sameColor = (a, b) => a === b || materials[a].color.equals(materials[b].color);
    for (const group of geometry.groups) {
        const m = group.materialIndex;
        const merged = mergedOf.has(m);
        for (let i = group.start; i < group.start + group.count; i++) {
            const v = indexValues[i];
            if (owner[v] === -1) {
                owner[v] = merged ? m : -2; // -2: used by an unmerged (textured) material, colour unused
                continue;
            }
            if (!merged || owner[v] === -2 || sameColor(owner[v], m)) {
                if (merged && owner[v] === -2) owner[v] = m; // textured materials ignore vertex colour
                continue;
            }
            const key = `${v}|${m}`;
            let copy = copies.get(key);
            if (copy === undefined) {
                copy = vertexCount + extra.length;
                copies.set(key, copy);
                extra.push(v);
                extraColor.push(m);
            }
            indexValues[i] = copy;
        }
    }
    const totalVertices = vertexCount + extra.length;
    const colors = new Float32Array(totalVertices * 3).fill(1);
    for (let v = 0; v < vertexCount; v++) {
        if (owner[v] < 0) continue;
        const c = materials[owner[v]].color;
        colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b;
    }
    extra.forEach((_, k) => {
        const c = materials[extraColor[k]].color;
        const v = vertexCount + k;
        colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b;
    });

    // New material list: unmerged ones as they are, one vertex-coloured material per merged bucket.
    const newMaterials = [];
    const target = new Map(); // old material index -> new material index
    materials.forEach((material, i) => {
        if (mergedOf.has(i)) return;
        target.set(i, newMaterials.length);
        newMaterials.push(material);
    });
    merging.forEach((list) => {
        const first = materials[list[0]];
        const merged = first.clone();
        merged.name = `merged(${list.map((i) => materials[i].name).join(", ")})`;
        merged.vertexColors = true;
        merged.color = new THREE.Color(1, 1, 1);
        // Shine: the average (small parts; the difference does not show).
        if ("shininess" in merged) merged.shininess = list.reduce((sum, i) => sum + (materials[i].shininess ?? 30), 0) / list.length;
        if (merged.specular) {
            merged.specular = new THREE.Color(0, 0, 0);
            list.forEach((i) => merged.specular.add(materials[i].specular || new THREE.Color(0x111111)));
            merged.specular.multiplyScalar(1 / list.length);
        }
        merged.userData = { ...first.userData };
        delete merged.userData.lampMap; // patched again on the new material
        const n = newMaterials.length;
        list.forEach((i) => target.set(i, n));
        newMaterials.push(merged);
    });

    // Index reordered so every new material is one contiguous range (one draw call).
    const ranges = newMaterials.map(() => []);
    for (const group of geometry.groups) ranges[target.get(group.materialIndex)].push(group);
    const IndexArray = totalVertices > 65535 ? Uint32Array : sourceIndex.array.constructor;
    const newIndex = new IndexArray(sourceIndex.count);
    const groups = [];
    let offset = 0;
    ranges.forEach((list, materialIndex) => {
        const start = offset;
        for (const group of list) {
            for (let i = group.start; i < group.start + group.count; i++) newIndex[offset++] = indexValues[i];
        }
        if (offset > start) groups.push({ start, count: offset - start, materialIndex });
    });

    const result = geometry.clone();
    if (extra.length) {
        // Append the copied vertices to every attribute.
        for (const name of Object.keys(result.attributes)) {
            const attribute = result.attributes[name];
            const size = attribute.itemSize;
            const array = new attribute.array.constructor(totalVertices * size);
            array.set(attribute.array.subarray(0, vertexCount * size));
            extra.forEach((v, k) => {
                for (let c = 0; c < size; c++) array[(vertexCount + k) * size + c] = attribute.array[v * size + c];
            });
            result.setAttribute(name, new THREE.BufferAttribute(array, size, attribute.normalized));
        }
    }
    result.setIndex(new THREE.BufferAttribute(newIndex, 1));
    result.clearGroups();
    groups.forEach((g) => result.addGroup(g.start, g.count, g.materialIndex));
    result.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return { geometry: result, materials: newMaterials };
}
