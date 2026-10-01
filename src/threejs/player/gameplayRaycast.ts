import * as THREE from "three";

type Node = { bounds: THREE.Box3; ids?: number[]; left?: Node; right?: Node };
type Entry = {
    version: number;
    count: number;
    geometry: THREE.BufferGeometry;
    positionVersion: number;
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

    const visit = (node: Node, object: THREE.InstancedMesh, raycaster: THREE.Raycaster) => {
        if (!localRay.intersectBox(node.bounds, point)) return;
        if (node.ids) {
            for (const id of node.ids) intersectInstance(object, id, raycaster);
        } else {
            if (node.left) visit(node.left, object, raycaster);
            if (node.right) visit(node.right, object, raycaster);
        }
    };

    return (raycaster: THREE.Raycaster, targets: THREE.InstancedMesh[]) => {
        hits.length = 0;
        for (const object of targets) {
            if (!object.layers.test(raycaster.layers)) continue;
            // Preserve custom raycasters and deforming geometry through the original path.
            if (object.raycast !== THREE.InstancedMesh.prototype.raycast || object.geometry.morphAttributes.position?.length) {
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
            mesh.geometry = object.geometry;
            mesh.material = object.material;
            visit(entry.root, object, raycaster);
        }
        // Match Three's stable distance ordering, including equal-distance instances.
        hits.sort((a, b) => a.distance - b.distance ||
            (a.object === b.object ? (a.instanceId ?? 0) - (b.instanceId ?? 0) :
                targets.indexOf(a.object as THREE.InstancedMesh) - targets.indexOf(b.object as THREE.InstancedMesh)));
        return hits[0];
    };
}
