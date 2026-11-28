import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import { farGeometry, weldedGeometry } from "./decorLod";
import { updateBuildingLod } from "./buildingLod";

// Distance + view culling and level of detail for street decor (pines ~8k triangles each, street
// lights ~5k): an InstancedMesh always draws every instance, so 266 pines cost ~2.2M triangles a frame
// even when only a handful are near. Companion InstancedMeshes (same materials) draw only the
// instances within range and in front of the camera: the full model (welded, see decorLod) up close,
// a simplified one further away. The original stays in the scene, hidden, for picking and editing.
//
// The far pine matters most in the overview: from a few hundred metres a pine is a ~30 px stick
// (its needle cut-outs fade out in the texture's small mip levels), yet the full model made the
// trees ~40% of the frame.

const DECOR = /PineTree|Tree0?\d|TrafficStreetLight/i;
const UPDATE_EVERY = 8; // frames
const SCAN_EVERY = 120;
const CHARACTER_RANGE = 170; // metres
const FREE_MIN_RANGE = 220;

// Far model per kind: from `distance` metres on; triangle share kept and error allowed (fraction of
// the model size) per material slot.
const LOD = [
    {
        test: /PineTree|Tree0?\d/i,
        distance: 70,
        // trunk + branches, needles: 8.3k -> ~1.5k triangles (fewer needles thin the crown visibly)
        groups: { 0: { ratio: 0.08, error: 0.05 }, 1: { ratio: 0.25, error: 0.05 } },
        fallback: { ratio: 0.1, error: 0.1 },
    },
    {
        test: /TrafficStreetLight/i,
        distance: 90,
        groups: {},
        fallback: { ratio: 0.12, error: 0.02 },
    },
];

const frustum = new THREE.Frustum();
const projScreen = new THREE.Matrix4();
const sphere = new THREE.Sphere();
const tmp = new THREE.Matrix4();

function makeCompanion(source, geometry, suffix) {
    const companion = new THREE.InstancedMesh(geometry, source.material, source.count);
    companion.name = `${source.name}:${suffix}`;
    companion.userData.isCullCompanion = true;
    companion.castShadow = source.castShadow;
    companion.receiveShadow = source.receiveShadow;
    companion.frustumCulled = false;
    companion.raycast = () => {};
    companion.count = 0;
    return companion;
}

export default function DecorCulling({ orbitControls, enabled = true }) {
    const { scene, camera } = useThree();
    const state = useRef({ frame: 0, entries: new Map() });

    useEffect(() => {
        const s = state.current;
        return () => {
            for (const [mesh, entry] of s.entries) {
                for (const companion of [entry.companion, entry.far]) {
                    if (!companion) continue;
                    companion.removeFromParent();
                    companion.dispose();
                }
                mesh.visible = true;
            }
            s.entries.clear();
        };
    }, []);

    useFrame(() => {
        if (!enabled) return;
        updateBuildingLod(scene, camera);
        const s = state.current;
        s.frame += 1;

        if (s.frame % SCAN_EVERY === 1) {
            scene.traverse((o) => {
                if (!o.isInstancedMesh || o.userData.isCullCompanion || o.userData.isShadowProxy || o.count < 20 || !DECOR.test(o.name)) return;
                const signature = `${o.count}:${o.instanceMatrix.version}`;
                let entry = s.entries.get(o);
                if (!entry) {
                    const companion = makeCompanion(o, weldedGeometry(o.geometry), "near");
                    o.parent?.add(companion);
                    const lod = LOD.find((l) => l.test.test(o.name)) || null;
                    entry = { companion, far: null, lod, signature: "", positions: null, radius: 1 };
                    s.entries.set(o, entry);
                    // The far model is built in the background; until then the full one is drawn.
                    if (lod) {
                        farGeometry(o.geometry, lod.groups, lod.fallback).then((geometry) => {
                            if (!geometry || s.entries.get(o) !== entry) return;
                            entry.far = makeCompanion(o, geometry, "far");
                            entry.far.position.copy(entry.companion.position);
                            entry.far.quaternion.copy(entry.companion.quaternion);
                            entry.far.scale.copy(entry.companion.scale);
                            entry.companion.parent?.add(entry.far);
                        });
                    }
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
                    for (const companion of [entry.companion, entry.far]) {
                        if (!companion) continue;
                        companion.position.copy(o.position);
                        companion.quaternion.copy(o.quaternion);
                        companion.scale.copy(o.scale);
                    }
                }
                o.visible = false;
                entry.companion.castShadow = o.castShadow;
                if (entry.far) entry.far.castShadow = o.castShadow;
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
            const { companion, far, positions, radius } = entry;
            if (!mesh.parent) {
                companion.removeFromParent();
                far?.removeFromParent();
                s.entries.delete(mesh);
                continue;
            }
            // A far instance count is only kept when the far model exists.
            const farSq = far ? entry.lod.distance * entry.lod.distance : Infinity;
            let near = 0, distant = 0;
            for (let i = 0; i < mesh.count; i++) {
                const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
                const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
                if (d2 > rangeSq) continue;
                sphere.center.set(x, y, z);
                sphere.radius = radius;
                if (!frustum.intersectsSphere(sphere)) continue;
                mesh.getMatrixAt(i, tmp);
                if (d2 > farSq) far.setMatrixAt(distant++, tmp);
                else companion.setMatrixAt(near++, tmp);
            }
            companion.count = near;
            companion.instanceMatrix.needsUpdate = true;
            if (far) {
                far.count = distant;
                far.instanceMatrix.needsUpdate = true;
            }
        }
    });

    return null;
}
