import * as THREE from "three";

// Builds one mesh per terrain tile. Normals come from the whole height grid (not per tile),
// so lighting is continuous across tile edges.

const LOW = new THREE.Color("#5d7d3a"); // valleys
const HIGH = new THREE.Color("#8c9a58"); // hill tops
const SOIL = new THREE.Color("#8a6d4b"); // steep slopes
const scratch = new THREE.Color();

// Small deterministic variation so large areas are not one flat colour.
const hash = (x, z) => {
    const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return s - Math.floor(s);
};

export function createTerrainMaterial() {
    return new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        metalness: 0,
    });
}

export function buildTerrainTileMesh(terrain, tile, material) {
    const { manifest, step, sample } = terrain;
    const { samples, origin } = manifest;
    const cells = samples - 1;
    const minHeight = manifest.heightRange.min;
    const heightSpan = manifest.heightRange.max - minHeight || 1;

    const count = samples * samples;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    const normal = new THREE.Vector3();

    for (let r = 0; r < samples; r++) {
        for (let c = 0; c < samples; c++) {
            const column = tile.column * cells + c;
            const row = tile.row * cells + r;
            const i = r * samples + c;
            const x = origin.x + column * step;
            const z = origin.z + row * step;
            // Read through the global grid so shared edge samples come from one tile and match exactly.
            const y = sample(column, row);
            positions.set([x, y, z], i * 3);
            // Imagery textures have north (row 0) at the top; textures are flipped on upload.
            uvs.set([c / cells, 1 - r / cells], i * 2);

            const dx = (sample(column + 1, row) - sample(column - 1, row)) / (2 * step);
            const dz = (sample(column, row + 1) - sample(column, row - 1)) / (2 * step);
            normal.set(-dx, 1, -dz).normalize();
            normals.set([normal.x, normal.y, normal.z], i * 3);

            const heightFactor = (y - minHeight) / heightSpan;
            const slope = 1 - normal.y; // 0 flat .. ~0.3 steep
            scratch.copy(LOW).lerp(HIGH, heightFactor);
            scratch.lerp(SOIL, Math.min(1, Math.max(0, (slope - 0.04) * 8)));
            scratch.multiplyScalar(0.92 + hash(x, z) * 0.16);
            colors.set([scratch.r, scratch.g, scratch.b], i * 3);
        }
    }

    const indices = new Uint16Array(cells * cells * 6);
    let o = 0;
    for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
            const a = r * samples + c;
            const b = a + 1;
            const d = a + samples;
            const e = d + 1;
            indices.set([a, d, b, b, d, e], o);
            o += 6;
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `terrain_${tile.column}_${tile.row}`;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.userData.isTerrain = true;
    // Asset picking ignores the terrain; ground queries go through getTerrainHeightAt.
    mesh.raycast = () => {};
    return mesh;
}

export function buildTerrainGroup(terrain) {
    const group = new THREE.Group();
    group.name = `terrain_${terrain.manifest.id}`;
    group.userData.isTerrain = true;
    const material = createTerrainMaterial();
    for (const tile of terrain.tiles) group.add(buildTerrainTileMesh(terrain, tile, material));
    group.userData.material = material;
    return group;
}

/** Replaces a tile's height colours with an imagery texture. */
export function applyTerrainTileTexture(group, tile, texture) {
    const mesh = group.getObjectByName(`terrain_${tile.column}_${tile.row}`);
    if (!mesh) {
        texture.dispose();
        return;
    }
    if (mesh.material !== group.userData.material) {
        mesh.material.map?.dispose();
        mesh.material.dispose();
    }
    mesh.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });
}

export function disposeTerrainGroup(group) {
    group.traverse((object) => {
        object.geometry?.dispose();
        if (object.isMesh && object.material !== group.userData.material) {
            object.material.map?.dispose();
            object.material.dispose();
        }
    });
    group.userData.material?.dispose();
    group.removeFromParent();
}
