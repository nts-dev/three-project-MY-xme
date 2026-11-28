import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ASPHALT_REPEAT, asphaltTexture } from "../terrain/world/groundRoads";
import { groundMaterial } from "../terrain/world/groundMaterial";
import { applyWetSurface } from "../terrain/world/wetSurface";

// Road models of a project (e.g. 33_L0, the MY Map: "Malaysia Environment Roads" FBX surfaces) in
// the same look as the 153_L2 roads (groundRoads.js): opaque asphalt with a fine grain, the terrain's
// ground lighting and wet in the rain. The models came with semi-transparent tinted materials (the
// photo showing through), which looked washed out. Texture coordinates are taken from the world
// position (ASPHALT_REPEAT metres per repeat), so the grain has the same scale everywhere.
// The space a road model surrounds (its holes: the shop rows inside the car park ring) is filled with
// the same asphalt just below the road surface, so no photo shows between the building fronts / backs
// and the road; the buildings stand on it.

const ROAD_MODEL = /^MalaysiaEnvironmentRoads/i;
const SCAN_MS = 2000;
const SCAN_TRIES = 120; // models load late in big scenes: keep looking for up to 4 minutes

function worldUvs(mesh) {
    const geometry = mesh.geometry;
    const position = geometry.attributes.position;
    // The road models load as instanced meshes with one copy: through that copy's matrix too.
    const matrix = drawnMatrix(mesh);
    const point = new THREE.Vector3();
    const uv = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(matrix);
        uv[i * 2] = point.x / ASPHALT_REPEAT;
        uv[i * 2 + 1] = point.z / ASPHALT_REPEAT;
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

const FILL_DROP = 0.01; // metres below the road surface (the road and its markings draw over the fill)

/** World matrix of the (single) drawn copy of a road model. */
function drawnMatrix(mesh) {
    mesh.updateMatrixWorld(true);
    const matrix = mesh.matrixWorld.clone();
    if (mesh.isInstancedMesh && mesh.count > 0) {
        const instance = new THREE.Matrix4();
        mesh.getMatrixAt(0, instance);
        matrix.multiply(instance);
    }
    return matrix;
}

/**
 * The holes of a road surface (closed loops of its open edges other than the outer one), in world
 * space: the ground the road goes around.
 */
function roadHoles(mesh) {
    const geometry = mesh.geometry;
    const position = geometry.attributes.position;
    const index = geometry.index;
    const corners = index ? index.count : position.count;
    const vertexAt = (i) => (index ? index.getX(i) : i);
    const keyOf = (v) => `${position.getX(v).toFixed(3)},${position.getY(v).toFixed(3)},${position.getZ(v).toFixed(3)}`;
    const keys = new Map(); // key -> first vertex with that position
    const id = (v) => {
        const key = keyOf(v);
        if (!keys.has(key)) keys.set(key, v);
        return keys.get(key);
    };
    const edges = new Map();
    for (let t = 0; t + 2 < corners; t += 3) {
        for (let e = 0; e < 3; e++) {
            const a = id(vertexAt(t + e));
            const b = id(vertexAt(t + ((e + 1) % 3)));
            if (a === b) continue;
            const key = a < b ? `${a}|${b}` : `${b}|${a}`;
            const edge = edges.get(key);
            if (edge) edge.count++;
            else edges.set(key, { a, b, count: 1 });
        }
    }
    const next = new Map();
    for (const { a, b, count } of edges.values()) {
        if (count !== 1) continue;
        if (!next.has(a)) next.set(a, []);
        if (!next.has(b)) next.set(b, []);
        next.get(a).push(b);
        next.get(b).push(a);
    }
    const matrix = drawnMatrix(mesh);
    const point = new THREE.Vector3();
    const used = new Set();
    const loops = [];
    for (const start of next.keys()) {
        if (used.has(start)) continue;
        const loop = [];
        let previous = -1;
        let current = start;
        while (current !== undefined && !used.has(current)) {
            used.add(current);
            loop.push(point.fromBufferAttribute(position, current).applyMatrix4(matrix).clone());
            const options = next.get(current) || [];
            const step = options.find((v) => v !== previous && !used.has(v));
            previous = current;
            current = step;
        }
        if (loop.length >= 3) loops.push(loop);
    }
    const area = (loop) => Math.abs(THREE.ShapeUtils.area(loop.map((p) => new THREE.Vector2(p.x, p.z))));
    loops.sort((a, b) => area(b) - area(a));
    return loops.slice(1); // the largest is the outline of the road itself
}

/** One flat asphalt mesh filling the holes of a road model (null without holes). */
function holeFill(mesh, material) {
    const holes = roadHoles(mesh);
    if (!holes.length) return null;
    const positions = [];
    const uvs = [];
    for (const loop of holes) {
        const contour = loop.map((p) => new THREE.Vector2(p.x, p.z));
        for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
            // Upward facing (counter-clockwise seen from above, x east / z south).
            const order = THREE.ShapeUtils.isClockWise(contour) ? [a, b, c] : [a, c, b];
            for (const i of order) {
                const p = loop[i];
                positions.push(p.x, p.y - FILL_DROP, p.z);
                uvs.push(p.x / ASPHALT_REPEAT, p.z / ASPHALT_REPEAT);
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    const fill = new THREE.Mesh(geometry, material);
    fill.name = `${mesh.name}:fill`;
    fill.receiveShadow = true;
    fill.matrixAutoUpdate = false;
    fill.userData.roadFill = true;
    return fill;
}

export default function ProjectRoadLook() {
    const scene = useThree((state) => state.scene);
    const gl = useThree((state) => state.gl);

    useEffect(() => {
        const map = asphaltTexture(gl.capabilities.getMaxAnisotropy());
        const material = applyWetSurface(groundMaterial({ map, side: THREE.DoubleSide }), { puddles: true });
        material.name = "road-asphalt";
        const restyled = [];
        const fills = [];
        let tries = 0;
        const scan = () => {
            scene.traverse((object) => {
                if (!object.isMesh || !ROAD_MODEL.test(object.name || "") || object.userData.roadFill) return;
                if (object.userData.roadLook) return;
                object.userData.roadLook = { material: object.material };
                worldUvs(object);
                object.material = material;
                object.receiveShadow = true;
                restyled.push(object);
                const fill = holeFill(object, material);
                if (fill) {
                    scene.add(fill);
                    fills.push(fill);
                }
            });
        };
        scan();
        const timer = setInterval(() => {
            scan();
            if (++tries >= SCAN_TRIES) clearInterval(timer);
        }, SCAN_MS);
        return () => {
            clearInterval(timer);
            for (const object of restyled) {
                if (object.userData.roadLook) object.material = object.userData.roadLook.material;
                delete object.userData.roadLook;
            }
            for (const fill of fills) {
                fill.removeFromParent();
                fill.geometry.dispose();
            }
            material.dispose();
            map.dispose();
        };
    }, [scene, gl]);

    return null;
}
