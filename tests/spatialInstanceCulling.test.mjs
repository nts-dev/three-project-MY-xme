import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { enableSpatialInstanceCulling } from '../src/threejs/spatialInstanceCulling.js';

test('spatial batches preserve direct/recursive selection, indices, and transforms', () => {
    const source = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial(), 12);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < source.count; index++) source.setMatrixAt(index, matrix.makeTranslation(index * 20, 0, 0));
    source.position.set(3, 4, -2);
    source.rotation.y = 0.2;
    source.scale.set(1.1, 1.3, 0.8);
    source.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(source.matrixWorld);
    const expected = [];
    for (let index = 0; index < source.count; index++) {
        origin.set(index * 20, 0, 10).applyMatrix4(source.matrixWorld);
        ray.set(origin, direction);
        expected.push(ray.intersectObject(source, false));
    }
    const batches = enableSpatialInstanceCulling(source);
    source.updateMatrixWorld(true);
    assert.equal(batches.length, 12);
    for (let index = 0; index < source.count; index++) {
        origin.set(index * 20, 0, 10).applyMatrix4(source.matrixWorld);
        ray.set(origin, direction);
        for (const recursive of [false, true]) {
            const hits = ray.intersectObject(source, recursive);
            assert.equal(hits.length, expected[index].length, 'no duplicate parent/child hits');
            assert.equal(hits[0].object, source);
            assert.equal(hits[0].instanceId, index);
            assert.ok(hits[0].point.distanceTo(expected[index][0].point) < 1e-8);
            assert.ok(Math.abs(hits[0].distance - expected[index][0].distance) < 1e-8);
        }
    }
    source.setMatrixAt(7, matrix.makeTranslation(1000, 0, 0));
    source.instanceMatrix.needsUpdate = true;
    source.setColorAt(7, new THREE.Color('red'));
    origin.set(1000, 0, 10).applyMatrix4(source.matrixWorld);
    ray.set(origin, direction);
    assert.equal(ray.intersectObject(source, true)[0].instanceId, 7);
    const movedBatch = batches[7];
    assert.equal(movedBatch.boundingSphere.containsPoint(new THREE.Vector3(1000, 0, 0)), true);
    const color = new THREE.Color();
    movedBatch.getColorAt(0, color);
    assert.equal(color.getHexString(), 'ff0000');
    source.getMatrixAt(7, matrix);
    assert.equal(matrix.elements[12], 1000);
    assert.equal(source.count, 12);
    assert.equal(batches[0].geometry, source.geometry);
    assert.equal(batches[0].material, source.material);
    source.layers.set(2);
    assert.equal(batches[0].layers.mask, source.layers.mask);
    source.onBeforeRender();
    assert.equal(source.count, 0);
    source.onAfterRender();
    assert.equal(source.count, 12);
});

test('frustum rejects distant batches independently without removing geometry', () => {
    const source = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial(), 2);
    source.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, -10));
    source.setMatrixAt(1, new THREE.Matrix4().makeTranslation(500, 0, -10));
    source.computeBoundingSphere();
    const batches = enableSpatialInstanceCulling(source);
    source.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(camera.projectionMatrix);
    assert.equal(frustum.intersectsObject(source), true);
    assert.equal(frustum.intersectsObject(batches[0]), true);
    assert.equal(frustum.intersectsObject(batches[1]), false);
    assert.equal(source.count, 2);
});
