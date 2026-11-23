import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";

// Triangle BVH per geometry, built once on first use. "indirect" keeps the geometry's index (and its
// material groups) untouched, so rendering is unaffected. Without it each ray tested every triangle of
// a ~15k-triangle building, ~8 ms a frame while running past them (uneven, so movement felt jerky).
const geometryBvh = new WeakMap<THREE.BufferGeometry, MeshBVH>();
const ensureBvh = (geometry: THREE.BufferGeometry) => {
    let bvh = geometryBvh.get(geometry);
    if (!bvh) {
        bvh = new MeshBVH(geometry, { indirect: true } as any);
        geometryBvh.set(geometry, bvh);
    }
    (geometry as any).boundsTree = bvh;
};

type Node = { bounds: THREE.Box3; ids?: number[]; left?: Node; right?: Node };
type Entry = {
    version: number;
    count: number;
    geometry: THREE.BufferGeometry;
    positionVersion: number;
    boxes: THREE.Box3[];
    root?: Node;
};

// Index instance bounds, while keeping Three's triangle raycast and hit normals.
// Weak keys allow removed scene meshes to be collected without explicit cleanup.
export function createGameplayRaycast() {
    const entries = new WeakMap<THREE.InstancedMesh, Entry>();
    const instanceMatrix = new THREE.Matrix4();
    const inverseWorld = new THREE.Matrix4();
    const localRay = new THREE.Ray();
    const point = new THREE.Vector3();
    const mesh = new THREE.Mesh();
    mesh.raycast = acceleratedRaycast as any;
    const instanceHits: THREE.Intersection[] = [];
    const hits: THREE.Intersection[] = [];

    const build = (ids: number[], boxes: THREE.Box3[]): Node => {
        const bounds = new THREE.Box3();
        for (const id of ids) bounds.union(boxes[id]);
        if (ids.length <= 8) return { bounds, ids };
        const size = bounds.getSize(new THREE.Vector3());
        const axis = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
        ids.sort((a, b) => (boxes[a].min[axis] + boxes[a].max[axis]) - (boxes[b].min[axis] + boxes[b].max[axis]));
        const middle = Math.floor(ids.length / 2);
        return { bounds, left: build(ids.slice(0, middle), boxes), right: build(ids.slice(middle), boxes) };
    };

    const intersectInstance = (object: THREE.InstancedMesh, id: number, raycaster: THREE.Raycaster) => {
        object.getMatrixAt(id, instanceMatrix);
        mesh.matrixWorld.multiplyMatrices(object.matrixWorld, instanceMatrix);
        instanceHits.length = 0;
        mesh.raycast(raycaster, instanceHits);
        for (const hit of instanceHits) {
            hit.instanceId = id;
            hit.object = object;
            hits.push(hit);
        }
        instanceHits.length = 0;
    };

    const visit = (node: Node, boxes: THREE.Box3[], object: THREE.InstancedMesh, raycaster: THREE.Raycaster, farSq: number) => {
        if (!canReach(node.bounds, farSq)) return;
        if (node.ids) {
            for (const id of node.ids) {
                if (canReach(boxes[id], farSq)) intersectInstance(object, id, raycaster);
            }
        } else {
            if (node.left) visit(node.left, boxes, object, raycaster, farSq);
            if (node.right) visit(node.right, boxes, object, raycaster, farSq);
        }
    };

    const canReach = (bounds: THREE.Box3, farSq: number) => bounds.containsPoint(localRay.origin) ||
        (localRay.intersectBox(bounds, point) !== null && point.distanceToSquared(localRay.origin) <= farSq);

    return (raycaster: THREE.Raycaster, targets: THREE.InstancedMesh[]) => {
        hits.length = 0;
        const firstHitOnly = (raycaster as any).firstHitOnly;
        (raycaster as any).firstHitOnly = true;
        for (const object of targets) {
            if (!object.layers.test(raycaster.layers)) continue;
            // Spatial batches only change rendering and picking. Gameplay uses the original instances.
            const hasCustomRaycast = object.raycast !== THREE.InstancedMesh.prototype.raycast &&
                !object.userData.spatialInstanceCulling;
            if (hasCustomRaycast || object.geometry.morphAttributes.position?.length) {
                object.raycast(raycaster, hits);
                continue;
            }
            const position = object.geometry.attributes.position;
            const positionVersion = position instanceof THREE.InterleavedBufferAttribute ? position.data.version : position?.version ?? 0;
            let entry = entries.get(object);
            if (!entry || entry.version !== object.instanceMatrix.version || entry.count !== object.count ||
                entry.geometry !== object.geometry || entry.positionVersion !== positionVersion) {
                object.geometry.computeBoundingBox();
                const boxes: THREE.Box3[] = [];
                for (let id = 0; id < object.count; id++) {
                    object.getMatrixAt(id, instanceMatrix);
                    boxes.push(object.geometry.boundingBox!.clone().applyMatrix4(instanceMatrix));
                }
                entry = {
                    version: object.instanceMatrix.version,
                    count: object.count,
                    geometry: object.geometry,
                    positionVersion,
                    boxes,
                    root: object.count ? build(boxes.map((_, id) => id), boxes) : undefined,
                };
                entries.set(object, entry);
            }
            if (!entry.root) continue;
            // A singular world transform cannot be indexed reliably.
            if (object.matrixWorld.determinant() === 0) {
                object.raycast(raycaster, hits);
                continue;
            }
            inverseWorld.copy(object.matrixWorld).invert();
            localRay.copy(raycaster.ray).applyMatrix4(inverseWorld);
            // Transform the world ray's end point to account for non-uniform parent scaling.
            const farSq = Number.isFinite(raycaster.far)
                ? raycaster.ray.at(raycaster.far, point).applyMatrix4(inverseWorld).distanceToSquared(localRay.origin)
                : Infinity;
            ensureBvh(object.geometry);
            mesh.geometry = object.geometry;
            mesh.material = object.material;
            visit(entry.root, entry.boxes, object, raycaster, farSq + 1e-10);
        }
        // Match Three's stable distance ordering, including equal-distance instances.
        hits.sort((a, b) => a.distance - b.distance ||
            (a.object === b.object ? (a.instanceId ?? 0) - (b.instanceId ?? 0) :
                targets.indexOf(a.object as THREE.InstancedMesh) - targets.indexOf(b.object as THREE.InstancedMesh)));
        (raycaster as any).firstHitOnly = firstHitOnly;
        return hits[0];
    };
}
