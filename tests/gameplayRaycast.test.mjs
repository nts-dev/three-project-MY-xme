import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import * as THREE from 'three';

const source = readFileSync(new URL('../src/threejs/player/gameplayRaycast.ts', import.meta.url), 'utf8');
const compiled = stripTypeScriptTypes(source).replace('"three"', JSON.stringify(import.meta.resolve('three')));
const { createGameplayRaycast } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('indexed queries preserve Three raycast hits and invalidate changed instances', () => {
    let seed = 12345;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const query = createGameplayRaycast();
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const targets = [300, 20].map(count => new THREE.InstancedMesh(new THREE.BoxGeometry(1, 2, 1), material, count));
    const matrix = new THREE.Matrix4();
    for (const target of targets) {
        for (let id = 0; id < target.count; id++) {
            matrix.compose(
                new THREE.Vector3((random() - 0.5) * 50, random() * 5, (random() - 0.5) * 50),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(0, random() * 6, 0)),
                new THREE.Vector3(0.5 + random() * 2, 0.5 + random(), 0.5 + random())
            );
            target.setMatrixAt(id, matrix);
        }
        target.instanceMatrix.needsUpdate = true;
        target.position.set(2, 0, -3);
        target.rotation.y = 0.3;
        target.scale.set(1.2, 0.8, 1.5);
        target.updateMatrixWorld(true);
    }
    const ray = new THREE.Raycaster();
    let hitCount = 0;
    const check = () => {
        const expected = ray.intersectObjects(targets, false)[0];
        const actual = query(ray, targets);
        assert.equal(Boolean(actual), Boolean(expected));
        if (!expected) return;
        hitCount++;
        assert.equal(actual.object, expected.object);
        assert.equal(actual.instanceId, expected.instanceId);
        assert.ok(Math.abs(actual.distance - expected.distance) < 1e-8);
        assert.ok(actual.point.distanceTo(expected.point) < 1e-8);
        assert.ok(actual.face.normal.distanceTo(expected.face.normal) < 1e-8);
    };
    for (let index = 0; index < 1500; index++) {
        ray.set(
            new THREE.Vector3((random() - 0.5) * 60, random() * 8, (random() - 0.5) * 60),
            new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize()
        );
        ray.near = random() * 0.1;
        ray.far = 0.5 + random() * 40;
        check();
        if (index === 750) {
            targets[0].setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 1, 0));
            targets[0].instanceMatrix.needsUpdate = true;
            targets[0].computeBoundingSphere();
        }
    }
    // Identical instances check stable tie ordering as well as count invalidation.
    for (const target of targets) {
        target.count = 12;
        for (let id = 0; id < 12; id++) target.setMatrixAt(id, new THREE.Matrix4());
        target.instanceMatrix.needsUpdate = true;
        target.computeBoundingSphere();
    }
    ray.set(new THREE.Vector3(2, 0, 10), new THREE.Vector3(0, 0, -1));
    ray.near = 0;
    ray.far = 100;
    check();
    targets[0].geometry = new THREE.BoxGeometry(3, 3, 3);
    targets[0].computeBoundingSphere();
    check();
    targets[0].layers.set(2);
    check();
    assert.ok(hitCount > 20, 'exercise successful hits as well as misses');
});
