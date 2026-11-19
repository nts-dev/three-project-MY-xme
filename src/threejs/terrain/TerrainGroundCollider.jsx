import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { useKeyboardControls } from "@react-three/drei";
import useGame from "../../hooks/useGame";
import { useJoystickControls } from "../../hooks/useJoystickControls";
import { getActiveTerrain } from "./terrainData";

// Physics ground for streamed terrain (scene JSON `terrain`): every terrain tile that is loaded
// and drawn near the character gets a collider made of the tile's own triangles, so the ground
// the character walks on is exactly the ground that is drawn. Colliders follow the terrain's
// level of detail: added as tiles load, removed (after a short overlap) when tiles are replaced
// or unloaded. Replaces the flat floor slab terrain scenes used to stand on.
const RANGE = 700; // metres around the character (or camera) in which drawn tiles get colliders
const SCAN_SECONDS = 0.2; // how often the drawn tiles are re-checked
const MAX_BUILDS_PER_FRAME = 1; // ~1.6 ms each; nearest first, so the tile underfoot is never waiting
const REMOVE_GRACE_SECONDS = 1.5; // replaced tiles keep their collider until their successors exist

// A wide slab under the character catches it if it ever slips through the thin terrain surface;
// it is then lifted back on top. Follows the character, a few metres under the terrain.
const SAFETY_FLOOR_DEPTH = 4;
// The drawn roads, tarmac aprons and lawn strips lie up to ~0.06 m above the terrain mesh
// (groundRoads.js); the walking surface is raised by this much so feet stand on them, not in them.
const SURFACE_LIFT = 0.09;
const SAFETY_FLOOR_HALF_SIZE = 400;

const SINK_TOLERANCE = 0.5; // metres below the terrain before the character is lifted back up
const SNAP_MIN_GAP = 0.03; // feet this far above the terrain count as lifting off...
const SNAP_MAX_GAP = 1.5; // ...and are pulled back down, unless it is a real drop (higher)
const MAX_TILE_RELIEF = 3000; // metres; taller is a corrupt elevation tile (-32768 m pits), skipped

/** Distance from the character body's centre to the bottom of its capsule collider. */
function capsuleBottomOffset(body) {
    try {
        const collider = body.numColliders?.() ? body.collider(0) : null;
        if (collider?.halfHeight && collider?.radius) return collider.halfHeight() + collider.radius();
    } catch {
        // fall through to the controller's default capsule
    }
    return 0.75;
}

const tileDistance = (tile, x, z) => Math.hypot(
    Math.max(tile.x0 - x, 0, x - (tile.x0 + tile.size)),
    Math.max(tile.z0 - z, 0, z - (tile.z0 + tile.size))
);

/**
 * The drawn surface of a terrain tile (its grid triangles, without the edge skirts) as a Rapier
 * trimesh in the tile's local frame, or null when the tile has no usable mesh.
 */
function tileTrimesh(rapier, tile) {
    const geometry = tile.mesh?.geometry;
    const positions = geometry?.attributes?.position?.array;
    const index = geometry?.index?.array;
    const segments = Math.round(Math.sqrt(tile.heights?.length || 0)) - 1;
    if (!positions || !index || segments < 1) return null;
    const gridVertices = (segments + 1) * (segments + 1);
    const gridIndices = segments * segments * 6; // grid triangles come first, skirts after
    const vertices = Float32Array.from(positions.subarray(0, gridVertices * 3));
    let low = Infinity;
    let high = -Infinity;
    for (let k = 1; k < vertices.length; k += 3) {
        const y = vertices[k];
        if (!Number.isFinite(y)) return null;
        if (y < low) low = y;
        if (y > high) high = y;
    }
    if (high - low > MAX_TILE_RELIEF) return null;
    const indices = Uint32Array.from(index.subarray(0, gridIndices));
    const flags = rapier.TriMeshFlags?.FIX_INTERNAL_EDGES;
    const desc = flags !== undefined
        ? rapier.ColliderDesc.trimesh(vertices, indices, flags)
        : rapier.ColliderDesc.trimesh(vertices, indices);
    return { desc: desc.setTranslation(tile.x0, SURFACE_LIFT, tile.z0), low: low + SURFACE_LIFT };
}

/**
 * Colliders for the raised bridges / highway viaducts (bridgeMeshes.js), built once from their
 * drawn geometry: deck and concrete body (sides, underside, parapets) as triangle meshes in world
 * space, piers as cylinders. Returns the created colliders.
 */
function buildBridgeColliders(world, rapier, group) {
    const colliders = [];
    group.updateMatrixWorld(true);
    const vertex = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    group.traverse((object) => {
        if (!object.isMesh || !object.geometry?.attributes?.position) return;
        if (object.isInstancedMesh) {
            // Piers: unit cylinder (radius 0.85 at the base) standing on its base, scaled in y.
            for (let i = 0; i < object.count; i++) {
                object.getMatrixAt(i, matrix);
                matrix.premultiply(object.matrixWorld).decompose(position, quaternion, scale);
                const halfHeight = Math.max(0.05, scale.y / 2);
                colliders.push(world.createCollider(
                    rapier.ColliderDesc.cylinder(halfHeight, 0.85).setTranslation(position.x, position.y + halfHeight, position.z)
                ));
            }
            return;
        }
        const source = object.geometry.attributes.position;
        const vertices = new Float32Array(source.count * 3);
        for (let i = 0; i < source.count; i++) {
            vertex.fromBufferAttribute(source, i).applyMatrix4(object.matrixWorld);
            vertices.set([vertex.x, vertex.y, vertex.z], i * 3);
        }
        const indices = object.geometry.index
            ? Uint32Array.from(object.geometry.index.array)
            : Uint32Array.from({ length: source.count }, (_, i) => i);
        // The meshes are drawn double-sided, so their winding is arbitrary; Rapier pushes bodies
        // out along a triangle's normal, and a deck facing down pushed the character through it.
        // Turn every non-vertical triangle to face up.
        for (let t = 0; t + 2 < indices.length; t += 3) {
            const a = indices[t] * 3;
            const b = indices[t + 1] * 3;
            const c = indices[t + 2] * 3;
            const abx = vertices[b] - vertices[a];
            const abz = vertices[b + 2] - vertices[a + 2];
            const acx = vertices[c] - vertices[a];
            const acz = vertices[c + 2] - vertices[a + 2];
            const normalY = abz * acx - abx * acz; // y of (b - a) x (c - a)
            if (normalY < 0) {
                const swap = indices[t + 1];
                indices[t + 1] = indices[t + 2];
                indices[t + 2] = swap;
            }
        }
        colliders.push(world.createCollider(rapier.ColliderDesc.trimesh(vertices, indices)));
    });
    return colliders;
}

export default function TerrainGroundCollider() {
    const { world, rapier } = useRapier();
    // key -> { collider, heights, lastWanted, low }
    const state = useRef({
        tiles: new Map(),
        handles: new Set(),
        safety: null,
        lastScan: -Infinity,
        queue: [],
        bridgeGroup: null,
        bridgeColliders: [],
        bridgeHandles: new Set(),
    });

    useEffect(() => {
        const current = state.current;
        current.safety = world.createCollider(
            rapier.ColliderDesc.cuboid(SAFETY_FLOOR_HALF_SIZE, 0.5, SAFETY_FLOOR_HALF_SIZE).setTranslation(0, -60, 0)
        );
        return () => {
            const remove = (collider) => {
                if (collider && world.getCollider(collider.handle)) world.removeCollider(collider, false);
            };
            for (const entry of current.tiles.values()) remove(entry.collider);
            for (const collider of current.bridgeColliders) remove(collider);
            current.bridgeColliders = [];
            current.bridgeHandles.clear();
            current.bridgeGroup = null;
            remove(current.safety);
            current.tiles.clear();
            current.handles.clear();
            current.safety = null;
            current.queue = [];
        };
    }, [world, rapier]);

    const characterPosition = () => {
        const body = useGame.getState().characterRef;
        try {
            return body?.translation?.() || null;
        } catch {
            return null; // body already removed from the world
        }
    };

    // Tile colliders: keep one for every drawn tile near the character.
    useFrame(({ clock, camera }) => {
        const terrain = getActiveTerrain();
        const terrainWorld = terrain?.world;
        if (!terrainWorld?.tiles) return;
        const current = state.current;
        const time = clock.getElapsedTime();
        const center = characterPosition() || camera.position;

        // Bridges / highway viaducts: built once when they appear (rebuilt if they change).
        const bridgeGroup = terrain.getBridges?.() ?? null;
        if (bridgeGroup !== current.bridgeGroup) {
            for (const collider of current.bridgeColliders) {
                if (world.getCollider(collider.handle)) world.removeCollider(collider, false);
            }
            current.bridgeColliders = bridgeGroup ? buildBridgeColliders(world, rapier, bridgeGroup) : [];
            current.bridgeHandles = new Set(current.bridgeColliders.map((collider) => collider.handle));
            current.bridgeGroup = bridgeGroup;        }

        if (time - current.lastScan >= SCAN_SECONDS) {
            current.lastScan = time;
            const wanted = [];
            for (const tile of terrainWorld.tiles.values()) {
                if (tile.state !== "ready" || !tile.mesh?.visible || !tile.heights) continue;
                const distance = tileDistance(tile, center.x, center.z);
                if (distance > RANGE) continue;
                const entry = current.tiles.get(tile.key);
                if (entry) {
                    entry.lastWanted = time;
                    if (entry.heights === tile.heights) continue; // collider is up to date
                }
                wanted.push({ tile, distance });
            }
            wanted.sort((a, b) => a.distance - b.distance);
            current.queue = wanted.map((item) => item.tile);

            // Drop colliders of tiles that are no longer drawn (replaced by finer/coarser tiles,
            // unloaded, or out of range) once the overlap time has passed.
            for (const [key, entry] of current.tiles) {
                if (time - entry.lastWanted < REMOVE_GRACE_SECONDS) continue;
                if (world.getCollider(entry.collider.handle)) world.removeCollider(entry.collider, false);
                current.handles.delete(entry.collider.handle);
                current.tiles.delete(key);
            }
        }

        // Build a few per frame, nearest first.
        for (let built = 0; built < MAX_BUILDS_PER_FRAME && current.queue.length;) {
            const tile = current.queue.shift();
            if (tile.state !== "ready" || !tile.mesh) continue;
            const made = tileTrimesh(rapier, tile);
            if (!made) continue;
            const collider = world.createCollider(made.desc);
            const previous = current.tiles.get(tile.key);
            if (previous && world.getCollider(previous.collider.handle)) {
                world.removeCollider(previous.collider, false);
                current.handles.delete(previous.collider.handle);
            }
            current.tiles.set(tile.key, { collider, heights: tile.heights, lastWanted: time, low: made.low });
            current.handles.add(collider.handle);
            built++;
        }

        // Safety slab: under the character, a few metres below the terrain there.
        const ground = terrain.heightAt(center.x, center.z);
        if (current.safety && ground !== null && Number.isFinite(ground)) {
            current.safety.setTranslation({ x: center.x, y: ground - SAFETY_FLOOR_DEPTH - 0.5, z: center.z });
        }
    });

    // Keeping the character on the terrain:
    //  - lifted back on top if it ever ends up under the surface;
    //  - ground following: walking or running over slopes and crests it stays on the ground like
    //    on real ground (at 10 m/s it otherwise left the ground downhill and over every crest);
    //    jumps and real drops (over 1.5 m) are left alone.
    const [, getKeys] = useKeyboardControls();
    const jumpRef = useRef({ active: false, since: 0 });
    const ccdBodyRef = useRef(null);
    useFrame(({ clock }) => {
        const current = state.current;
        const terrain = getActiveTerrain();
        const body = useGame.getState().characterRef;
        if (!terrain?.heightAt || !body || !current.handles.size) return;
        let position;
        try {
            position = body.translation();
        } catch {
            return;
        }
        // Continuous collision detection: a fast fall cannot step through the thin surface.
        if (ccdBodyRef.current !== body) {
            ccdBodyRef.current = body;
            try {
                body.enableCcd(true);
            } catch {
                // body being replaced
            }
        }

        // Ground = the terrain colliders' surface under the character (what physics uses), found
        // with a ray from high above that only hits terrain tiles; the drawn height as fallback.
        const isTerrain = (collider) => current.handles.has(collider.handle);
        const hitTerrain = world.castRay(
            new rapier.Ray({ x: position.x, y: position.y + 500, z: position.z }, { x: 0, y: -1, z: 0 }),
            3000,
            true,
            undefined,
            undefined,
            undefined,
            body,
            isTerrain
        );
        const ground = hitTerrain
            ? position.y + 500 - (hitTerrain.timeOfImpact ?? hitTerrain.toi)
            : terrain.heightAt(position.x, position.z) + SURFACE_LIFT;
        if (ground === null || !Number.isFinite(ground)) return;
        const offset = capsuleBottomOffset(body);
        const gap = position.y - offset - ground;
        const velocity = body.linvel();

        if (gap < -SINK_TOLERANCE) {
            body.setTranslation({ x: position.x, y: ground + offset + 0.05, z: position.z }, true);
            body.setLinvel({ x: velocity.x, y: Math.max(0, velocity.y), z: velocity.z }, true);
            return;
        }

        // Whatever is directly under the feet (terrain, a bridge deck, a building floor ...).
        const below = world.castRay(
            new rapier.Ray({ x: position.x, y: position.y - offset + 0.05, z: position.z }, { x: 0, y: -1, z: 0 }),
            50,
            true,
            undefined,
            undefined,
            undefined,
            body
        );
        const floorGap = below ? (below.timeOfImpact ?? below.toi) - 0.05 : Infinity;

        // A jump (keyboard, touch button or joystick double tap) runs its course until landing.
        const time = clock.getElapsedTime();
        const jump = jumpRef.current;
        const jumpPressed = Boolean(getKeys?.()?.jump) || useJoystickControls.getState().curButton1Pressed;
        if (jumpPressed && !jump.active) {
            jump.active = true;
            jump.since = time;
        }
        if (jump.active) {
            if (time - jump.since > 0.25 && floorGap < SNAP_MIN_GAP) jump.active = false;
            return;
        }

        // Ground following on terrain and bridge decks (not building floors, roofs ...).
        if (!below || floorGap < SNAP_MIN_GAP || floorGap > SNAP_MAX_GAP) return;
        if (!isTerrain(below.collider) && !current.bridgeHandles.has(below.collider.handle)) return;
        const surface = position.y - offset - floorGap;
        body.setTranslation({ x: position.x, y: surface + offset + 0.005, z: position.z }, true);
        body.setLinvel({ x: velocity.x, y: Math.min(0, velocity.y), z: velocity.z }, true);
    });

    return null;
}
