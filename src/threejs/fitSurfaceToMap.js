import { Matrix4, Vector3 } from "three";

function clearArea(geometry, matrix, [minX, minZ, maxX, maxZ]) {
    const position = geometry.attributes.position;
    const originalIndex = geometry.getIndex();
    const groups = geometry.groups.length ? geometry.groups : [
        { start: 0, count: originalIndex?.count ?? position.count, materialIndex: 0 },
    ];
    const indices = [];
    const vertex = new Vector3();
    const center = new Vector3();
    geometry.clearGroups();

    for (const { start, count, materialIndex } of groups) {
        const groupStart = indices.length;
        for (let i = start; i + 2 < start + count; i += 3) {
            const a = originalIndex?.getX(i) ?? i;
            const b = originalIndex?.getX(i + 1) ?? i + 1;
            const c = originalIndex?.getX(i + 2) ?? i + 2;
            center.fromBufferAttribute(position, a)
                .add(vertex.fromBufferAttribute(position, b))
                .add(vertex.fromBufferAttribute(position, c))
                .multiplyScalar(1 / 3).applyMatrix4(matrix);
            if (center.x < minX || center.x > maxX || center.z < minZ || center.z > maxZ) {
                indices.push(a, b, c);
            }
        }
        geometry.addGroup(groupStart, indices.length - groupStart, materialIndex);
    }
    geometry.setIndex(indices);
}

// The surveyed vertices are in world space. Bake them in the model's saved pose
// so an instance still responds normally to later scene edits.
export function fitSurfaceToMap(geometry, { reference, vertices, clearance }) {
    const matrix = new Matrix4().fromArray(reference);
    const inverse = matrix.clone().invert();
    const fitted = geometry.clone();
    const position = fitted.attributes.position;
    const point = new Vector3();

    for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(matrix);
        let nearest;
        let distanceSq = 0.02 ** 2;
        for (const vertex of vertices) {
            const [x, z] = vertex;
            const delta = (x - point.x) ** 2 + (z - point.z) ** 2;
            if (delta < distanceSq) {
                nearest = vertex;
                distanceSq = delta;
            }
        }
        if (nearest) {
            const [, , x, y, z] = nearest;
            point.set(x, y, z).applyMatrix4(inverse);
            position.setXYZ(i, point.x, point.y, point.z);
        }
    }

    if (clearance) clearArea(fitted, matrix, clearance);
    fitted.computeVertexNormals();
    fitted.computeBoundingBox();
    fitted.computeBoundingSphere();
    return fitted;
}
