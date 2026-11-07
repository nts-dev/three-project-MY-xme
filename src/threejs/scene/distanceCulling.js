import { Sphere, Vector3 } from "three";

// Distance culling for very large scenes (project 153's city). Frustum culling already skips
// cells outside the view; this also hides cells inside the view that are far from the camera,
// which is where low, street-level views spend most of their time.
// The limit grows with camera height so the zoomed-out overview still shows the whole map.
const BASE_DISTANCE = 800; // scene units, at street level
const HEIGHT_FACTOR = 4; // added per unit of camera height
// Hide only past limit * (1 + margin) once visible, so cells at the edge do not flicker.
const HYSTERESIS = 0.05;

const meshes = new Set();
const sphere = new Sphere();
const cameraPosition = new Vector3();

const isInScene = (object) => {
    let root = object;
    while (root.parent) root = root.parent;
    return Boolean(root.isScene);
};

/** Puts an instanced cell mesh under distance culling. Hidden cells also ignore raycasts (clicks). */
export function registerDistanceCulledMesh(mesh) {
    const raycast = mesh.raycast;
    mesh.raycast = function (raycaster, intersects) {
        if (this.userData.distanceCulled) return;
        raycast.call(this, raycaster, intersects);
    };
    meshes.add(mesh);
}

/** Call once per frame, before rendering. */
export function updateDistanceCulling(camera) {
    if (!meshes.size) return;
    camera.getWorldPosition(cameraPosition);
    const limit = BASE_DISTANCE + HEIGHT_FACTOR * Math.max(cameraPosition.y, 0);

    for (const mesh of meshes) {
        if (!isInScene(mesh)) {
            // Its category was removed or reloaded; a mesh not yet added is kept for later.
            if (mesh.userData.distanceCullSeen) meshes.delete(mesh);
            continue;
        }
        mesh.userData.distanceCullSeen = true;

        if (mesh.boundingSphere === null) mesh.computeBoundingSphere();
        sphere.copy(mesh.boundingSphere).applyMatrix4(mesh.matrixWorld);
        const distance = sphere.distanceToPoint(cameraPosition);
        const wasCulled = Boolean(mesh.userData.distanceCulled);
        const culled = distance > limit * (wasCulled ? 1 : 1 + HYSTERESIS);
        if (culled !== wasCulled) {
            mesh.userData.distanceCulled = culled;
            mesh.visible = !culled;
        }
    }
}
