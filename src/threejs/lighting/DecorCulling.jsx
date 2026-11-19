import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import useGame from "../../hooks/useGame";

// Distance + view culling for street decor (pines ~25k vertices each, street lights ~15k): an
// InstancedMesh always draws every instance, so 224 pines cost ~1.9M triangles a frame even when only a
// handful are near. A companion InstancedMesh (same geometry and materials) draws only the instances
// within range and in front of the camera; the original stays in the scene, hidden, for picking and editing.

const DECOR = /PineTree|Tree0?\d|TrafficStreetLight/i;
const UPDATE_EVERY = 8; // frames
const SCAN_EVERY = 120;
const CHARACTER_RANGE = 170; // metres
const FREE_MIN_RANGE = 220;

const frustum = new THREE.Frustum();
const projScreen = new THREE.Matrix4();
const sphere = new THREE.Sphere();
const tmp = new THREE.Matrix4();

export default function DecorCulling({ orbitControls, enabled = true }) {
    const { scene, camera } = useThree();
    const state = useRef({ frame: 0, entries: new Map() });

    useEffect(() => {
        const s = state.current;
        return () => {
            for (const [mesh, entry] of s.entries) {
                entry.companion.removeFromParent();
                entry.companion.dispose();
                mesh.visible = true;
            }
            s.entries.clear();
        };
    }, []);

    useFrame(() => {
        if (!enabled) return;
        const s = state.current;
        s.frame += 1;

        if (s.frame % SCAN_EVERY === 1) {
            scene.traverse((o) => {
                if (!o.isInstancedMesh || o.userData.isCullCompanion || o.userData.isShadowProxy || o.count < 20 || !DECOR.test(o.name)) return;
                const signature = `${o.count}:${o.instanceMatrix.version}`;
                let entry = s.entries.get(o);
                if (!entry) {
                    const companion = new THREE.InstancedMesh(o.geometry, o.material, o.count);
                    companion.name = `${o.name}:near`;
                    companion.userData.isCullCompanion = true;
                    companion.castShadow = o.castShadow;
                    companion.receiveShadow = o.receiveShadow;
                    companion.frustumCulled = false;
                    companion.raycast = () => {};
                    companion.count = 0;
                    o.parent?.add(companion);
                    entry = { companion, signature: "", positions: null, radius: 1 };
                    s.entries.set(o, entry);
                }
                if (entry.signature !== signature) {
                    // World positions of all instances (and a bounding radius) for the culling test.
                    o.updateWorldMatrix(true, false);
                    o.geometry.computeBoundingSphere();
                    const positions = new Float32Array(o.count * 3);
                    let radius = 1;
                    for (let i = 0; i < o.count; i++) {
                        o.getMatrixAt(i, tmp);
                        tmp.premultiply(o.matrixWorld);
                        sphere.copy(o.geometry.boundingSphere).applyMatrix4(tmp);
                        positions.set([sphere.center.x, sphere.center.y, sphere.center.z], i * 3);
                        radius = Math.max(radius, sphere.radius);
                    }
                    entry.positions = positions;
                    entry.radius = radius;
                    entry.signature = signature;
                    entry.companion.position.copy(o.position);
                    entry.companion.quaternion.copy(o.quaternion);
                    entry.companion.scale.copy(o.scale);
                }
                o.visible = false;
                entry.companion.castShadow = o.castShadow;
            });
        }

        if (s.frame % UPDATE_EVERY !== 0 || !s.entries.size) return;
        const character = useGame.getState().character;
        const target = orbitControls?.current?.target;
        const range = character ? CHARACTER_RANGE : Math.max(FREE_MIN_RANGE, target ? camera.position.distanceTo(target) * 2 : FREE_MIN_RANGE);
        const rangeSq = range * range;
        camera.updateMatrixWorld();
        projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreen);
        const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
        for (const [mesh, entry] of s.entries) {
            const { companion, positions, radius } = entry;
            if (!mesh.parent) { companion.removeFromParent(); s.entries.delete(mesh); continue; }
            let k = 0;
            for (let i = 0; i < mesh.count; i++) {
                const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
                if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 > rangeSq) continue;
                sphere.center.set(x, y, z);
                sphere.radius = radius;
                if (!frustum.intersectsSphere(sphere)) continue;
                mesh.getMatrixAt(i, tmp);
                companion.setMatrixAt(k++, tmp);
            }
            companion.count = k;
            companion.instanceMatrix.needsUpdate = true;
        }
    });

    return null;
}
