import * as THREE from "three";

// 3D bridges (flyovers, viaducts, footbridges) from the regions' bridges.json, built by the
// backend's scripts/terrain/steps/bridges.mjs: a deck along the centreline at the computed
// height with a generated road surface (asphalt, edge lines, lane markings), side faces,
// underside, parapets and piers. The ground photo under raised decks is erased by the terrain
// (see bridgeImageryMasks / WorldTerrain imageryMasks), so the road is not painted twice.

const METERS_PER_DEGREE_LAT = 110574;
const EDGE_MARGIN = 300; // metres; regionOverlay blends regions into raw elevation over 250 m
const TEXTURE_LENGTH = 24; // metres of deck per repeat of the road texture (lane dash cycle)
const RAISED = 1.5; // deck at least this far above the ground counts as raised

/** Bridges near a region's edge are left out: there its corrected ground (and ramps) fade out. */
export const isBridgeShown = (region, bridge) =>
    bridge.points?.length >= 2
    && !bridge.points.some(([x, z]) => Math.min(x - region.minX, region.maxX - x, z - region.minZ, region.maxZ - z) < EDGE_MARGIN);

const regionToGeo = (region) => (x, z) => ({
    lat: region.lat - z / METERS_PER_DEGREE_LAT,
    lon: region.lon + x / region.metersPerDegreeLon,
});

/**
 * Raised deck spans as geo polylines, for erasing the bridge from the ground photo:
 * [{ points: [{ lat, lon }, ...], halfWidth }] (halfWidth in metres, with a margin).
 */
export function bridgeImageryMasks(regions) {
    const masks = [];
    for (const region of regions) {
        const toGeo = regionToGeo(region);
        for (const bridge of region.bridges || []) {
            if (!isBridgeShown(region, bridge)) continue;
            let run = [];
            const flush = () => {
                if (run.length >= 2) masks.push({ points: run, halfWidth: bridge.width / 2 + 2 });
                run = [];
            };
            bridge.points.forEach(([x, z, deck, ground]) => {
                if (ground === undefined || deck - ground >= RAISED) run.push(toGeo(x, z));
                else flush();
            });
            flush();
        }
    }
    return masks;
}

let roadTextureCache = new Map();

/** Asphalt with edge lines and dashed lane lines, u across the deck, v along it. */
function roadTexture(lanes, oneway, maxAnisotropy) {
    const key = `${lanes}:${oneway}`;
    if (roadTextureCache.has(key)) return roadTextureCache.get(key);
    const width = 256;
    const height = 512;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#4a4a48";
    context.fillRect(0, 0, width, height);
    // Fine grain so the asphalt is not a flat colour.
    const image = context.getImageData(0, 0, width, height);
    for (let i = 0; i < image.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 18;
        image.data[i] += noise;
        image.data[i + 1] += noise;
        image.data[i + 2] += noise;
    }
    context.putImageData(image, 0, 0);
    if (lanes > 0) {
        const edge = width * 0.04;
        context.fillStyle = "#e9e7df";
        context.fillRect(edge, 0, 4, height);
        context.fillRect(width - edge - 4, 0, 4, height);
        for (let lane = 1; lane < lanes; lane++) {
            const x = edge + ((width - 2 * edge) * lane) / lanes - 2;
            const centre = !oneway && lane === lanes / 2;
            context.fillStyle = centre ? "#e2c044" : "#e9e7df";
            if (centre) {
                context.fillRect(x - 3, 0, 4, height);
                context.fillRect(x + 3, 0, 4, height);
            }
            else for (let y = 0; y < height; y += 128) context.fillRect(x, y, 4, 64); // 6 m dash, 6 m gap
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = maxAnisotropy;
    roadTextureCache.set(key, texture);
    return texture;
}

export function regionToScene(region, frame, anchorElevation) {
    const yOffset = region.referenceElevation - anchorElevation;
    const toGeo = regionToGeo(region);
    return (x, z, y) => {
        const { lat, lon } = toGeo(x, z);
        const p = frame.geoToScene(lat, lon);
        return new THREE.Vector3(p.x, y + yOffset, p.z);
    };
}

/** Left/right edge points of a centreline at a half width (horizontal offsets only). */
export function edges(points, halfWidth) {
    const left = [];
    const right = [];
    points.forEach((p, i) => {
        const a = points[Math.max(0, i - 1)];
        const b = points[Math.min(points.length - 1, i + 1)];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const length = Math.hypot(dx, dz) || 1;
        const nx = -dz / length;
        const nz = dx / length;
        left.push(new THREE.Vector3(p.x + nx * halfWidth, p.y, p.z + nz * halfWidth));
        right.push(new THREE.Vector3(p.x - nx * halfWidth, p.y, p.z - nz * halfWidth));
    });
    return { left, right };
}

/** Accumulates triangle strips into one geometry. */
export class StripBuilder {
    constructor() {
        this.positions = [];
        this.uvs = [];
        this.indices = [];
    }

    /** A strip between two rows of points of the same length; uvA/uvB: per-point [u, v] (optional). */
    strip(rowA, rowB, uvA, uvB) {
        const base = this.positions.length / 3;
        rowA.forEach((p, i) => {
            this.positions.push(p.x, p.y, p.z);
            this.uvs.push(...(uvA ? uvA[i] : [0, 0]));
        });
        rowB.forEach((p, i) => {
            this.positions.push(p.x, p.y, p.z);
            this.uvs.push(...(uvB ? uvB[i] : [0, 0]));
        });
        const n = rowA.length;
        for (let i = 0; i < n - 1; i++) {
            const a = base + i;
            const b = base + i + 1;
            const c = base + n + i;
            const d = base + n + i + 1;
            this.indices.push(a, c, b, b, c, d);
        }
    }

    build() {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
        geometry.setIndex(this.indices);
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        return geometry;
    }
}

/** Points moved up by dy: a number, or one value per point. */
const shifted = (points, dy) => points.map((p, i) => new THREE.Vector3(p.x, p.y + (typeof dy === "number" ? dy : dy[i]), p.z));
const smoothstep = (t) => t * t * (3 - 2 * t);
const ON_GROUND = 0.6; // deck within this of the ground lies on it (the ends meeting the approach road)

/** Builds all shown bridges of the given regions. Returns { group, count, dispose }. */
export function buildBridges({ regions, frame, anchorElevation, maxAnisotropy = 8 }) {
    const group = new THREE.Group();
    group.name = "world_bridges";
    group.userData.isTerrain = true;
    const disposables = [];
    const concrete = new THREE.MeshStandardMaterial({ color: "#a9a59d", roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    const pierGeometry = new THREE.CylinderGeometry(0.75, 0.85, 1, 12);
    pierGeometry.translate(0, 0.5, 0);
    disposables.push(concrete, pierGeometry);
    const deckMaterials = new Map();

    for (const region of regions) {
        const toScene = regionToScene(region, frame, anchorElevation);
        for (const bridge of region.bridges || []) {
            if (!isBridgeShown(region, bridge)) continue;
            // Where the deck comes down to the ground (the ends), it lies on the ground instead of
            // standing on it as a slab.
            const centre = bridge.points.map(([x, z, y, ground]) => toScene(x, z, ground !== undefined && y - ground < ON_GROUND ? ground + 0.08 : y));
            const { left, right } = edges(centre, bridge.width / 2);
            const thickness = bridge.thickness ?? 1.3;
            // Parapets fade out as the deck comes down to the ground, so the bridge blends into the road.
            const parapet = bridge.points.map(([, , y, ground]) => (bridge.parapet ?? 1.0) * (ground === undefined ? 1 : smoothstep(Math.min(1, Math.max(0, (y - ground - ON_GROUND) / 2.5)))));

            // Deck top: road texture, u across (left 0 .. right 1), v along (metres / repeat).
            let along = 0;
            const vAlong = centre.map((p, i) => {
                if (i) along += Math.hypot(p.x - centre[i - 1].x, p.z - centre[i - 1].z);
                return along / TEXTURE_LENGTH;
            });
            const top = new StripBuilder();
            top.strip(left, right, vAlong.map((v) => [0, v]), vAlong.map((v) => [1, v]));
            const materialKey = `${bridge.lanes ?? 2}:${bridge.oneway}`;
            if (!deckMaterials.has(materialKey)) {
                const map = roadTexture(bridge.lanes ?? 2, bridge.oneway, maxAnisotropy);
                deckMaterials.set(materialKey, new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
            }
            const topGeometry = top.build();
            disposables.push(topGeometry);
            const deck = new THREE.Mesh(topGeometry, deckMaterials.get(materialKey));

            // Structure: sides, underside, end caps and parapets (concrete).
            const structure = new StripBuilder();
            const leftBottom = shifted(left, -thickness);
            const rightBottom = shifted(right, -thickness);
            structure.strip(left, leftBottom);
            structure.strip(right, rightBottom);
            structure.strip(leftBottom, rightBottom);
            structure.strip([left[0], right[0]], [leftBottom[0], rightBottom[0]]);
            structure.strip([left.at(-1), right.at(-1)], [leftBottom.at(-1), rightBottom.at(-1)]);
            const inner = edges(centre, bridge.width / 2 - Math.min(0.25, bridge.width / 4));
            structure.strip(inner.left, shifted(inner.left, parapet));
            structure.strip(inner.right, shifted(inner.right, parapet));
            structure.strip(shifted(inner.left, parapet), shifted(left, parapet));
            structure.strip(shifted(inner.right, parapet), shifted(right, parapet));
            structure.strip(left, shifted(left, parapet));
            structure.strip(right, shifted(right, parapet));
            const structureGeometry = structure.build();
            disposables.push(structureGeometry);
            const body = new THREE.Mesh(structureGeometry, concrete);

            const bridgeGroup = new THREE.Group();
            bridgeGroup.name = `bridge_${bridge.id}`;
            bridgeGroup.userData = { isTerrain: true, highway: bridge.highway, name: bridge.name };
            bridgeGroup.add(deck, body);

            if (bridge.piers?.length) {
                const piers = new THREE.InstancedMesh(pierGeometry, concrete, bridge.piers.length);
                const matrix = new THREE.Matrix4();
                bridge.piers.forEach(([x, z, topY, bottomY], i) => {
                    const base = toScene(x, z, bottomY - 0.5);
                    matrix.compose(base, new THREE.Quaternion(), new THREE.Vector3(1, Math.max(0.5, topY - bottomY + 0.5), 1));
                    piers.setMatrixAt(i, matrix);
                });
                piers.instanceMatrix.needsUpdate = true;
                piers.computeBoundingSphere();
                bridgeGroup.add(piers);
            }

            bridgeGroup.traverse((object) => {
                if (!object.isMesh) return;
                object.castShadow = true;
                object.receiveShadow = true;
                object.raycast = () => {}; // asset picking ignores bridges, like the terrain
            });
            group.add(bridgeGroup);
        }
    }

    return {
        group,
        count: group.children.length,
        dispose() {
            group.removeFromParent();
            for (const item of disposables) item.dispose();
            for (const material of deckMaterials.values()) material.dispose();
            for (const texture of roadTextureCache.values()) texture.dispose();
            roadTextureCache = new Map();
        },
    };
}
