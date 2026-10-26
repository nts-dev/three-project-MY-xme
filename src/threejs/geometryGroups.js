import * as THREE from "three";

// FBXLoader emits one geometry group per contiguous run of faces that share a
// material, so a model with 20 materials can end up with thousands of groups.
// Every group is a separate draw call (per InstancedMesh, per frame). Reordering
// the index so each material's faces are contiguous renders the same image with
// one group per material.
export const consolidateGeometryGroups = (geometry) => {
    if (!geometry?.isBufferGeometry || geometry.userData.groupsConsolidated) {
        return geometry;
    }

    const groups = geometry.groups;
    const materialIndices = new Set(groups.map((group) => group.materialIndex ?? 0));
    if (groups.length <= materialIndices.size) {
        geometry.userData.groupsConsolidated = true;
        return geometry;
    }

    const source = geometry.index ? geometry.index.array : null;
    const totalCount = source ? source.length : geometry.attributes.position.count;
    const vertexCount = geometry.attributes.position.count;
    const IndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array;
    const target = new IndexArray(totalCount);

    const byMaterial = new Map();
    groups.forEach((group) => {
        const materialIndex = group.materialIndex ?? 0;
        if (!byMaterial.has(materialIndex)) byMaterial.set(materialIndex, []);
        byMaterial.get(materialIndex).push(group);
    });

    geometry.clearGroups();
    let offset = 0;
    [...byMaterial.keys()].sort((a, b) => a - b).forEach((materialIndex) => {
        const start = offset;
        byMaterial.get(materialIndex).forEach(({ start: groupStart, count }) => {
            const end = Math.min(groupStart + count, totalCount);
            for (let i = groupStart; i < end; i++) {
                target[offset++] = source ? source[i] : i;
            }
        });
        geometry.addGroup(start, offset - start, materialIndex);
    });

    geometry.setIndex(new THREE.BufferAttribute(offset === totalCount ? target : target.slice(0, offset), 1));
    geometry.userData.groupsConsolidated = true;
    return geometry;
};

export const consolidateObjectGeometryGroups = (object) => {
    object?.traverse?.((child) => {
        if (child.isMesh && Array.isArray(child.material)) {
            consolidateGeometryGroups(child.geometry);
        }
    });
    return object;
};
