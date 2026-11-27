import * as THREE from "three";
import { createWorldFrame, geoToUnit, tileKey, unitToGeo } from "./webMercator";
import { createImageQueue } from "./tileQueue";
import { createElevationSource } from "./elevationSource";
import { correctElevation } from "./regionOverlay";
import { paintRoadSurfaces, prepareRoadSurfaces } from "./roadSurfaces";
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
const CURVE_EASE = 24; // px: the road direction is eased this far around each centreline vertex
const MAX_LINE_STEPS = 320; // px: furthest a line is followed under a bridge deck (photo fill)
// Under bridge decks, with the ground roads known (OSM centrelines are often a metre or two off
// the photo): within ROAD_ON_MARGIN m of a road's edge a hidden pixel takes road texture; real
// pixels within ROAD_NEAR_MARGIN m of one are not used for the ground; the ground fill looks up to
// ROAD_SKIP_METRES past a road beside the deck.
const ROAD_ON_MARGIN = 3;
const ROAD_NEAR_MARGIN = 4.5;
const ROAD_SKIP_METRES = 25;
const GROUND_MIRROR_SLACK = 1.5; // metres a ground reflection may slide past a road edge
const ROAD_MIN_CROSSING = 0.3; // |sin| of the angle a road must cross a deck at to be filled under it
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
        const full = size + 2 * 256 * apron;
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
            for (const part of parts) part.then((image) => image?.bitmap.close(), () => {});
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
        const padPx = 256 * apron;
        let canvas = document.createElement("canvas");
        canvas.width = full;
        canvas.height = full;
        let context = canvas.getContext("2d");
        if (images.some((image) => !image?.bitmap)) {
            // Background where a photo is missing.
            context.fillStyle = "#6b7b52";
            context.fillRect(0, 0, full, full);
        }
        for (const image of images) {
            if (!image?.bitmap) continue;
            context.drawImage(image.bitmap, padPx + image.i * 256, padPx + image.j * 256);
            image.bitmap.close();
        }
        this.eraseMaskedImagery(context, tile, size, padPx);
        if (padPx) {
            // Back to the tile itself.
            const tileCanvas = document.createElement("canvas");
            tileCanvas.width = size;
            tileCanvas.height = size;
            const tileContext = tileCanvas.getContext("2d");
            tileContext.drawImage(canvas, padPx, padPx, size, size, 0, 0, size, size);
            canvas.width = canvas.height = 0;
            canvas = tileCanvas;
            context = tileContext;
        }
        paintRoadSurfaces(context, tile, size, this.roadSurfaces, this.frame.metersPerUnit);
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
            texture = new THREE.Texture(bitmap);
            texture.flipY = false; // flipped above
            texture.needsUpdate = true;
            texture.addEventListener("dispose", () => bitmap.close());
            canvas.width = canvas.height = 0; // release the canvas memory now
        } catch (error) {
            if (error.name === "AbortError") throw error;
            texture = new THREE.CanvasTexture(canvas);
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.anisotropy = this.maxAnisotropy;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        return texture;
    }

    /**
     * Fills the masked areas (raised bridge decks) of a tile's photo, so a bridge is not also
     * painted on the ground below it. Each hidden pixel takes the real ground beside the deck,
     * mirrored across the deck's edges (the two sides blended across the width): grass and road
     * texture stay sharp and markings crossing under the deck carry on. Where no mirrored pixel
     * exists (tile edge, another deck) the smooth push-pull average fills in.
     */
    eraseMaskedImagery(context, tile, tileSize, padPx = 0) {
        if (!this.imageryMasks.length) return;
        // The canvas holds the tile plus padPx of the neighbouring photo on each side (lines are
        // followed across the tile's edge); `full` is its width.
        const full = tileSize + 2 * padPx;
        const n = 2 ** tile.z;
        const pad = padPx / (tileSize * n);
        const u0 = tile.x / n - pad;
        const v0 = tile.y / n - pad;
        const u1 = (tile.x + 1) / n + pad;
        const v1 = (tile.y + 1) / n + pad;
        const masks = this.imageryMasks.filter((m) => m.maxU >= u0 && m.minU <= u1 && m.maxV >= v0 && m.minV <= v1);
        if (!masks.length) return;

        const pixelsPerUnit = tileSize * n;
        const masked = new Uint8Array(full * full);
        // Per hidden pixel: nearest deck centre-line point (footX/Y), unit normal across the deck
        // (normX/Y), signed distance along it (side) and the deck half width there (halfPx).
        const best = new Float32Array(full * full).fill(Infinity);
        const footX = new Float32Array(full * full);
        const footY = new Float32Array(full * full);
        const normX = new Float32Array(full * full);
        const normY = new Float32Array(full * full);
        const side = new Float32Array(full * full);
        const halfPx = new Float32Array(full * full);
        let maxHalf = 0;
        let minX = full;
        let minY = full;
        let maxX = -1;
        let maxY = -1;
        for (const mask of masks) {
            const half = mask.halfWidth * pixelsPerUnit;
            if (half < 0.5) continue; // narrower than a pixel at this zoom: nothing to erase
            maxHalf = Math.max(maxHalf, half);
            for (let i = 0; i < mask.points.length - 1; i++) {
                const ax = (mask.points[i].u - u0) * pixelsPerUnit;
                const ay = (mask.points[i].v - v0) * pixelsPerUnit;
                const bx = (mask.points[i + 1].u - u0) * pixelsPerUnit;
                const by = (mask.points[i + 1].v - v0) * pixelsPerUnit;
                const dx = bx - ax;
                const dy = by - ay;
                const lengthSq = dx * dx + dy * dy || 1;
                const xs = Math.max(0, Math.floor(Math.min(ax, bx) - half));
                const xe = Math.min(full - 1, Math.ceil(Math.max(ax, bx) + half));
                const ys = Math.max(0, Math.floor(Math.min(ay, by) - half));
                const ye = Math.min(full - 1, Math.ceil(Math.max(ay, by) + half));
                const first = i === 0;
                const last = i === mask.points.length - 2;
                for (let y = ys; y <= ye; y++) {
                    for (let x = xs; x <= xe; x++) {
                        const along = ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / lengthSq;
                        // Square ends (the deck stops there): a round cap beyond the end only made
                        // streaky fill past the deck.
                        if ((first && along < 0) || (last && along > 1)) continue;
                        const t = Math.max(0, Math.min(1, along));
                        const distance = Math.hypot(x + 0.5 - (ax + t * dx), y + 0.5 - (ay + t * dy));
                        if (distance > half) continue;
                        const q = y * full + x;
                        masked[q] = 1;
                        if (distance < best[q]) {
                            const length = Math.sqrt(lengthSq);
                            best[q] = distance;
                            footX[q] = ax + t * dx;
                            footY[q] = ay + t * dy;
                            normX[q] = -dy / length;
                            normY[q] = dx / length;
                            side[q] = ((x + 0.5 - footX[q]) * normX[q] + (y + 0.5 - footY[q]) * normY[q]);
                            halfPx[q] = half;
                        }
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
        }
        if (maxX < 0) return;

        // Room around the decks for the mirrored pixels (up to two deck widths out).
        // With known roads, more: the ground fill may have to reach past a road beside the deck.
        const margin = Math.ceil(2 * maxHalf + (masks.some((m) => m.roads) ? (ROAD_SKIP_METRES * pixelsPerUnit) / this.frame.metersPerUnit : 0)) + 3;
        const x0 = Math.max(0, minX - margin);
        const y0 = Math.max(0, minY - margin);
        const w = Math.min(full, maxX + margin + 1) - x0;
        const h = Math.min(full, maxY + margin + 1) - y0;
        const image = context.getImageData(x0, y0, w, h);
        const data = image.data;

        // Ground roads near the decks (when the bridges list them): per pixel, the distance (px)
        // beyond the nearest road's edge. Under a deck, road texture belongs only on these; elsewhere
        // (a deck beside a road, or the photo's own deck) the fill uses the ground, not the road.
        const pxPerMetre = pixelsPerUnit / this.frame.metersPerUnit;
        const roadLists = [...new Set(masks.map((m) => m.roads).filter(Boolean))];
        const knowRoads = roadLists.length > 0;
        const roadDist = knowRoads ? new Float32Array(w * h).fill(Infinity) : null;
        // Nearest road per pixel: its index (roadRuns) and the unit direction of its centreline there.
        const roadId = knowRoads ? new Int32Array(w * h).fill(-1) : null;
        const roadTx = knowRoads ? new Float32Array(w * h) : null;
        const roadTy = knowRoads ? new Float32Array(w * h) : null;
        // Along the road: arc length of the nearest centreline point (roadS) and the signed offset from
        // the centreline (roadOff, + to the left of travel), for filling along curved roads.
        const roadS = knowRoads ? new Float32Array(w * h) : null;
        const roadOff = knowRoads ? new Float32Array(w * h) : null;
        const roadGeom = []; // per road: { xs, ys, cum } centreline in pixels (this canvas region)
        let roadRuns = 0;
        const roadSkew = [];
        const ON_ROAD = ROAD_ON_MARGIN * pxPerMetre; // a hidden pixel this close takes road texture
        const NEAR_ROAD = ROAD_NEAR_MARGIN * pxPerMetre; // a real pixel this close is not used as ground
        if (knowRoads) {
            for (const roads of roadLists) {
                for (const road of roads) {
                    const id = roadRuns++;
                    roadSkew.push(road.skew ?? 0);
                    const half = road.half * pixelsPerUnit;
                    const reach = half + NEAR_ROAD + 1;
                    const gx = road.points.map((pt) => (pt.u - u0) * pixelsPerUnit - x0);
                    const gy = road.points.map((pt) => (pt.v - v0) * pixelsPerUnit - y0);
                    const cum = [0];
                    for (let i = 1; i < gx.length; i++) cum.push(cum[i - 1] + Math.hypot(gx[i] - gx[i - 1], gy[i] - gy[i - 1]));
                    roadGeom.push({ xs: gx, ys: gy, cum });
                    for (let i = 0; i < road.points.length - 1; i++) {
                        const ax = (road.points[i].u - u0) * pixelsPerUnit - x0;
                        const ay = (road.points[i].v - v0) * pixelsPerUnit - y0;
                        const bx = (road.points[i + 1].u - u0) * pixelsPerUnit - x0;
                        const by = (road.points[i + 1].v - v0) * pixelsPerUnit - y0;
                        const dx = bx - ax;
                        const dy = by - ay;
                        const lengthSq = dx * dx + dy * dy || 1;
                        const length = Math.sqrt(lengthSq);
                        const xs = Math.max(0, Math.floor(Math.min(ax, bx) - reach));
                        const xe = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + reach));
                        const ys = Math.max(0, Math.floor(Math.min(ay, by) - reach));
                        const ye = Math.min(h - 1, Math.ceil(Math.max(ay, by) + reach));
                        for (let y = ys; y <= ye; y++) {
                            for (let x = xs; x <= xe; x++) {
                                const t = Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / lengthSq));
                                const d = Math.hypot(x + 0.5 - (ax + t * dx), y + 0.5 - (ay + t * dy)) - half;
                                const p = y * w + x;
                                // Under a deck only roads crossing it count: one running along it (an
                                // approach or a road beside / beneath the deck's line) would be followed
                                // along the deck and drag texture across the roads it does cross.
                                const q = (y + y0) * full + (x + x0);
                                if (masked[q] && Math.abs((dx * normX[q] + dy * normY[q]) / length) < ROAD_MIN_CROSSING) continue;
                                if (d < roadDist[p]) {
                                    roadDist[p] = d;
                                    roadId[p] = id;
                                    roadTx[p] = dx / length;
                                    roadTy[p] = dy / length;
                                    roadS[p] = cum[i] + t * length;
                                    roadOff[p] = ((x + 0.5 - (ax + t * dx)) * -dy + (y + 0.5 - (ay + t * dy)) * dx) / length;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Push-pull fill: average the known pixels into ever coarser levels, then fill the hole
        // from those smooth averages (no streaks, unlike copying neighbours inwards).
        const pushPull = (takesPixel) => {
        const levels = [];
        let lw = w;
        let lh = h;
        let colour = new Float32Array(w * h * 3);
        let weight = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const p = y * w + x;
                if (masked[(y + y0) * full + (x + x0)] || !takesPixel(p)) continue;
                colour[p * 3] = data[p * 4];
                colour[p * 3 + 1] = data[p * 4 + 1];
                colour[p * 3 + 2] = data[p * 4 + 2];
                weight[p] = 1;
            }
        }
        levels.push({ w: lw, h: lh, colour, weight });
        while (lw > 1 || lh > 1) {
            const nw = Math.max(1, Math.ceil(lw / 2));
            const nh = Math.max(1, Math.ceil(lh / 2));
            const nextColour = new Float32Array(nw * nh * 3);
            const nextWeight = new Float32Array(nw * nh);
            for (let y = 0; y < lh; y++) {
                for (let x = 0; x < lw; x++) {
                    const p = y * lw + x;
                    const q = (y >> 1) * nw + (x >> 1);
                    const k = weight[p];
                    nextColour[q * 3] += colour[p * 3] * k;
                    nextColour[q * 3 + 1] += colour[p * 3 + 1] * k;
                    nextColour[q * 3 + 2] += colour[p * 3 + 2] * k;
                    nextWeight[q] += k;
                }
            }
            for (let q = 0; q < nw * nh; q++) {
                if (nextWeight[q] > 0) {
                    nextColour[q * 3] /= nextWeight[q];
                    nextColour[q * 3 + 1] /= nextWeight[q];
                    nextColour[q * 3 + 2] /= nextWeight[q];
                    nextWeight[q] = Math.min(1, nextWeight[q]);
                }
            }
            lw = nw;
            lh = nh;
            colour = nextColour;
            weight = nextWeight;
            levels.push({ w: lw, h: lh, colour, weight });
        }
        for (let l = levels.length - 2; l >= 0; l--) {
            const fine = levels[l];
            const coarse = levels[l + 1];
            for (let y = 0; y < fine.h; y++) {
                for (let x = 0; x < fine.w; x++) {
                    const p = y * fine.w + x;
                    const k = fine.weight[p];
                    if (k >= 1) continue;
                    // Bilinear sample of the coarser level at this pixel centre.
                    const cx = Math.min(coarse.w - 1, Math.max(0, (x + 0.5) / 2 - 0.5));
                    const cy = Math.min(coarse.h - 1, Math.max(0, (y + 0.5) / 2 - 0.5));
                    const ax = Math.floor(cx);
                    const ay = Math.floor(cy);
                    const bx = Math.min(coarse.w - 1, ax + 1);
                    const by = Math.min(coarse.h - 1, ay + 1);
                    const tx = cx - ax;
                    const ty = cy - ay;
                    for (let c = 0; c < 3; c++) {
                        const v = (coarse.colour[(ay * coarse.w + ax) * 3 + c] * (1 - tx) + coarse.colour[(ay * coarse.w + bx) * 3 + c] * tx) * (1 - ty)
                            + (coarse.colour[(by * coarse.w + ax) * 3 + c] * (1 - tx) + coarse.colour[(by * coarse.w + bx) * 3 + c] * tx) * ty;
                        fine.colour[p * 3 + c] = fine.colour[p * 3 + c] * k + v * (1 - k);
                    }
                    fine.weight[p] = 1;
                }
            }
        }
        return levels[0].colour;
        };
        const result = pushPull(() => true);
        const isGround = (p) => roadDist[p] > NEAR_ROAD;
        const groundResult = knowRoads ? pushPull(isGround) : result;
        // Mirror fill, from the untouched photo (copied: the loop writes into `data`).
        const source = new Uint8ClampedArray(data);
        const sample = (sx, sy, out) => {
            const ix = Math.floor(sx);
            const iy = Math.floor(sy);
            if (ix < x0 || iy < y0 || ix >= x0 + w || iy >= y0 + h || masked[iy * full + ix]) return false;
            const p = (iy - y0) * w + (ix - x0);
            out[0] = source[p * 4];
            out[1] = source[p * 4 + 1];
            out[2] = source[p * 4 + 2];
            return true;
        };
        // Ground beside the deck for a hidden pixel off the roads: the mirrored pixel at offset
        // `o` along the normal, or (when that is a road or hidden) further out, past the road.
        const groundSample = (fx, fy, nx, ny, o, dir, maxExtra, out) => {
            for (let extra = 0; extra <= maxExtra; extra += 1) {
                const ix = Math.floor(fx + nx * (o + dir * extra));
                const iy = Math.floor(fy + ny * (o + dir * extra));
                if (ix < x0 || iy < y0 || ix >= x0 + w || iy >= y0 + h) return false;
                if (masked[iy * full + ix]) continue;
                const p = (iy - y0) * w + (ix - x0);
                if (!isGround(p)) continue;
                out[0] = source[p * 4];
                out[1] = source[p * 4 + 1];
                out[2] = source[p * 4 + 2];
                return true;
            }
            return false;
        };
        const colourA = [0, 0, 0];
        const colourB = [0, 0, 0];

        // Direction of the lines in the photo around each hidden pixel (structure tensor of the real
        // pixels, averaged over a window about 1.5 deck widths across): lane markings crossing under
        // the deck continue along it. Integral images keep the averaging cheap.
        const lum = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) lum[i] = 0.299 * source[i * 4] + 0.587 * source[i * 4 + 1] + 0.114 * source[i * 4 + 2];
        const W1 = w + 1;
        const sxx = new Float64Array(W1 * (h + 1));
        const sxy = new Float64Array(W1 * (h + 1));
        const syy = new Float64Array(W1 * (h + 1));
        for (let y = 0; y < h; y++) {
            let rxx = 0;
            let rxy = 0;
            let ryy = 0;
            for (let x = 0; x < w; x++) {
                if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
                    const q = (y + y0) * full + (x + x0);
                    if (!masked[q] && !masked[q - 1] && !masked[q + 1] && !masked[q - full] && !masked[q + full]) {
                        const gx = lum[y * w + x + 1] - lum[y * w + x - 1];
                        const gy = lum[(y + 1) * w + x] - lum[(y - 1) * w + x];
                        rxx += gx * gx;
                        rxy += gx * gy;
                        ryy += gy * gy;
                    }
                }
                const o = (y + 1) * W1 + (x + 1);
                sxx[o] = sxx[o - W1] + rxx;
                sxy[o] = sxy[o - W1] + rxy;
                syy[o] = syy[o - W1] + ryy;
            }
        }
        // Lane lines run along their road: under a deck they are continued along the road's own
        // direction (the map centreline) turned by the road's `skew` (bridges.json, measured once from
        // the full-resolution photo). Fixed per road: estimated per tile, the angle differed between
        // tiles and zoom levels, and the lanes under the deck turned while zooming.
        const roadCos = new Float32Array(roadRuns).fill(1);
        const roadSin = new Float32Array(roadRuns);
        for (let id = 0; id < roadRuns; id++) {
            roadCos[id] = Math.cos(roadSkew[id]);
            roadSin[id] = Math.sin(roadSkew[id]);
        }
        const boxSum = (arr, xa, ya, xb, yb) => arr[yb * W1 + xb] - arr[ya * W1 + xb] - arr[yb * W1 + xa] + arr[ya * W1 + xa];
        const radius = Math.ceil(maxHalf * 3) + 8; // wide: a steady direction (a jittering one makes lines wobble)
        // Along a line from (sx, sy) in direction (dx, dy): k = steps to the first real pixel, and
        // the colour reflected along the line itself (the pixel 2k away, just as far beyond the
        // hole's edge): lines stay straight and dashes / texture are copied, not smeared into
        // streaks. The edge pixel itself when the reflected one is not available.
        const pixelAt = (fx, fy, out) => {
            const ix = Math.floor(fx);
            const iy = Math.floor(fy);
            if (ix < x0 || iy < y0 || ix >= x0 + w || iy >= y0 + h || masked[iy * full + ix]) return false;
            const p = ((iy - y0) * w + (ix - x0)) * 4;
            out[0] = source[p];
            out[1] = source[p + 1];
            out[2] = source[p + 2];
            return true;
        };
        const march = (sx, sy, dx, dy, maxSteps, out) => {
            for (let k = 1; k <= maxSteps; k++) {
                const ix = Math.floor(sx + dx * k);
                const iy = Math.floor(sy + dy * k);
                if (ix < x0 || iy < y0 || ix >= x0 + w || iy >= y0 + h) return -1;
                if (masked[iy * full + ix]) continue;
                if (!pixelAt(sx + dx * 2 * k, sy + dy * 2 * k, out)) pixelAt(sx + dx * k, sy + dy * k, out);
                return k;
            }
            return -1;
        };
        const lineA = [0, 0, 0];
        const lineB = [0, 0, 0];

        // A point at arc length s along road id's centreline, `off` pixels to its left (straight on
        // beyond the ends). The tangent is eased over CURVE_EASE px around each vertex, so the offset
        // path has no kinks at the polyline's corners.
        const curvePoint = (id, s, off, out) => {
            const { xs, ys, cum } = roadGeom[id];
            const n = xs.length - 1;
            let i = 0;
            let lo = 0;
            let hi = n - 1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (cum[mid] <= s) {
                    i = mid;
                    lo = mid + 1;
                } else hi = mid - 1;
            }
            const len = cum[i + 1] - cum[i] || 1;
            let tx = (xs[i + 1] - xs[i]) / len;
            let ty = (ys[i + 1] - ys[i]) / len;
            const t = (s - cum[i]) / len;
            const px = xs[i] + tx * (s - cum[i]);
            const py = ys[i] + ty * (s - cum[i]);
            // Ease the direction towards the neighbouring segment near the vertices.
            const ease = (j, along) => {
                if (j < 0 || j >= n) return;
                const l2 = cum[j + 1] - cum[j] || 1;
                const ux = (xs[j + 1] - xs[j]) / l2;
                const uy = (ys[j + 1] - ys[j]) / l2;
                const wgt = 0.5 * Math.max(0, 1 - along / CURVE_EASE);
                tx = tx * (1 - wgt) + ux * wgt;
                ty = ty * (1 - wgt) + uy * wgt;
                const tl = Math.hypot(tx, ty) || 1;
                tx /= tl;
                ty /= tl;
            };
            if (t > 0 && t < 1) {
                ease(i - 1, s - cum[i]);
                ease(i + 1, cum[i + 1] - s);
            }
            out[0] = px - ty * off;
            out[1] = py + tx * off;
        };
        const curveAt = [0, 0];
        // Along road id from arc length s0 in direction dir (+1 / -1), at offset off0 (drifting by the
        // road's skew): steps to the first real pixel, its colour reflected along the road (2k).
        const marchCurve = (id, s0, off0, dir, out) => {
            const drift = roadSin[id];
            for (let k = 1; k <= MAX_LINE_STEPS; k++) {
                curvePoint(id, s0 + dir * k, off0 + dir * k * drift, curveAt);
                const ix = Math.floor(curveAt[0]) + x0;
                const iy = Math.floor(curveAt[1]) + y0;
                if (ix < x0 || iy < y0 || ix >= x0 + w || iy >= y0 + h) return -1;
                if (masked[iy * full + ix]) continue;
                const nearX = curveAt[0] + x0;
                const nearY = curveAt[1] + y0;
                curvePoint(id, s0 + dir * 2 * k, off0 + dir * 2 * k * drift, curveAt);
                if (!pixelAt(curveAt[0] + x0, curveAt[1] + y0, out)) pixelAt(nearX, nearY, out);
                return k;
            }
            return -1;
        };

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const q = (y + y0) * full + (x + x0);
                if (!masked[q]) continue;
                const p = y * w + x;
                const s = side[q];
                const half = halfPx[q];
                if (knowRoads && roadDist[p] > ON_ROAD) {
                    // Off the roads: ground only, mirrored across each edge (a pure reflection: every
                    // hidden pixel its own photo pixel, so grass keeps its texture); the two sides blend
                    // across the width. A side whose mirror lands on a road (a road beside the deck) is
                    // left out and the other side fills the whole width; only where both are roads does
                    // the reflection reach a little past them, then the smooth ground average.
                    // (Walking far past a road made streaks: neighbouring pixels all hit one far pixel.)
                    const near = Math.ceil(GROUND_MIRROR_SLACK * pxPerMetre);
                    let okA = groundSample(footX[q], footY[q], normX[q], normY[q], 2 * half - s, 1, near, colourA);
                    let okB = groundSample(footX[q], footY[q], normX[q], normY[q], -2 * half - s, -1, near, colourB);
                    if (!okA && !okB) {
                        // Roads on both sides (a strip between two roads, or a road running along under the
                        // deck end): it continues along the deck, so take it from beyond the deck end.
                        const tx = normY[q];
                        const ty = -normX[q];
                        const px = x + x0 + 0.5;
                        const py = y + y0 + 0.5;
                        const dA = march(px, py, tx, ty, MAX_LINE_STEPS, colourA);
                        const dB = march(px, py, -tx, -ty, MAX_LINE_STEPS, colourB);
                        if (dA > 0 || dB > 0) {
                            const wa = dA > 0 ? (dB > 0 ? dB / (dA + dB) : 1) : 0;
                            for (let c = 0; c < 3; c++) data[p * 4 + c] = colourA[c] * wa + colourB[c] * (1 - wa);
                            continue;
                        }
                        const maxExtra = Math.ceil(ROAD_SKIP_METRES * pxPerMetre);
                        okA = groundSample(footX[q], footY[q], normX[q], normY[q], 2 * half - s, 1, maxExtra, colourA);
                        okB = groundSample(footX[q], footY[q], normX[q], normY[q], -2 * half - s, -1, maxExtra, colourB);
                    }
                    const k = Math.min(1, Math.max(0, (s + half) / (2 * half)));
                    const wA = okA ? (okB ? k * k * (3 - 2 * k) : 1) : 0;
                    const wB = okB ? (okA ? 1 - k * k * (3 - 2 * k) : 1) : 0;
                    const total = wA + wB;
                    const trust = total > 0 ? 1 : 0;
                    for (let c = 0; c < 3; c++) {
                        const mirrored = total > 0 ? (colourA[c] * wA + colourB[c] * wB) / total : groundResult[p * 3 + c];
                        data[p * 4 + c] = mirrored * trust + groundResult[p * 3 + c] * (1 - trust);
                    }
                    continue;
                }
                if (knowRoads && roadId[p] >= 0) {
                    // On a road under the deck: along the road both ways to the photo beyond the deck,
                    // reflected along it; the nearer side, blended only around the middle (dashes stay sharp).
                    // Along the road's own (curved) centreline at this pixel's offset from it: lanes
                    // stay parallel to the road through bends (straight lines left a jog on curves).
                    const id = roadId[p];
                    const dA = marchCurve(id, roadS[p], roadOff[p], 1, lineA);
                    const dB = marchCurve(id, roadS[p], roadOff[p], -1, lineB);
                    if (dA > 0 || dB > 0) {
                        let wA = dA > 0 ? 1 : 0;
                        if (dA > 0 && dB > 0) {
                            const r = Math.min(1, Math.max(0, (dA / (dA + dB) - 0.35) / 0.3)); // 0 near A .. 1 near B
                            wA = 1 - r * r * (3 - 2 * r);
                        }
                        for (let c = 0; c < 3; c++) data[p * 4 + c] = lineA[c] * wA + lineB[c] * (1 - wA);
                        continue;
                    }
                }
                // Local line direction and how clear it is (coherence 0 .. 1).
                const xa = Math.max(0, x - radius);
                const ya = Math.max(0, y - radius);
                const xb = Math.min(w, x + radius + 1);
                const yb = Math.min(h, y + radius + 1);
                const jxx = boxSum(sxx, xa, ya, xb, yb);
                const jxy = boxSum(sxy, xa, ya, xb, yb);
                const jyy = boxSum(syy, xa, ya, xb, yb);
                const trace = jxx + jyy;
                let directional = 0;
                if (trace > 1e-6) {
                    const diff = Math.sqrt(((jxx - jyy) / 2) ** 2 + jxy * jxy);
                    const coherence = ((2 * diff) / trace) ** 2;
                    const angle = 0.5 * Math.atan2(2 * jxy, jxx - jyy); // gradient direction
                    const vx = -Math.sin(angle); // along the lines
                    const vy = Math.cos(angle);
                    const across = Math.abs(vx * normX[q] + vy * normY[q]); // 1 = straight across the deck
                    // Any clear direction, also lines running at a shallow angle under a deck (a ramp over a
                    // road it nearly follows): mirroring those flips their angle (a skew). The search along
                    // the line is capped (MAX_LINE_STEPS pixels).
                    if (coherence > 0.1 && across > 0.03) {
                        const maxSteps = Math.min(MAX_LINE_STEPS, Math.ceil((2.5 * half) / across) + 2);
                        const dA = march(x + x0 + 0.5, y + y0 + 0.5, vx, vy, maxSteps, lineA);
                        const dB = march(x + x0 + 0.5, y + y0 + 0.5, -vx, -vy, maxSteps, lineB);
                        if (dA > 0 && dB > 0) {
                            // The line's colour on both sides, weighted by distance.
                            for (let c = 0; c < 3; c++) lineA[c] = (lineA[c] * dB + lineB[c] * dA) / (dA + dB);
                            directional = Math.min(1, (coherence - 0.1) / 0.3);
                        }
                    }
                }
                // Mirrored across the + edge (s -> 2h - s) and across the - edge (s -> -2h - s).
                const okA = sample(footX[q] + normX[q] * (2 * half - s), footY[q] + normY[q] * (2 * half - s), colourA);
                const okB = sample(footX[q] + normX[q] * (-2 * half - s), footY[q] + normY[q] * (-2 * half - s), colourB);
                const k = Math.min(1, Math.max(0, (s + half) / (2 * half))); // 1 at the + edge, 0 at the - edge
                // A smooth weight (the seam in the middle blends over the width), each side only when found.
                const wA = okA ? k * k * (3 - 2 * k) : 0;
                const wB = okB ? 1 - k * k * (3 - 2 * k) : 0;
                const total = wA + wB;
                for (let c = 0; c < 3; c++) {
                    const mirrored = total > 0 ? (colourA[c] * wA + colourB[c] * wB) / total : result[p * 3 + c];
                    // Where only one side was found far from it, lean on the smooth fill a little.
                    const trust = total > 0 ? Math.min(1, total * 1.5) : 0;
                    const fill = mirrored * trust + result[p * 3 + c] * (1 - trust);
                    // Clear lines crossing the deck: continue them; else the mirrored ground.
                    data[p * 4 + c] = lineA[c] * directional + fill * (1 - directional);
                }
            }
        }
        context.putImageData(image, x0, y0);
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
        for (const tile of [...this.tiles.values()]) {
            tile.controller?.abort();
            this.unload(tile);
        }
        for (const entry of this.finishing) entry.texture?.dispose();
        this.finishing.length = 0;
        this.queue.prune();
        this.group.removeFromParent();
    }
}

