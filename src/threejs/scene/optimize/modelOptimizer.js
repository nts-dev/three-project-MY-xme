import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshoptSimplifier } from "meshoptimizer";

// One-time optimisation of a downloaded model (before it is cloned/instanced), for scenes whose
// assets were authored far denser than they are seen: a 34k-triangle chair x 30, 150k-triangle
// laptops, 4096² textures on a GPU card.
//  - Geometry: meshes over `minTriangles` are simplified with meshoptimizer (per material group,
//    attribute seams kept) until the error reaches `targetError` (fraction of the mesh size), so
//    shapes stay the same and only redundant tessellation goes.
//  - Textures: images larger than `maxTextureSize` are downscaled once; identical images (same
//    file) share one GPU texture across all materials and models.

const TEXTURE_SLOTS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap", "specularMap", "lightMap", "displacementMap"];

export const DEFAULT_OPTIMIZE_OPTIONS = {
    maxTextureSize: 1024,
    minTriangles: 8000, // smaller meshes are left as authored
    targetError: 0.0035, // ~0.35% of the mesh size: invisible at normal viewing distance
    minRatio: 0.08, // never below 8% of the original triangles
    flatShading: false, // opt-in: weld faceted models on position + uv and draw them flat-shaded
    minFlatShare: 0.85, // ...when at least this share of their normals are face normals
};

// Shared downscaled images, keyed by source URL + size limit.
const sourceCache = new Map();

const triangleCount = (geometry) => (geometry.index ? geometry.index.count : geometry.attributes.position?.count || 0) / 3;

function imageKey(image) {
    return image?.currentSrc || image?.src || null;
}

function downscaledSource(texture, maxSize) {
    const image = texture.image;
    const width = image?.naturalWidth || image?.videoWidth || image?.width || 0;
    const height = image?.naturalHeight || image?.videoHeight || image?.height || 0;
    if (!width || !height || image instanceof HTMLVideoElement || texture.isVideoTexture || texture.isCanvasTexture) return null;
    const key = imageKey(image);
    const cacheKey = key ? `${key}|${maxSize}` : null;
    if (cacheKey && sourceCache.has(cacheKey)) return sourceCache.get(cacheKey);

    const scale = Math.min(1, maxSize / Math.max(width, height));
    let source = texture.source;
    if (scale < 1) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d");
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        source = new THREE.Source(canvas);
    }
    if (cacheKey) sourceCache.set(cacheKey, source);
    return source;
}

function optimizeTexture(texture, options, stats, attempt = 0) {
    if (!texture?.isTexture || texture.userData.__optimized) return;
    if (!texture.image) {
        // TextureLoader assigns the image only once it has downloaded: check again shortly.
        if (attempt < 600) setTimeout(() => optimizeTexture(texture, options, stats, attempt + 1), 100);
        return;
    }
    texture.userData.__optimized = true;
    const apply = () => {
        const source = downscaledSource(texture, options.maxTextureSize);
        if (!source || source === texture.source) return;
        stats.texturesReplaced++;
        texture.source = source;
        texture.needsUpdate = true;
    };
    // FBX textures are still downloading when the model resolves: wait for the image.
    const image = texture.image;
    if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement && !(image.complete && image.naturalWidth)) {
        image.addEventListener("load", apply, { once: true });
    } else {
        apply();
    }
}

// Share of sampled corners whose normal matches the face normal: ~1 for flat-shaded (faceted)
// models such as architecture exported with per-face normals.
function flatNormalShare(geometry, samples = 4000) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    if (!normal) return 1;
    const index = geometry.index?.array;
    const corners = index ? index.length : position.count;
    const step = Math.max(3, Math.floor(corners / 3 / samples) * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const face = new THREE.Vector3(), vertex = new THREE.Vector3();
    let flat = 0;
    let total = 0;
    for (let corner = 0; corner + 2 < corners; corner += step) {
        const i0 = index ? index[corner] : corner;
        const i1 = index ? index[corner + 1] : corner + 1;
        const i2 = index ? index[corner + 2] : corner + 2;
        a.fromBufferAttribute(position, i0);
        b.fromBufferAttribute(position, i1);
        c.fromBufferAttribute(position, i2);
        face.subVectors(c, b).cross(a.sub(b));
        if (face.lengthSq() === 0) continue;
        face.normalize();
        for (const i of [i0, i1, i2]) {
            total++;
            if (Math.abs(vertex.fromBufferAttribute(normal, i).dot(face)) > 0.98) flat++;
        }
    }
    return total ? flat / total : 0;
}

/**
 * Faceted models (options.flatShading): per-face normals stop the simplifier at every edge (each
 * corner is its own vertex), so it can hardly remove anything. Instead the normals are dropped,
 * corners are welded on position + uv only, and the material draws flat shading (three.js derives
 * the face normal in the shader), which looks the same for a faceted model.
 * 153_L2's estate building: 286k triangles -> ~10k at the default error.
 * Returns the welded geometry, or null when the model is not faceted.
 */
function weldFaceted(geometry, options) {
    if (!options.flatShading || flatNormalShare(geometry) < options.minFlatShare) return null;
    const welding = new THREE.BufferGeometry();
    welding.setAttribute("position", geometry.attributes.position);
    if (geometry.attributes.uv) welding.setAttribute("uv", geometry.attributes.uv);
    if (geometry.index) welding.setIndex(geometry.index);
    for (const group of geometry.groups) welding.addGroup(group.start, group.count, group.materialIndex);
    return mergeVertices(welding, 1e-4);
}

/** Simplifies one geometry in place; returns the number of triangles removed (-1: made flat-shaded only). */
function simplifyGeometry(geometry, options) {
    const before = triangleCount(geometry);
    if (before < options.minTriangles || geometry.morphAttributes?.position) return 0;
    const faceted = weldFaceted(geometry, options);
    if (faceted) {
        const removed = simplifyIndexed(geometry, faceted, options, before);
        geometry.userData.flatShaded = true;
        return removed || -1;
    }

    // FBX geometry is not indexed: weld identical vertices so the simplifier sees the surface.
    const indexed = geometry.index ? geometry : mergeVertices(geometry, 1e-5);
    return simplifyIndexed(geometry, indexed, options, before);
}

/**
 * Simplifies `indexed` (geometry itself, or a welded copy of it) per material group and, when it
 * saves enough, puts the result onto `geometry` (shared by reference). Returns triangles removed.
 */
function simplifyIndexed(geometry, indexed, options, before) {
    if (!indexed?.index) return 0;
    const positions = indexed.attributes.position;
    if (positions.isInterleavedBufferAttribute || !(positions.array instanceof Float32Array)) return 0;

    const source = new Uint32Array(indexed.index.array);
    const groups = indexed.groups.length ? indexed.groups : [{ start: 0, count: source.length, materialIndex: 0 }];
    const out = [];
    const newGroups = [];
    for (const group of groups) {
        const slice = source.subarray(group.start, group.start + group.count);
        let result = slice;
        if (slice.length / 3 >= 300) {
            const target = Math.max(3, Math.floor((slice.length * options.minRatio) / 3) * 3);
            // Group-local simplify; without LockBorder seams are still kept (positions are remapped internally).
            [result] = MeshoptSimplifier.simplify(slice, positions.array, 3, target, options.targetError, []);
            if (!result.length) result = slice;
        }
        newGroups.push({ start: out.length, count: result.length, materialIndex: group.materialIndex ?? 0 });
        for (let i = 0; i < result.length; i++) out.push(result[i]);
    }

    const after = out.length / 3;
    if (after >= before * 0.95) return 0; // not worth replacing

    if (indexed !== geometry) {
        // Move the welded attributes onto the original geometry object (it is shared by reference).
        for (const name of Object.keys(geometry.attributes)) geometry.deleteAttribute(name);
        for (const [name, attribute] of Object.entries(indexed.attributes)) geometry.setAttribute(name, attribute);
    }
    geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(out), 1));
    geometry.clearGroups();
    if (indexed.groups.length) newGroups.forEach((g) => geometry.addGroup(g.start, g.count, g.materialIndex));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return before - after;
}

/**
 * Optimises a loaded model in place (call once per download, before cloning).
 * Returns stats: { trianglesBefore, trianglesAfter, meshesSimplified, texturesReplaced } (textures counted as their images load).
 */
export async function optimizeModel(root, overrides = {}) {
    const options = { ...DEFAULT_OPTIMIZE_OPTIONS, ...overrides };
    const stats = { trianglesBefore: 0, trianglesAfter: 0, meshesSimplified: 0, texturesReplaced: 0 };
    if (!root) return stats;
    if (options.targetError > 0) await MeshoptSimplifier.ready;

    const seenGeometries = new Set();
    const seenMaterials = new Set();
    root.traverse((child) => {
        if (!child.isMesh) return;
        const geometry = child.geometry;
        if (geometry && !seenGeometries.has(geometry)) {
            seenGeometries.add(geometry);
            const before = triangleCount(geometry);
            stats.trianglesBefore += before;
            if (options.targetError > 0 && !child.isSkinnedMesh) {
                try {
                    if (simplifyGeometry(geometry, options) > 0) stats.meshesSimplified++;
                } catch (error) {
                    console.warn(`[optimizeModel] could not simplify ${child.name}`, error);
                }
            }
            stats.trianglesAfter += triangleCount(geometry);
        }
        for (const material of [].concat(child.material)) {
            // A welded faceted mesh has no normals left: its materials shade per face instead.
            if (material && geometry?.userData.flatShaded && !material.flatShading) {
                material.flatShading = true;
                material.needsUpdate = true;
            }
            if (!material || seenMaterials.has(material)) continue;
            seenMaterials.add(material);
            for (const slot of TEXTURE_SLOTS) optimizeTexture(material[slot], options, stats);
        }
    });
    return stats;
}

// Projects whose models are optimised on load, with per-project overrides: a level id ("153_L2")
// applies to that level only, a base id (137) to all of the project's levels.
const PROJECT_OPTIMIZE_OPTIONS = {
    137: {},
    // XME map: the estate buildings model is 286k triangles, x35 instances (10M per frame),
    // exported with per-face normals: welded and drawn flat-shaded (see weldFaceted).
    // The error limit (targetError) keeps the shape; the ratio floor only guards against collapse.
    "153_L2": { flatShading: true, minRatio: 0.02 },
};

const hasOptions = (key) => Object.prototype.hasOwnProperty.call(PROJECT_OPTIMIZE_OPTIONS, key);

/** Optimise options for a project id ("137_L0", 137, "153_L2", …), or null when the project is not opted in. */
export function getProjectOptimizeOptions(projectId) {
    const level = String(projectId ?? "").trim().toUpperCase();
    if (hasOptions(level)) return PROJECT_OPTIMIZE_OPTIONS[level];
    const base = Number.parseInt(level.split("_")[0], 10);
    return hasOptions(base) ? PROJECT_OPTIMIZE_OPTIONS[base] : null;
}
