import * as THREE from "three";
import { createWorldFrame, geoToUnit, tileKey, unitToGeo } from "./webMercator";
import { createImageQueue } from "./tileQueue";
import { createElevationSource } from "./elevationSource";
import { correctElevation } from "./regionOverlay";
import { prepareRoadSurfaces } from "./roadSurfaces";
import { composeTileImagery } from "./tileImagery";
import { createTileImageryWorker } from "./tileImageryWorkerClient";
import { groundMaterial } from "./groundMaterial";
import { applyWetSurface } from "./wetSurface";

// Endless terrain: map tiles (z/x/y, Web Mercator) chosen by distance to the camera, a quadtree.
// Near the camera tiles split into four finer ones; far away they stay coarse, so only a few
// hundred tiles are loaded wherever the camera is. Each tile is one mesh with its satellite
// image; tiles out of range are unloaded (a small cache is kept for when the camera returns).
//
// Scene positions stay exact far from the origin because each tile's vertices are local to the
// tile and three.js composes model and view matrices on the CPU in double precision.

const DEFAULTS = {
    rootZoom: 9, // ~78 km tiles; a 3 x 3 block around the camera is the coarsest level
    rootRadius: 1,
    maxZoom: 18, // finest terrain tiles (~150 m)
    splitFactor: 1.6, // split a tile when the camera is closer than splitFactor x its size
    segments: 32, // grid cells per tile side
    cacheSize: 80, // loaded tiles kept while not visible (fallbacks and quick returns)
    imageryBoostFromZoom: 14, // tiles at this zoom and finer use imagery one zoom deeper
    imageryMaxZoom: 18,
};

// Tile finishing: no heavy step in a frame right after one slower than this (ms), at most
// FINISH_MAX_SKIPS frames in a row (tiles still arrive while the frame rate is low).
const FINISH_SLOW_FRAME_MS = 24;
const IMAGERY_APRON = 1; // sub-tiles (256 px) of neighbouring photo loaded around tiles under a deck
const FINISH_MAX_SKIPS = 3;
const ALL_ROUND_RADIUS = 450; // metres: tiles this close are split whichever way the camera looks
const DETAIL_RADIUS = 75;
const DETAIL_TILE_LIMIT = 2;
const DETAIL_HYSTERESIS = 15;
const DETAIL_RETRY_MS = 30_000;

export class WorldTerrain {
    constructor({ anchor, anchorElevation = 0, regions = [], localElevation = null, imagery, imageryMasks = [], roadSurfaces = [], maxAnisotropy = 8, ...options }) {
        this.options = { ...DEFAULTS, ...options };
        this.frame = createWorldFrame(anchor);
        // Roads painted over the photo (straight asphalt and markings), see roadSurfaces.js.
        this.roadSurfaces = prepareRoadSurfaces(roadSurfaces, this.frame.metersPerUnit);
        // Areas erased from the ground photo (e.g. under raised bridge decks): geo polylines with a
        // half width in metres, kept in map units for fast per-tile tests.
        const roadsInUnits = new Map(); // shared per bridge (all its masks carry the same list)
        this.imageryMasks = imageryMasks.map((mask) => {
            const halfWidth = mask.halfWidth / this.frame.metersPerUnit;
            // Without near-duplicate points: a zero-length end segment would defeat the square ends.
            const minStep = 0.05 / this.frame.metersPerUnit;
            const points = [];
            for (const { lat, lon } of mask.points) {
                const p = geoToUnit(lat, lon);
                const last = points[points.length - 1];
                if (!last || Math.hypot(p.u - last.u, p.v - last.v) > minStep) points.push(p);
            }
            if (mask.roads && !roadsInUnits.has(mask.roads)) {
                roadsInUnits.set(mask.roads, mask.roads.map((road) => ({
                    half: road.half / this.frame.metersPerUnit,
                    skew: road.skew ?? 0,
                    points: road.points.map(({ lat, lon }) => geoToUnit(lat, lon)),
                })));
            }
            return {
                points,
                halfWidth,
                roads: mask.roads ? roadsInUnits.get(mask.roads) : null,
                minU: Math.min(...points.map((p) => p.u)) - halfWidth,
                maxU: Math.max(...points.map((p) => p.u)) + halfWidth,
                minV: Math.min(...points.map((p) => p.v)) - halfWidth,
                maxV: Math.max(...points.map((p) => p.v)) + halfWidth,
            };
        });
        this.anchorElevation = anchorElevation;
        this.regions = regions;
        // Optional finer ground for part of the scene (Google Elevation API, see googleElevation.js):
        // { heightAt(x, z, baseElevation) } in scene metres -> metres above sea level.
        this.localElevation = localElevation;
        this.imagery = imagery; // { url, maxZoom } or null
        this.maxAnisotropy = maxAnisotropy;
        this.queue = createImageQueue({ concurrency: 12 });
        this.elevation = createElevationSource(this.queue);
        this.imageryWorker = imagery && this.imageryMasks.length ? createTileImageryWorker() : null;
        this.tiles = new Map();
        this.finishing = []; // downloaded tiles waiting for finishTiles: { tile, controller, sample, texture }
        this.detailedTiles = new Set();
        this.detailTask = null;
        this.group = new THREE.Group();
        this.group.name = "world_terrain";
        this.group.userData.isTerrain = true;
        this.frustum = new THREE.Frustum();
        this.matrix = new THREE.Matrix4();
        this.box = new THREE.Box3();
        this.disposed = false;
        this.finishSkips = 0;
        this.stats = { visible: 0, loaded: 0, loading: 0 };
    }

    tileScene(z, x, y) {
        const n = 2 ** z;
        const { x: x0, z: z0 } = this.frame.unitToScene(x / n, y / n);
        return { x0, z0, size: this.frame.metersPerUnit / n };
    }

    getTile(z, x, y) {
        const key = tileKey(z, x, y);
        let tile = this.tiles.get(key);
        if (!tile) {
            tile = { key, z, x, y, ...this.tileScene(z, x, y), state: "idle", distance: Infinity, lastUsed: 0 };
            this.tiles.set(key, tile);
        }
        return tile;
    }

    parentOf(tile) {
        return tile.z > this.options.rootZoom ? this.getTile(tile.z - 1, tile.x >> 1, tile.y >> 1) : null;
    }

    /** Re-selects, loads, shows and unloads tiles for the camera. Call a few times per second. */
    update(camera, characterPosition = null) {
        if (this.disposed) return;
        const { rootZoom, rootRadius, maxZoom, splitFactor } = this.options;
        const now = performance.now();
        const position = camera.getWorldPosition(new THREE.Vector3());
        const ground = this.heightAt(position.x, position.z) ?? 0;
        const height = Math.max(1, position.y - ground);
        camera.updateMatrixWorld();
        this.frustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));

        // 1. Wanted tiles (quadtree leaves).
        const leaves = [];
        const visit = (tile) => {
            const dx = Math.max(tile.x0 - position.x, 0, position.x - (tile.x0 + tile.size));
            const dz = Math.max(tile.z0 - position.z, 0, position.z - (tile.z0 + tile.size));
            tile.distance = Math.hypot(dx, dz, height);
            let split = tile.z < maxZoom && tile.distance < splitFactor * tile.size;
            if (split && tile.z >= rootZoom + 2 && tile.distance > ALL_ROUND_RADIUS) {
                // Off-screen areas stay coarse, except close by: there the tiles do not depend on the
                // view direction, so turning (the avatar's follow camera swings round with it) does not
                // rebuild and re-upload the nearby tiles over and over.
                this.box.min.set(tile.x0, ground - 500, tile.z0);
                this.box.max.set(tile.x0 + tile.size, ground + 3000, tile.z0 + tile.size);
                split = this.frustum.intersectsBox(this.box);
            }
            if (!split) {
                leaves.push(tile);
                return;
            }
            for (let i = 0; i < 4; i++) visit(this.getTile(tile.z + 1, tile.x * 2 + (i & 1), tile.y * 2 + (i >> 1)));
        };
        const n = 2 ** rootZoom;
        const { u, v } = this.frame.sceneToUnit(position.x, position.z);
        const cx = Math.floor(u * n);
        const cy = Math.floor(v * n);
        for (let ty = cy - rootRadius; ty <= cy + rootRadius; ty++) {
            for (let tx = cx - rootRadius; tx <= cx + rootRadius; tx++) {
                if (tx >= 0 && ty >= 0 && tx < n && ty < n) visit(this.getTile(rootZoom, tx, ty));
            }
        }

        // 2. Load wanted tiles; until a tile is ready, show its nearest loaded ancestor or
        //    loaded descendants (no holes while zooming in or out).
        const wanted = new Set(leaves);
        const shown = new Set();
        const collectReadyDescendants = (tile, depth) => {
            if (depth > 2) return false;
            const children = [0, 1, 2, 3].map((i) => this.tiles.get(tileKey(tile.z + 1, tile.x * 2 + (i & 1), tile.y * 2 + (i >> 1))));
            if (!children.every((child) => child && (child.state === "ready" || collectReadyDescendants(child, depth + 1)))) return false;
            children.forEach((child) => child.state === "ready" && shown.add(child));
            return true;
        };
        for (const tile of leaves) {
            tile.lastUsed = now;
            if (tile.state === "idle") this.load(tile);
            if (tile.state === "ready") {
                shown.add(tile);
                continue;
            }
            let ancestor = this.parentOf(tile);
            while (ancestor && ancestor.state !== "ready") ancestor = this.parentOf(ancestor);
            if (ancestor) shown.add(ancestor);
            else collectReadyDescendants(tile, 0);
        }
        // A shown ancestor covers its area: hide its shown descendants (no overlapping tiles).
        for (const tile of shown) {
            for (let ancestor = this.parentOf(tile); ancestor; ancestor = this.parentOf(ancestor)) {
                if (shown.has(ancestor)) {
                    shown.delete(tile);
                    break;
                }
            }
        }
        for (const tile of shown) {
            tile.lastUsed = now;
            for (let ancestor = this.parentOf(tile); ancestor; ancestor = this.parentOf(ancestor)) ancestor.lastUsed = now;
        }

        // 3. Apply visibility; cancel loads no longer wanted; unload old tiles.
        let loaded = 0;
        let loading = 0;
        const evictable = [];
        for (const tile of this.tiles.values()) {
            if (tile.mesh) tile.mesh.visible = shown.has(tile);
            if (tile.state === "loading" && !wanted.has(tile)) {
                tile.controller.abort();
                tile.state = "idle";
            }
            if (tile.state === "loading") loading++;
            if (tile.state === "ready") {
                loaded++;
                if (!shown.has(tile) && !wanted.has(tile)) evictable.push(tile);
            }
            if (tile.state === "idle" && !wanted.has(tile) && now - tile.lastUsed > 5000) this.tiles.delete(tile.key);
        }
        if (this.options.characterImagery) this.updateCharacterImagery(shown, characterPosition, now);
        this.queue.prune();
        if (evictable.length > this.options.cacheSize) {
            evictable.sort((a, b) => a.lastUsed - b.lastUsed);
            for (const tile of evictable.slice(0, evictable.length - this.options.cacheSize)) this.unload(tile);
        }
        this.stats = { visible: shown.size, loaded, loading, wanted: leaves.length, detailed: this.detailedTiles.size };
    }

    /**
     * Turns up to `maxTiles` downloaded tiles into meshes (heights, mesh, texture upload), nearest
     * first. Call every frame. With `renderer`, the texture is uploaded here (renderer.initTexture)
     * instead of in the frame the tile first shows. One per frame measured best in Firefox while
     * turning the view (42-45 fps vs 20-30 fps with a 4 ms budget): the cost is the GPU upload of
     * each 512² photo with mipmaps, which does not show in JavaScript time.
     */
    /**
     * Turns downloaded tiles into meshes, spread over frames so walking into new ground does not
     * hitch: one heavy step per frame (a tile's mesh, or uploading its photo, not both), and none in
     * a frame right after a slow one (frameMs), unless tiles have waited FINISH_MAX_SKIPS frames.
     */
    finishTiles(renderer, maxTiles = 1, frameMs = 0) {
        if (this.disposed) return;
        if (frameMs > FINISH_SLOW_FRAME_MS && this.finishSkips < FINISH_MAX_SKIPS && (this.finishing.length || this.detailTask?.texture)) {
            this.finishSkips++;
            return;
        }
        this.finishSkips = 0;
        let finished = 0;
        this.finishing.sort((a, b) => a.tile.distance - b.tile.distance);
        while (this.finishing.length && finished < maxTiles) {
            const job = this.finishing[0];
            const { tile, controller, sample, texture } = job;
            if (controller.signal.aborted || tile.controller !== controller || !this.tiles.has(tile.key)) {
                this.finishing.shift();
                if (job.mesh) {
                    job.mesh.geometry.dispose();
                    job.mesh.material.dispose?.();
                }
                texture?.dispose(); // cancelled (or restarted) while waiting
                continue;
            }
            if (!job.mesh) {
                // Step 1: heights and mesh (CPU).
                const heights = this.buildHeights(tile, sample);
                job.heights = heights;
                job.mesh = this.buildMesh(tile, heights, texture);
                finished++;
                if (texture && renderer?.initTexture) break; // the upload in a later frame
            }
            // Step 2: the photo to the GPU, then the tile is ready to be shown.
            this.finishing.shift();
            if (texture && renderer?.initTexture && finished === 0) {
                renderer.initTexture(texture);
                finished++;
            }
            tile.heights = job.heights;
            tile.mesh = job.mesh;
            tile.mesh.visible = false;
            this.group.add(tile.mesh);
            tile.state = "ready";
            if (finished >= maxTiles) break;
        }
        const detail = this.detailTask;
        if (finished < maxTiles && detail?.texture) {
            const { tile, texture } = detail;
            const material = tile.mesh.material;
            renderer?.initTexture?.(texture);
            tile.baseTexture = material.map;
            material.map = texture;
            material.emissiveMap = texture;
            this.detailedTiles.add(tile);
            this.detailTask = null;
        }
    }

    /** Upgrade only the closest visible terrain tiles, keeping their geometry and base photos. */
    updateCharacterImagery(shown, focus, now) {
        const candidates = [];
        if (focus) {
            for (const tile of shown) {
                if (tile.z !== this.options.maxZoom || !tile.mesh.material.map) continue;
                if (this.detailZoom(tile) <= this.imageryZoom(tile)) continue;
                const dx = Math.max(tile.x0 - focus.x, 0, focus.x - tile.x0 - tile.size);
                const dz = Math.max(tile.z0 - focus.z, 0, focus.z - tile.z0 - tile.size);
                const current = this.detailedTiles.has(tile) || this.detailTask?.tile === tile;
                const distance = Math.hypot(dx, dz) - (current ? DETAIL_HYSTERESIS : 0);
                if (distance <= DETAIL_RADIUS) candidates.push({ tile, distance });
            }
        }
        candidates.sort((a, b) => a.distance - b.distance);
        const wanted = candidates.slice(0, DETAIL_TILE_LIMIT).map(({ tile }) => tile);
        if (this.detailTask && !wanted.includes(this.detailTask.tile)) this.cancelDetail();
        for (const tile of this.detailedTiles) {
            if (!wanted.includes(tile)) this.restoreBaseTexture(tile);
        }
        if (this.detailTask) return;
        const tile = wanted.find((candidate) => !this.detailedTiles.has(candidate) && now >= (candidate.detailRetryAfter ?? 0));
        if (!tile) return;

        const task = { tile, controller: new AbortController(), texture: null };
        this.detailTask = task;
        const retryLater = () => {
            if (this.detailTask !== task) return;
            tile.detailRetryAfter = performance.now() + DETAIL_RETRY_MS;
            this.detailTask = null;
        };
        this.loadImagery(tile, task.controller.signal, () => tile.distance + DETAIL_RADIUS, this.detailZoom(tile), true)
            .then((texture) => {
                if (this.detailTask !== task) texture?.dispose();
                else if (texture) task.texture = texture;
                else retryLater();
            }, retryLater);
    }

    cancelDetail() {
        this.detailTask?.controller.abort();
        this.detailTask?.texture?.dispose();
        this.detailTask = null;
    }

    restoreBaseTexture(tile) {
        const material = tile.mesh.material;
        material.map.dispose();
        material.map = tile.baseTexture;
        material.emissiveMap = tile.baseTexture;
        delete tile.baseTexture;
        this.detailedTiles.delete(tile);
    }

    async load(tile) {
        tile.state = "loading";
        const controller = new AbortController();
        tile.controller = controller;
        const priority = () => tile.distance;
        try {
            const [sample, texture] = await Promise.all([
                this.elevation.samplerFor(tile.z, tile.x, tile.y, priority),
                this.loadImagery(tile, controller.signal, priority),
            ]);
            if (controller.signal.aborted || this.disposed) {
                texture?.dispose();
                return;
            }
            // Built and uploaded later by finishTiles, a few per frame: up to 12 tiles download
            // at once, and finishing them all in one frame froze it for 80+ ms.
            this.finishing.push({ tile, controller, sample, texture });
        } catch (error) {
            if (error.name === "AbortError") return;
            console.warn(`[terrain] tile ${tile.key} failed`, error);
            tile.state = "failed";
        }
    }

    buildHeights(tile, sample) {
        const { segments } = this.options;
        const n = 2 ** tile.z;
        const heights = new Float32Array((segments + 1) ** 2);
        for (let r = 0; r <= segments; r++) {
            for (let c = 0; c <= segments; c++) {
                const u = (tile.x + c / segments) / n;
                const v = (tile.y + r / segments) / n;
                let elevation = sample(u, v);
                if (this.regions.length) {
                    const { lat, lon } = unitToGeo(u, v);
                    elevation = correctElevation(this.regions, lat, lon, elevation);
                }
                if (this.localElevation) {
                    const { x, z } = this.frame.unitToScene(u, v);
                    elevation = this.localElevation.heightAt(x, z, elevation);
                }
                heights[r * (segments + 1) + c] = elevation - this.anchorElevation;
            }
        }
        return heights;
    }

    imageryZoom(tile) {
        const { imageryBoostFromZoom, imageryMaxZoom } = this.options;
        return Math.min(this.imagery?.maxZoom ?? imageryMaxZoom, imageryMaxZoom, tile.z + (tile.z >= imageryBoostFromZoom ? 1 : 0));
    }

    detailZoom(tile) {
        const base = this.imageryZoom(tile);
        return Math.min(this.imagery?.maxZoom ?? base, base + 1, tile.z + 2);
    }

    async loadImagery(tile, signal, priority, zoom = this.imageryZoom(tile), requireComplete = false) {
        if (!this.imagery) return null;
        const per = 2 ** Math.max(0, zoom - tile.z);
        const size = 256 * per;
        // Tiles under a raised deck get a ring of the neighbouring photo (IMAGERY_APRON sub-tiles):
        // the fill under the deck follows the roads across the tile's edge. Without it, lanes near
        // an edge fell back to the mirrored fill (skewed, with a seam along the tile edge).
        const n = 2 ** tile.z;
        const apron = this.imageryMasks.some((m) => m.maxU >= tile.x / n && m.minU <= (tile.x + 1) / n && m.maxV >= tile.y / n && m.minV <= (tile.y + 1) / n)
            ? IMAGERY_APRON : 0;
        // Download first, then create and paint the canvas: creating and filling a new canvas up
        // front ran synchronously in update() for every newly wanted tile (Firefox: 20-45 ms
        // update calls while the view turned).
        const parts = [];
        const columns = 2 ** zoom;
        for (let j = -apron; j < per + apron; j++) {
            for (let i = -apron; i < per + apron; i++) {
                const ring = i < 0 || j < 0 || i >= per || j >= per;
                const x = tile.x * per + i;
                const y = tile.y * per + j;
                if (ring && (x < 0 || y < 0 || x >= columns || y >= columns)) continue;
                const url = this.imagery.url.replace("{z}", zoom).replace("{x}", x).replace("{y}", y);
                parts.push(this.queue.load(url, { signal, priority }).then((bitmap) => ({ i, j, bitmap, ring })).catch((error) => {
                    if (error.name === "AbortError") throw error;
                    if (ring) return { i, j, bitmap: null, ring }; // context only: the fill copes without it
                    if (!requireComplete) console.warn(`[terrain] imagery ${zoom}/${x}/${y} failed`, error);
                    return null;
                }));
            }
        }
        let images;
        try {
            images = await Promise.all(parts);
        } catch (error) {
            // One part aborted: release the parts that did arrive.
            for (const part of parts) part.then((image) => image?.bitmap?.close(), () => {});
            throw error;
        }
        if (signal?.aborted) {
            images.forEach((image) => image?.bitmap?.close());
            throw new DOMException("Aborted", "AbortError");
        }
        if (requireComplete && images.some((image) => !image)) {
            images.forEach((image) => image?.bitmap?.close());
            return null;
        }
        const job = {
            tile: { x: tile.x, y: tile.y, z: tile.z }, size, apron, images,
            imageryMasks: this.imageryMasks, roadSurfaces: this.roadSurfaces,
            metersPerUnit: this.frame.metersPerUnit,
        };
        if (apron && this.imageryWorker?.enabled) {
            let bitmap;
            try {
                bitmap = await this.imageryWorker.compose(job, signal, priority);
            } catch (error) {
                if (signal.aborted || error.name === "AbortError") throw new DOMException("Aborted", "AbortError");
                // The worker owns the input bitmaps. Retry the tile on the main thread if it fails.
                return this.loadImagery(tile, signal, priority, zoom, requireComplete);
            }
            return this.imageryTexture(bitmap);
        }
        const canvas = composeTileImagery(job, (width, height) => Object.assign(document.createElement("canvas"), { width, height }));
        // Handed to the GPU as an ImageBitmap, flipped while it is made (off the frame): uploading
        // the canvas itself made the browser flip / convert it in the frame of the upload (about
        // twice as long, a visible hitch while walking into new tiles).
        let texture;
        try {
            if (typeof createImageBitmap !== "function") throw new Error("no ImageBitmap");
            const bitmap = await createImageBitmap(canvas, { imageOrientation: "flipY", premultiplyAlpha: "none" });
            if (signal?.aborted) {
                bitmap.close();
                throw new DOMException("Aborted", "AbortError");
            }
            texture = this.imageryTexture(bitmap);
            canvas.width = canvas.height = 0; // release the canvas memory now
        } catch (error) {
            if (error.name === "AbortError") throw error;
            texture = this.configureImageryTexture(new THREE.CanvasTexture(canvas));
        }
        return texture;
    }

    imageryTexture(bitmap) {
        const texture = new THREE.Texture(bitmap);
        texture.flipY = false;
        texture.needsUpdate = true;
        texture.addEventListener("dispose", () => bitmap.close());
        return this.configureImageryTexture(texture);
    }

    configureImageryTexture(texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.anisotropy = this.maxAnisotropy;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        return texture;
    }

    buildMesh(tile, heights, texture) {
        const { segments } = this.options;
        const side = segments + 1;
        const step = tile.size / segments;
        const gridCount = side * side;
        const skirtCount = segments * 4;
        const positions = new Float32Array((gridCount + skirtCount) * 3);
        const normals = new Float32Array((gridCount + skirtCount) * 3);
        const uvs = new Float32Array((gridCount + skirtCount) * 2);
        const at = (c, r) => heights[Math.min(segments, Math.max(0, r)) * side + Math.min(segments, Math.max(0, c))];

        for (let r = 0; r <= segments; r++) {
            for (let c = 0; c <= segments; c++) {
                const i = r * side + c;
                positions.set([c * step, at(c, r), r * step], i * 3);
                const dx = (at(c + 1, r) - at(c - 1, r)) / ((Math.min(segments, c + 1) - Math.max(0, c - 1)) * step);
                const dz = (at(c, r + 1) - at(c, r - 1)) / ((Math.min(segments, r + 1) - Math.max(0, r - 1)) * step);
                const length = Math.hypot(dx, 1, dz);
                normals.set([-dx / length, 1 / length, -dz / length], i * 3);
                uvs.set([c / segments, 1 - r / segments], i * 2);
            }
        }

        // Skirts: a strip hanging down along the edges hides cracks next to coarser tiles.
        const skirtDepth = Math.max(5, tile.size * 0.03);
        const ring = [];
        for (let c = 0; c < segments; c++) ring.push([c, 0]);
        for (let r = 0; r < segments; r++) ring.push([segments, r]);
        for (let c = segments; c > 0; c--) ring.push([c, segments]);
        for (let r = segments; r > 0; r--) ring.push([0, r]);
        ring.forEach(([c, r], k) => {
            const source = r * side + c;
            const target = gridCount + k;
            positions.set([c * step, at(c, r) - skirtDepth, r * step], target * 3);
            normals.set(normals.subarray(source * 3, source * 3 + 3), target * 3);
            uvs.set(uvs.subarray(source * 2, source * 2 + 2), target * 2);
        });

        const indices = [];
        for (let r = 0; r < segments; r++) {
            for (let c = 0; c < segments; c++) {
                const a = r * side + c;
                const b = a + 1;
                const d = a + side;
                const e = d + 1;
                indices.push(a, d, b, b, d, e);
            }
        }
        ring.forEach(([c, r], k) => {
            const [nc, nr] = ring[(k + 1) % ring.length];
            const top0 = r * side + c;
            const top1 = nr * side + nc;
            const bottom0 = gridCount + k;
            const bottom1 = gridCount + ((k + 1) % ring.length);
            // Both windings, so the skirt is visible from either side.
            indices.push(top0, bottom0, top1, top1, bottom0, bottom1, top0, top1, bottom0, top1, bottom1, bottom0);
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
        geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeBoundingSphere();

        const material = texture
            ? applyWetSurface(groundMaterial({ map: texture }), { puddles: false, strength: 0.5 }) // rain: darker, damp sheen
            : applyWetSurface(groundMaterial({ color: "#7d8f5a" }), { puddles: false, strength: 0.5 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `terrain_${tile.key}`;
        mesh.position.set(tile.x0, 0, tile.z0);
        mesh.receiveShadow = true;
        mesh.userData.isTerrain = true;
        mesh.raycast = () => {}; // asset picking ignores terrain; use heightAt for the ground
        mesh.updateMatrix();
        mesh.matrixAutoUpdate = false;
        return mesh;
    }

    unload(tile) {
        if (this.detailTask?.tile === tile) this.cancelDetail();
        if (this.detailedTiles.has(tile)) this.restoreBaseTexture(tile);
        if (tile.mesh) {
            tile.mesh.removeFromParent();
            tile.mesh.geometry.dispose();
            tile.mesh.material.map?.dispose();
            tile.mesh.material.dispose();
        }
        this.tiles.delete(tile.key);
    }

    /** Ground height (scene y) at scene x/z from the finest loaded tile, or null if none covers it. */
    heightAt(x, z) {
        const { u, v } = this.frame.sceneToUnit(x, z);
        const { segments, maxZoom, rootZoom } = this.options;
        for (let zoom = maxZoom; zoom >= rootZoom; zoom--) {
            const n = 2 ** zoom;
            const tile = this.tiles.get(tileKey(zoom, Math.floor(u * n), Math.floor(v * n)));
            if (tile?.state !== "ready") continue;
            const fx = (u * n - tile.x) * segments;
            const fz = (v * n - tile.y) * segments;
            const c = Math.min(segments - 1, Math.floor(fx));
            const r = Math.min(segments - 1, Math.floor(fz));
            const tx = fx - c;
            const tz = fz - r;
            const h = (cc, rr) => tile.heights[rr * (segments + 1) + cc];
            return (h(c, r) * (1 - tx) + h(c + 1, r) * tx) * (1 - tz) + (h(c, r + 1) * (1 - tx) + h(c + 1, r + 1) * tx) * tz;
        }
        return null;
    }

    dispose() {
        this.disposed = true;
        this.cancelDetail();
        for (const tile of [...this.tiles.values()]) {
            tile.controller?.abort();
            this.unload(tile);
        }
        this.imageryWorker?.disable();
        for (const { mesh, texture } of this.finishing) {
            mesh?.geometry.dispose();
            mesh?.material.dispose();
            texture?.dispose();
        }
        this.finishing.length = 0;
        this.queue.prune();
        this.group.removeFromParent();
    }
}

