import * as THREE from 'three';

// Keep the original mesh/index API used by selection and editing. Small child
// batches share its geometry/materials, but get independent frustum bounds.
export function enableSpatialInstanceCulling(source, cellSize = 16) {
    if (source.userData.spatialInstanceCulling || source.count < 2) return;
    const matrix = new THREE.Matrix4();
    const cells = new Map();
    const routes = [];
    const batches = [];
    for (let index = 0; index < source.count; index++) {
        source.getMatrixAt(index, matrix);
        const key = `${Math.floor(matrix.elements[12] / cellSize)},${Math.floor(matrix.elements[14] / cellSize)}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(index);
    }
    for (const indices of cells.values()) {
        const batch = new THREE.InstancedMesh(source.geometry, source.material, indices.length);
        batch.name = `${source.name}:spatial`;
        batch.layers = source.layers;
        batch.castShadow = source.castShadow;
        batch.receiveShadow = source.receiveShadow;
        batch.renderOrder = source.renderOrder;
        batch.matrixAutoUpdate = false;
        indices.forEach((originalIndex, localIndex) => {
            source.getMatrixAt(originalIndex, matrix);
            batch.setMatrixAt(localIndex, matrix);
            if (source.instanceColor) {
                const color = new THREE.Color();
                source.getColorAt(originalIndex, color);
                batch.setColorAt(localIndex, color);
            }
            routes[originalIndex] = { batch, localIndex };
        });
        batch.computeBoundingSphere();
        // Hits keep the original object and index, including after transforms.
        const raycast = batch.raycast;
        batch.raycast = function (raycaster, hits) {
            const start = hits.length;
            raycast.call(this, raycaster, hits);
            for (let i = start; i < hits.length; i++) {
                hits[i].instanceId = indices[hits[i].instanceId];
                hits[i].object = source;
            }
        };
        source.add(batch);
        batches.push(batch);
    }

    const setMatrixAt = source.setMatrixAt;
    source.setMatrixAt = function (index, value) {
        setMatrixAt.call(this, index, value);
        const route = routes[index];
        if (!route) return;
        route.batch.setMatrixAt(route.localIndex, value);
        route.batch.instanceMatrix.needsUpdate = true;
        route.batch.boundingBox = null;
        route.batch.boundingSphere = null;
    };
    const setColorAt = source.setColorAt;
    source.setColorAt = function (index, color) {
        setColorAt.call(this, index, color);
        const route = routes[index];
        if (!route) return;
        route.batch.setColorAt(route.localIndex, color);
        route.batch.instanceColor.needsUpdate = true;
    };

    // Drawing is delegated to the children; restore count immediately after each
    // draw so bounds, raycasts, and editor tools retain the full logical mesh.
    let logicalCount = source.count;
    source.onBeforeRender = () => {
        logicalCount = source.count;
        source.count = 0;
    };
    source.onAfterRender = () => { source.count = logicalCount; };
    source.onBeforeShadow = source.onBeforeRender;
    source.onAfterShadow = source.onAfterRender;
    // Support both direct and recursive queries without testing children twice.
    source.raycast = (raycaster, hits) => {
        for (const batch of batches) batch.raycast(raycaster, hits);
        return false;
    };
    source.userData.spatialInstanceCulling = true;
    return batches;
}
