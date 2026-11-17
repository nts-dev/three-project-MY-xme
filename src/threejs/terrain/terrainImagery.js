import * as THREE from "three";

// Satellite imagery for terrain tiles. Images are fetched live from the provider (not stored on
// our server) and composited into one texture per 500 m terrain tile. The zoom level of each
// tile follows the camera: sharp near the camera, coarser far away, so memory stays bounded.

export const IMAGERY_PROVIDERS = {
    esri: {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxZoom: 19, // zoom 20 is "Map data not yet available" around Nilai
    },
};

const DEFAULT_LEVELS = [
    { maxDistance: 1000, zoom: 18 },
    { maxDistance: 350, zoom: 19 },
];
const TILE_SIZE = 256;
const MAX_CANVAS = 2048;
const DOWNGRADE_MARGIN = 1.25; // keep a sharper level until 25% past its distance (no flicker)
const METERS_PER_DEGREE_LAT = 110574;
const METERS_PER_DEGREE_LON_AT_EQUATOR = 111320;

// Same local projection as the backend build (scripts/terrain/lib/geo.mjs): x east, z south.
function createProjection({ lat, lon }, rotationDegrees = 0) {
    const metersPerDegreeLon = METERS_PER_DEGREE_LON_AT_EQUATOR * Math.cos((lat * Math.PI) / 180);
    const rotation = (rotationDegrees * Math.PI) / 180;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return (x, z) => {
        const east = x * cos - z * sin;
        const north = -(z * cos) - x * sin;
        return { lat: lat + north / METERS_PER_DEGREE_LAT, lon: lon + east / metersPerDegreeLon };
    };
}

const worldPixel = ({ lat, lon }, zoom) => {
    const scale = TILE_SIZE * 2 ** zoom;
    const latRad = (lat * Math.PI) / 180;
    return {
        x: ((lon + 180) / 360) * scale,
        y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
    };
};

/** Fetch queue with limited concurrency; the job with the lowest priority value goes first. */
function createFetchQueue(concurrency = 12) {
    const queue = [];
    let active = 0;
    const pump = () => {
        while (active < concurrency && queue.length) {
            let best = 0;
            for (let i = 1; i < queue.length; i++) if (queue[i].priority() < queue[best].priority()) best = i;
            const job = queue.splice(best, 1)[0];
            if (job.signal.aborted) {
                job.reject(new DOMException("Aborted", "AbortError"));
                continue;
            }
            active++;
            fetch(job.url, { signal: job.signal, mode: "cors" })
                .then((response) => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.blob();
                })
                .then((blob) => createImageBitmap(blob))
                .then(job.resolve, job.reject)
                .finally(() => {
                    active--;
                    pump();
                });
        }
    };
    return (url, signal, priority) => new Promise((resolve, reject) => {
        queue.push({ url, signal, priority, resolve, reject });
        pump();
    });
}

/**
 * Keeps each terrain tile's imagery at a zoom that suits its distance to the camera.
 * options: { provider = "esri", baseZoom = 17, levels = [{ maxDistance, zoom }], maxSharpestTiles = 6,
 *            maxAnisotropy, signal }
 * onTileTexture(tile, texture) is called whenever a tile's new texture is ready (the caller
 * swaps it in and disposes the previous one). Call update(cameraPosition) every few frames.
 */
export function createTerrainImagery(terrain, options, onTileTexture) {
    const {
        provider: providerName = "esri",
        baseZoom = options?.zoom ?? 17,
        levels = DEFAULT_LEVELS,
        maxSharpestTiles = 6,
        maxAnisotropy = 8,
        signal,
    } = options || {};
    const provider = IMAGERY_PROVIDERS[providerName];
    if (!provider) throw new Error(`Unknown imagery provider "${providerName}"`);

    const { manifest } = terrain;
    const { tileSize, origin } = manifest;
    const toGeo = createProjection(manifest.center, manifest.rotation || 0);
    const enqueue = createFetchQueue();
    const sortedLevels = [...levels].sort((a, b) => b.maxDistance - a.maxDistance);
    const sharpestZoom = Math.min(provider.maxZoom, Math.max(baseZoom, ...levels.map((level) => level.zoom)));

    const states = terrain.tiles.map((tile) => ({
        tile,
        x0: origin.x + tile.column * tileSize,
        z0: origin.z + tile.row * tileSize,
        distance: Infinity,
        zoom: 0, // zoom currently shown (0 = none yet)
        pendingZoom: 0,
        pending: null, // AbortController of the running build
    }));

    const zoomForDistance = (distance, currentZoom) => {
        let zoom = baseZoom;
        for (const level of sortedLevels) {
            // A level already shown is kept a little longer, so tiles do not flip back and forth.
            const reach = level.zoom <= currentZoom ? level.maxDistance * DOWNGRADE_MARGIN : level.maxDistance;
            if (distance <= reach) zoom = Math.max(zoom, level.zoom);
        }
        return Math.min(provider.maxZoom, zoom);
    };

    async function buildTexture(state, zoom, controller) {
        const { x0, z0 } = state;
        const northWest = worldPixel(toGeo(x0, z0), zoom);
        const southEast = worldPixel(toGeo(x0 + tileSize, z0 + tileSize), zoom);
        const sourcePixels = Math.max(southEast.x - northWest.x, southEast.y - northWest.y);
        // Power-of-two canvas at or above the source resolution, for mipmaps.
        const size = Math.min(MAX_CANVAS, 2 ** Math.ceil(Math.log2(sourcePixels)));
        const scaleX = size / (southEast.x - northWest.x);
        const scaleY = size / (southEast.y - northWest.y);

        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        context.fillStyle = "#6b7b52";
        context.fillRect(0, 0, size, size);
        context.imageSmoothingQuality = "high";

        const draws = [];
        for (let ty = Math.floor(northWest.y / TILE_SIZE); ty <= Math.floor(southEast.y / TILE_SIZE); ty++) {
            for (let tx = Math.floor(northWest.x / TILE_SIZE); tx <= Math.floor(southEast.x / TILE_SIZE); tx++) {
                const url = provider.url.replace("{z}", zoom).replace("{x}", tx).replace("{y}", ty);
                draws.push(enqueue(url, controller.signal, () => state.distance).then((image) => {
                    // Slightly oversized, so there are no hairline gaps between map tiles.
                    context.drawImage(
                        image,
                        (tx * TILE_SIZE - northWest.x) * scaleX - 0.5,
                        (ty * TILE_SIZE - northWest.y) * scaleY - 0.5,
                        TILE_SIZE * scaleX + 1,
                        TILE_SIZE * scaleY + 1
                    );
                    image.close();
                }).catch((error) => {
                    if (error.name === "AbortError") throw error;
                    console.warn(`[terrain] imagery tile ${zoom}/${tx}/${ty} failed`, error);
                }));
            }
        }
        await Promise.all(draws);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.anisotropy = maxAnisotropy;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        return texture;
    }

    function request(state, zoom) {
        if (state.pendingZoom === zoom) return;
        if (state.zoom === zoom) {
            // Back to the level already shown: cancel the build of another level.
            state.pending?.abort();
            state.pending = null;
            state.pendingZoom = 0;
            return;
        }
        state.pending?.abort();
        const controller = new AbortController();
        const abortWithParent = () => controller.abort();
        signal?.addEventListener("abort", abortWithParent, { once: true });
        state.pending = controller;
        state.pendingZoom = zoom;
        buildTexture(state, zoom, controller)
            .then((texture) => {
                if (controller.signal.aborted) {
                    texture.dispose();
                    return;
                }
                state.zoom = zoom;
                onTileTexture(state.tile, texture, zoom);
            })
            .catch((error) => {
                if (error.name !== "AbortError") console.warn("[terrain] imagery failed", error);
            })
            .finally(() => {
                signal?.removeEventListener("abort", abortWithParent);
                if (state.pending === controller) {
                    state.pending = null;
                    state.pendingZoom = 0;
                }
            });
    }

    return {
        attribution: provider.attribution,
        /** Re-evaluates the wanted zoom of every tile for a camera position (scene coordinates). */
        update(camera) {
            if (signal?.aborted) return;
            const ground = terrain.contains(camera.x, camera.z) ? terrain.heightAt(camera.x, camera.z) : 0;
            const height = Math.max(0, camera.y - ground);
            for (const state of states) {
                const dx = Math.max(state.x0 - camera.x, 0, camera.x - (state.x0 + tileSize));
                const dz = Math.max(state.z0 - camera.z, 0, camera.z - (state.z0 + tileSize));
                state.distance = Math.hypot(dx, dz, height);
            }
            const byDistance = [...states].sort((a, b) => a.distance - b.distance);
            let sharpest = 0;
            for (const state of byDistance) {
                let zoom = zoomForDistance(state.distance, state.zoom);
                if (zoom === sharpestZoom && ++sharpest > maxSharpestTiles) zoom = sharpestZoom - 1;
                request(state, zoom);
            }
        },
        dispose() {
            for (const state of states) state.pending?.abort();
        },
    };
}
