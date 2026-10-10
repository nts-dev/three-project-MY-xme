import * as THREE from 'three';

const getMaterialSignature = (material) => {
    // Custom shaders and clipping can depend on state outside serialized values.
    if (material.isShaderMaterial || material.isNodeMaterial || material.clippingPlanes?.length
        || material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile
        || material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) return null;
    const data = material.toJSON();
    for (const key of ['uuid', 'name', 'metadata', 'userData', 'textures', 'images']) delete data[key];
    return JSON.stringify(data);
};

// FBX files can contain thousands of separate groups using the same material.
// Each group is a draw call, even on an InstancedMesh. Reorder opaque triangles
// into one contiguous group per material without changing vertices or UVs.
export function mergeOpaqueGeometryGroups(geometry, materials) {
    if (!Array.isArray(materials) || geometry.groups.length < 2
        || materials.some((material) => !material || material.transparent)
        || geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) return geometry;
    const count = geometry.index?.count ?? geometry.attributes.position?.count;
    if (!count) return geometry;
    const groups = [...geometry.groups].sort((a, b) => a.start - b.start);
    const buckets = new Map();
    const signatures = new Map();
    const canonicalIndices = new Map();
    let end = 0;
    for (const group of groups) {
        if (group.start !== end || group.count % 3 !== 0 || group.count < 0
            || !Number.isInteger(group.materialIndex) || !materials[group.materialIndex]) return geometry;
        end += group.count;
        if (!canonicalIndices.has(group.materialIndex)) {
            const signature = getMaterialSignature(materials[group.materialIndex]);
            const canonicalIndex = signature !== null && signatures.has(signature)
                ? signatures.get(signature) : group.materialIndex;
            canonicalIndices.set(group.materialIndex, canonicalIndex);
            if (signature !== null) signatures.set(signature, canonicalIndex);
        }
        const canonicalIndex = canonicalIndices.get(group.materialIndex);
        if (!buckets.has(canonicalIndex)) buckets.set(canonicalIndex, []);
        buckets.get(canonicalIndex).push(group);
    }
    if (end !== count || buckets.size === groups.length) return geometry;
    const index = new Uint32Array(count);
    const result = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) result.setAttribute(name, attribute);
    result.morphAttributes = geometry.morphAttributes;
    result.morphTargetsRelative = geometry.morphTargetsRelative;
    result.boundingBox = geometry.boundingBox?.clone() ?? null;
    result.boundingSphere = geometry.boundingSphere?.clone() ?? null;
    let offset = 0;
    for (const [materialIndex, materialGroups] of buckets) {
        const start = offset;
        for (const group of materialGroups) {
            for (let i = group.start; i < group.start + group.count; i++) {
                index[offset++] = geometry.index ? geometry.index.getX(i) : i;
            }
        }
        result.addGroup(start, offset - start, materialIndex);
    }
    result.setIndex(new THREE.BufferAttribute(index, 1));
    return result;
}
