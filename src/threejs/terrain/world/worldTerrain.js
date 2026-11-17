import * as THREE from "three";
import { createWorldFrame, geoToUnit, tileKey, unitToGeo } from "./webMercator";
import { createImageQueue } from "./tileQueue";
import { createElevationSource } from "./elevationSource";
import { correctElevation } from "./regionOverlay";
import { paintRoadSurfaces, prepareRoadSurfaces } from "./roadSurfaces";

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


export class WorldTerrain {
    constructor({ anchor, anchorElevation = 0, regions = [], imagery, imageryMasks = [], roadSurfaces = [], maxAnisotropy = 8, ...options }) {
        this.options = { ...DEFAULTS, ...options };
        this.frame = createWorldFrame(anchor);
        // Roads painted over the photo (straight asphalt and markings), see roadSurfaces.js.
        this.roadSurfaces = prepareRoadSurfaces(roadSurfaces, this.frame.metersPerUnit);
        // Areas erased from the ground photo (e.g. under raised bridge decks): geo polylines with a
        // half width in metres, kept in map units for fast per-tile tests.
        this.imageryMasks = imageryMasks.map((mask) => {
            const points = mask.points.map(({ lat, lon }) => geoToUnit(lat, lon));
            const halfWidth = mask.halfWidth / this.frame.metersPerUnit;
            return {
                points,
                halfWidth,
                minU: Math.min(...points.map((p) => p.u)) - halfWidth,
                maxU: Math.max(...points.map((p) => p.u)) + halfWidth,
                minV: Math.min(...points.map((p) => p.v)) - halfWidth,
                maxV: Math.max(...points.map((p) => p.v)) + halfWidth,
            };
        });
        this.anchorElevation = anchorElevation;
        this.regions = regions;
        this.imagery = imagery; // { url, maxZoom } or null
        this.maxAnisotropy = maxAnisotropy;
        this.queue = createImageQueue({ concurrency: 12 });
        this.elevation = createElevationSource(this.queue);
        this.tiles = new Map();
        this.finishing = []; // downloaded tiles waiting for finishTiles: { tile, controller, sample, texture }
        this.group = new THREE.Group();
        this.group.name = "world_terrain";
        this.group.userData.isTerrain = true;
        this.frustum = new THREE.Frustum();
        this.matrix = new THREE.Matrix4();
        this.box = new THREE.Box3();
        this.disposed = false;
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
    update(camera) {
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
            if (split && tile.z >= rootZoom + 2) {
                // Off-screen areas stay coarse.
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
        this.queue.prune();
        if (evictable.length > this.options.cacheSize) {
            evictable.sort((a, b) => a.lastUsed - b.lastUsed);
            for (const tile of evictable.slice(0, evictable.length - this.options.cacheSize)) this.unload(tile);
        }
        this.stats = { visible: shown.size, loaded, loading, wanted: leaves.length };
    }

    /**
     * Turns up to `maxTiles` downloaded tiles into meshes (heights, mesh, texture upload), nearest
     * first. Call every frame. With `renderer`, the texture is uploaded here (renderer.initTexture)
     * instead of in the frame the tile first shows. One per frame measured best in Firefox while
     * turning the view (42-45 fps vs 20-30 fps with a 4 ms budget): the cost is the GPU upload of
     * each 512² photo with mipmaps, which does not show in JavaScript time.
     */
    finishTiles(renderer, maxTiles = 1) {
        if (!this.finishing.length || this.disposed) return;
        let finished = 0;
        this.finishing.sort((a, b) => a.tile.distance - b.tile.distance);
        while (this.finishing.length && finished < maxTiles) {
            const { tile, controller, sample, texture } = this.finishing.shift();
            if (controller.signal.aborted || tile.controller !== controller || !this.tiles.has(tile.key)) {
                texture?.dispose(); // cancelled (or restarted) while waiting
                continue;
            }
            const heights = this.buildHeights(tile, sample);
            tile.heights = heights;
            tile.mesh = this.buildMesh(tile, heights, texture);
            tile.mesh.visible = false;
            if (texture && renderer?.initTexture) renderer.initTexture(texture);
            this.group.add(tile.mesh);
            tile.state = "ready";
            finished++;
        }
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
                heights[r * (segments + 1) + c] = elevation - this.anchorElevation;
            }
        }
        return heights;
    }

    async loadImagery(tile, signal, priority) {
        if (!this.imagery) return null;
        const { imageryBoostFromZoom, imageryMaxZoom } = this.options;
        const zoom = Math.min(this.imagery.maxZoom ?? imageryMaxZoom, imageryMaxZoom, tile.z + (tile.z >= imageryBoostFromZoom ? 1 : 0));
        const per = 2 ** Math.max(0, zoom - tile.z);
        const size = 256 * per;
        // Download first, then create and paint the canvas: creating and filling a new canvas up
        // front ran synchronously in update() for every newly wanted tile (Firefox: 20-45 ms
        // update calls while the view turned).
        const parts = [];
        for (let j = 0; j < per; j++) {
            for (let i = 0; i < per; i++) {
                const x = tile.x * per + i;
                const y = tile.y * per + j;
                const url = this.imagery.url.replace("{z}", zoom).replace("{x}", x).replace("{y}", y);
                parts.push(this.queue.load(url, { signal, priority }).then((bitmap) => ({ i, j, bitmap })).catch((error) => {
                    if (error.name === "AbortError") throw error;
                    console.warn(`[terrain] imagery ${zoom}/${x}/${y} failed`, error);
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
            images.forEach((image) => image?.bitmap.close());
            throw new DOMException("Aborted", "AbortError");
        }
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (images.some((image) => !image)) {
            // Background where a photo is missing.
            context.fillStyle = "#6b7b52";
            context.fillRect(0, 0, size, size);
        }
        for (const image of images) {
            if (!image) continue;
            context.drawImage(image.bitmap, image.i * 256, image.j * 256);
            image.bitmap.close();
        }
        this.eraseMaskedImagery(context, tile, size);
        paintRoadSurfaces(context, tile, size, this.roadSurfaces, this.frame.metersPerUnit);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.anisotropy = this.maxAnisotropy;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        return texture;
    }

    /**
     * Fills the masked areas (raised bridge decks) of a tile's photo from the surrounding pixels,
     * ring by ring inwards, so a bridge is not also painted on the ground below it.
     */
    eraseMaskedImagery(context, tile, size) {
        if (!this.imageryMasks.length) return;
        const n = 2 ** tile.z;
        const u0 = tile.x / n;
        const v0 = tile.y / n;
        const u1 = (tile.x + 1) / n;
        const v1 = (tile.y + 1) / n;
        const masks = this.imageryMasks.filter((m) => m.maxU >= u0 && m.minU <= u1 && m.maxV >= v0 && m.minV <= v1);
        if (!masks.length) return;

        const pixelsPerUnit = size * n;
        const masked = new Uint8Array(size * size);
        let minX = size;
        let minY = size;
        let maxX = -1;
        let maxY = -1;
        for (const mask of masks) {
            const half = mask.halfWidth * pixelsPerUnit;
            if (half < 0.5) continue; // narrower than a pixel at this zoom: nothing to erase
            for (let i = 0; i < mask.points.length - 1; i++) {
                const ax = (mask.points[i].u - u0) * pixelsPerUnit;
                const ay = (mask.points[i].v - v0) * pixelsPerUnit;
                const bx = (mask.points[i + 1].u - u0) * pixelsPerUnit;
                const by = (mask.points[i + 1].v - v0) * pixelsPerUnit;
                const dx = bx - ax;
                const dy = by - ay;
                const lengthSq = dx * dx + dy * dy || 1;
                const xs = Math.max(0, Math.floor(Math.min(ax, bx) - half));
                const xe = Math.min(size - 1, Math.ceil(Math.max(ax, bx) + half));
                const ys = Math.max(0, Math.floor(Math.min(ay, by) - half));
                const ye = Math.min(size - 1, Math.ceil(Math.max(ay, by) + half));
                for (let y = ys; y <= ye; y++) {
                    for (let x = xs; x <= xe; x++) {
                        const t = Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / lengthSq));
                        if (Math.hypot(x + 0.5 - (ax + t * dx), y + 0.5 - (ay + t * dy)) > half) continue;
                        masked[y * size + x] = 1;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
        }
        if (maxX < 0) return;

        const x0 = Math.max(0, minX - 2);
        const y0 = Math.max(0, minY - 2);
        const w = Math.min(size, maxX + 3) - x0;
        const h = Math.min(size, maxY + 3) - y0;
        const image = context.getImageData(x0, y0, w, h);
        const data = image.data;
        // Push-pull fill: average the known pixels into ever coarser levels, then fill the hole
        // from those smooth averages (no streaks, unlike copying neighbours inwards).
        const levels = [];
        let lw = w;
        let lh = h;
        let colour = new Float32Array(w * h * 3);
        let weight = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const p = y * w + x;
                if (masked[(y + y0) * size + (x + x0)]) continue;
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
        const result = levels[0].colour;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (!masked[(y + y0) * size + (x + x0)]) continue;
                const p = y * w + x;
                data[p * 4] = result[p * 3];
                data[p * 4 + 1] = result[p * 3 + 1];
                data[p * 4 + 2] = result[p * 3 + 2];
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
            ? new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 })
            : new THREE.MeshStandardMaterial({ color: "#7d8f5a", roughness: 1, metalness: 0 });
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

