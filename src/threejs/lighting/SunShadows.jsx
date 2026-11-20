import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import useGame from "../../hooks/useGame";

// Sun shadows that stay cheap in free camera and character mode.
//  - The detailed models (a twin unit is ~430k vertices, a pine ~25k) do not render into the shadow map:
//    they are replaced there by invisible proxies (a box per building body, a cone per tree), so the
//    shadow pass draws a few hundred simple shapes. Small/light meshes (factories, the avatar) cast
//    themselves.
//  - The shadow camera follows the view (orbit target, or the avatar in character mode) with a box sized
//    to the view distance, snapped to shadow-map texels so shadows do not shimmer while moving.

const HEAVY = 300000; // instanced meshes above this many vertices x instances get proxies
const BODY_MIN_HEIGHT = 5; // metres: geometry above this is the building body (fences/yards are lower)
const MAP_SIZE = 2048;
const SYNC_EVERY = 90; // frames between checks for added / moved instances
const CHARACTER_SHADOW_INTERVAL = 1 / 30;
const proxyMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCone = new THREE.ConeGeometry(0.5, 1, 7).translate(0, 0.5, 0);

const tmpMatrix = new THREE.Matrix4();
const tmpVector = new THREE.Vector3();

/** Body box of a heavy model in its geometry space: vertices above BODY_MIN_HEIGHT (in world, for
 *  instance 0), extended down to the ground along the model's up axis. */
function bodyBox(mesh) {
    const position = mesh.geometry.attributes.position;
    mesh.getMatrixAt(0, tmpMatrix);
    tmpMatrix.premultiply(mesh.matrixWorld);
    const full = new THREE.Box3();
    const step = Math.max(1, Math.floor(position.count / 20000));
    let minY = Infinity;
    for (let i = 0; i < position.count; i += step) {
        tmpVector.fromBufferAttribute(position, i);
        full.expandByPoint(tmpVector);
        minY = Math.min(minY, tmpVector.clone().applyMatrix4(tmpMatrix).y);
    }
    // The body: vertices above BODY_MIN_HEIGHT, 2nd-98th percentile per axis (lot-corner posts and
    // other thin tall bits are outliers and would stretch the box over the whole lot).
    const xs = [], ys = [], zs = [];
    for (let i = 0; i < position.count; i += step) {
        tmpVector.fromBufferAttribute(position, i);
        const x = tmpVector.x, y = tmpVector.y, z = tmpVector.z;
        if (tmpVector.applyMatrix4(tmpMatrix).y > minY + BODY_MIN_HEIGHT) { xs.push(x); ys.push(y); zs.push(z); }
    }
    const body = new THREE.Box3();
    if (xs.length > 20) {
        const pct = (values, p) => { const v = values.sort((m, n) => m - n); return v[Math.min(v.length - 1, Math.floor(p * v.length))]; };
        body.min.set(pct(xs, 0.02), pct(ys, 0.02), pct(zs, 0.02));
        body.max.set(pct(xs, 0.98), pct(ys, 0.98), pct(zs, 0.98));
    }
    if (body.isEmpty()) return full;
    // Up axis of the geometry: the column of the instance matrix with the largest world-y component.
    const e = tmpMatrix.elements;
    const up = [Math.abs(e[1]), Math.abs(e[5]), Math.abs(e[9])].reduce((best, v, k, arr) => (v > arr[best] ? k : best), 0);
    const axis = ["x", "y", "z"][up];
    body.min[axis] = full.min[axis];
    body.max[axis] = full.max[axis];
    return body;
}

function buildProxy(mesh) {
    mesh.geometry.computeBoundingBox();
    const isTree = /tree/i.test(mesh.name);
    const box = isTree ? mesh.geometry.boundingBox : bodyBox(mesh);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const proxy = new THREE.InstancedMesh(isTree ? unitCone : unitBox, proxyMaterial, mesh.count);
    if (isTree) {
        // Trees: a cone in world space (canopy narrowing to the top) at each instance.
        const corner = new THREE.Vector3(), min = new THREE.Vector3(), max = new THREE.Vector3();
        for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, tmpMatrix);
            tmpMatrix.premultiply(mesh.matrixWorld);
            min.set(Infinity, Infinity, Infinity); max.set(-Infinity, -Infinity, -Infinity);
            for (let k = 0; k < 8; k++) {
                corner.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).applyMatrix4(tmpMatrix);
                min.min(corner); max.max(corner);
            }
            const radius = Math.min(max.x - min.x, max.z - min.z) * 0.45;
            proxy.setMatrixAt(i, new THREE.Matrix4().compose(
                new THREE.Vector3((min.x + max.x) / 2, min.y + (max.y - min.y) * 0.25, (min.z + max.z) / 2),
                new THREE.Quaternion(),
                new THREE.Vector3(radius * 2, (max.y - min.y) * 0.75, radius * 2),
            ));
        }
    } else {
        // Buildings: the body box, in the model's own axes, through each instance matrix.
        const local = new THREE.Matrix4().compose(centre, new THREE.Quaternion(), size);
        for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, tmpMatrix);
            proxy.setMatrixAt(i, tmpMatrix.clone().premultiply(mesh.matrixWorld).multiply(local));
        }
    }
    proxy.instanceMatrix.needsUpdate = true;
    proxy.computeBoundingSphere();
    proxy.castShadow = true;
    proxy.receiveShadow = false;
    proxy.frustumCulled = false;
    proxy.name = `shadow-proxy:${mesh.name}`;
    proxy.userData.isShadowProxy = true;
    proxy.raycast = () => {};
    return proxy;
}

export default function SunShadows({ lightRef, orbitControls, enabled = true, limitCharacterUpdates = false }) {
    const { gl, scene, camera } = useThree();
    const state = useRef({
        frame: 0, lastShadowUpdate: -Infinity, limited: false,
        proxies: new Map(), signatures: new Map(), group: null, target: null,
        focus: new THREE.Vector3(),
    });

    useEffect(() => {
        if (!enabled) return undefined;
        const s = state.current;
        const light = lightRef?.current;
        if (!light) return undefined;
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFShadowMap;
        gl.shadowMap.autoUpdate = true;
        light.castShadow = true;
        light.shadow.mapSize.set(MAP_SIZE, MAP_SIZE);
        light.shadow.bias = -0.0004;
        light.shadow.normalBias = 0.04;
        s.target = new THREE.Object3D();
        scene.add(s.target);
        light.target = s.target;
        s.group = new THREE.Group();
        s.group.name = "sun-shadow-proxies";
        scene.add(s.group);
        // Existing materials were compiled without shadow maps.
        scene.traverse((o) => { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m) m.needsUpdate = true; }); });
        return () => {
            light.castShadow = false;
            light.shadow.autoUpdate = true;
            gl.shadowMap.enabled = false;
            s.group?.removeFromParent();
            s.target?.removeFromParent();
            for (const proxy of s.proxies.values()) proxy.dispose();
            s.proxies.clear();
            s.signatures.clear();
        };
    }, [enabled, gl, lightRef, scene]);

    useFrame(({ clock }) => {
        const s = state.current;
        const light = lightRef?.current;
        if (!enabled || !light || !s.group) return;
        s.frame += 1;
        // The canvas resets shadowMap.enabled when it re-configures (resize etc.): keep it on.
        if (!gl.shadowMap.enabled) gl.shadowMap.enabled = true;

        // Keep proxies in sync with the scene's instanced meshes; heavy ones stop casting themselves.
        if (s.frame % SYNC_EVERY === 1) {
            const active = new Set();
            scene.traverse((o) => {
                if (o.isSkinnedMesh) o.castShadow = true; // the avatar
                if (!o.isInstancedMesh || o.userData.isShadowProxy || o.userData.isCullCompanion || !o.count) return;
                if (o.parent?.userData.xmeBuildingShadowProxy) return;
                const vertices = o.geometry.attributes.position.count * o.count;
                if (vertices < HEAVY && !o.userData.xmeBuildingShadowProxy) return;
                o.castShadow = false;
                if (/light|pavement|lawn/i.test(o.name)) return; // poles and lawns: no proxy
                active.add(o);
                const signature = `${o.count}:${o.instanceMatrix.version}`;
                if (s.signatures.get(o) === signature) return;
                s.signatures.set(o, signature);
                s.proxies.get(o)?.removeFromParent();
                s.proxies.get(o)?.dispose();
                const proxy = buildProxy(o);
                s.proxies.set(o, proxy);
                s.group.add(proxy);
            });
            for (const [mesh, proxy] of s.proxies) {
                if (active.has(mesh)) continue;
                proxy.removeFromParent();
                proxy.dispose();
                s.proxies.delete(mesh);
                s.signatures.delete(mesh);
            }
        }

        // Focus: the avatar in character mode, else the orbit target.
        const { character, firstPerson, characterRef } = useGame.getState();
        const walking = character || firstPerson;
        const limited = limitCharacterUpdates && walking;
        const time = clock.elapsedTime;
        light.shadow.autoUpdate = !limited;
        if (limited && s.limited && time - s.lastShadowUpdate < CHARACTER_SHADOW_INTERVAL) return;
        s.limited = limited;
        s.lastShadowUpdate = time;
        // Keep the light-space transform in sync with the map while its render is throttled.
        light.shadow.needsUpdate = true;
        const focus = s.focus;
        const body = (walking ? characterRef : null)?.translation?.();
        if (body) focus.set(body.x, body.y, body.z);
        else if (orbitControls?.current?.target) focus.copy(orbitControls.current.target);
        else camera.getWorldDirection(focus).multiplyScalar(50).add(camera.position);
        const distance = camera.position.distanceTo(focus);
        const half = THREE.MathUtils.clamp(body ? 45 : distance * 0.9, 40, 350);
        // Snap the focus to shadow texels (in the light's view plane) so shadows do not shimmer.
        const texel = (2 * half) / MAP_SIZE;
        focus.x = Math.round(focus.x / texel) * texel;
        focus.z = Math.round(focus.z / texel) * texel;
        const direction = tmpVector.copy(light.userData.sunDirection || light.position).normalize();
        light.userData.sunDirection ||= direction.clone();
        const shadowCamera = light.shadow.camera;
        if (shadowCamera.right !== half) {
            shadowCamera.left = -half; shadowCamera.right = half; shadowCamera.top = half; shadowCamera.bottom = -half;
            shadowCamera.near = 1; shadowCamera.far = half * 6;
            shadowCamera.updateProjectionMatrix();
        }
        light.position.copy(focus).addScaledVector(light.userData.sunDirection, half * 3);
        s.target.position.copy(focus);
        s.target.updateMatrixWorld();
    });

    return null;
}
