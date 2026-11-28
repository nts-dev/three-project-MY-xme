import { Box3, Vector3 } from "three";
import { farGeometry } from "./decorLod";

const lodByScene = new WeakMap();
const lodByBatch = new WeakMap();
const worldBounds = new Box3();
const cameraPosition = new Vector3();
// Separate thresholds keep the mesh from switching repeatedly at the boundary.
const NEAR_DISTANCE = 55;
const FAR_DISTANCE = 65;

export async function prepareBuildingLod(container, batches, geometry) {
    // Models are loaded into category groups below the renderer's scene.
    let scene = container;
    while (scene.parent) scene = scene.parent;
    if (!scene.isScene) return;
    const far = await farGeometry(geometry, {}, { ratio: 0.25, error: 0.0025 });
    if (!far) return;

    let entries = lodByScene.get(scene);
    if (!entries) lodByScene.set(scene, entries = new Set());
    for (const batch of batches) {
        const entry = { batch, near: geometry, far, usingFar: false };
        lodByBatch.set(batch, entry);
        entries.add(entry);
        batch.addEventListener("dispose", () => {
            entries.delete(entry);
            lodByBatch.delete(batch);
            // Office lighting can wrap the shared geometry with a batch-owned attribute.
            if (entry.near !== geometry) entry.near.dispose();
            if (entry.far !== far) entry.far.dispose();
        });
    }
}

// Office lighting adds the same instance attribute to each version of a batch.
export function mapBuildingLodGeometries(batch, transform) {
    const entry = lodByBatch.get(batch);
    if (!entry) {
        batch.geometry = transform(batch.geometry);
        return;
    }
    entry.near = transform(entry.near);
    entry.far = transform(entry.far);
    batch.geometry = entry.usingFar ? entry.far : entry.near;
}

export function updateBuildingLod(scene, camera) {
    const entries = lodByScene.get(scene);
    if (!entries?.size) return;
    camera.getWorldPosition(cameraPosition);
    const zoom = camera.zoom;

    for (const entry of entries) {
        const { batch, usingFar } = entry;
        const source = batch.parent;
        if (!source?.parent) {
            entries.delete(entry);
            continue;
        }
        if (!source.visible || !batch.visible) continue;
        if (!batch.boundingBox) batch.computeBoundingBox();
        batch.updateWorldMatrix(true, false);
        const distance = worldBounds.copy(batch.boundingBox).applyMatrix4(batch.matrixWorld).distanceToPoint(cameraPosition);
        const useFar = distance > (usingFar ? NEAR_DISTANCE : FAR_DISTANCE) * zoom;
        if (useFar === usingFar) continue;
        entry.usingFar = useFar;
        batch.geometry = useFar ? entry.far : entry.near;
    }
}
