import * as THREE from 'three';

// Building facades face local +Z, rotated by their placement angle.
export function getBuildingSearchView(asset, camera) {
    const mesh = asset.instance;
    if (!mesh?.geometry || !Number.isInteger(asset.index)) return null;
    mesh.geometry.computeBoundingBox();
    if (!mesh.geometry.boundingBox || mesh.geometry.boundingBox.isEmpty()) return null;

    mesh.updateWorldMatrix(true, false);
    const placement = new THREE.Matrix4();
    mesh.getMatrixAt(asset.index, placement);
    placement.premultiply(mesh.matrixWorld);
    const rotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(Number(asset.angle) || 0)
    );
    const origin = new THREE.Vector3().setFromMatrixPosition(placement);
    const facadeFrame = new THREE.Matrix4().compose(origin, rotation, new THREE.Vector3(1, 1, 1));
    const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(
        facadeFrame.clone().invert().multiply(placement)
    );
    const size = bounds.getSize(new THREE.Vector3());
    const target = bounds.getCenter(new THREE.Vector3());
    target.z = bounds.max.z;
    target.applyMatrix4(facadeFrame);

    const verticalFov = THREE.MathUtils.degToRad(camera.fov || 50);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * (camera.aspect || 1));
    const elevation = THREE.MathUtils.degToRad(20);
    // Leave space for the roof, pavement, and search control above the facade.
    const distance = Math.max(
        size.y / (2 * Math.tan(verticalFov / 2)),
        size.x / (2 * Math.tan(horizontalFov / 2)),
        0.5
    ) * 1.35;
    const offset = new THREE.Vector3(0, Math.sin(elevation), Math.cos(elevation))
        .applyQuaternion(rotation).multiplyScalar(distance);
    return { target, position: target.clone().add(offset) };
}
