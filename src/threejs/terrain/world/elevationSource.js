import { readPixels } from "./tileQueue";

// Worldwide elevation from AWS Terrain Tiles ("Terrarium" PNG encoding, free, no key).
// Heights in metres above sea level; zoom 15 is the finest level available.
const TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export const ELEVATION_MAX_ZOOM = 15;
export const ELEVATION_ATTRIBUTION = "Elevation: AWS Terrain Tiles (Mapzen), SRTM";
const SIZE = 256;

export function createElevationSource(queue, { cacheSize = 256 } = {}) {
    const cache = new Map(); // key -> Promise<Float32Array>, in least-recently-used order

    const decode = (bitmap) => {
        const pixels = readPixels(bitmap);
        bitmap.close();
        const heights = new Float32Array(SIZE * SIZE);
        for (let i = 0; i < heights.length; i++) {
            const o = i * 4;
            heights[i] = pixels[o] * 256 + pixels[o + 1] + pixels[o + 2] / 256 - 32768;
        }
        return heights;
    };

    /** Heights of one terrarium tile (256 x 256, row-major from the north-west). */
    function getTile(z, x, y, priority) {
        const key = `${z}/${x}/${y}`;
        let entry = cache.get(key);
        if (entry) {
            cache.delete(key);
            cache.set(key, entry);
            return entry;
        }
        const url = TERRARIUM_URL.replace("{z}", z).replace("{x}", x).replace("{y}", y);
        entry = queue
            .load(url, { priority, bitmapOptions: { colorSpaceConversion: "none", premultiplyAlpha: "none" } })
            .then(decode);
        entry.catch(() => cache.delete(key));
        cache.set(key, entry);
        while (cache.size > cacheSize) cache.delete(cache.keys().next().value);
        return entry;
    }

    /**
     * Returns a sampler (u, v) -> metres for the area of map tile z/x/y, using the elevation
     * tile at that zoom, or its zoom-15 ancestor for finer tiles.
     */
    async function samplerFor(z, x, y, priority) {
        const sourceZoom = Math.min(z, ELEVATION_MAX_ZOOM);
        const shift = z - sourceZoom;
        const sx = x >> shift;
        const sy = y >> shift;
        const heights = await getTile(sourceZoom, sx, sy, priority);
        const scale = SIZE * 2 ** sourceZoom;
        const at = (px, py) => heights[Math.min(SIZE - 1, Math.max(0, py)) * SIZE + Math.min(SIZE - 1, Math.max(0, px))];
        return (u, v) => {
            // Pixel centres sit at +0.5.
            const fx = u * scale - sx * SIZE - 0.5;
            const fy = v * scale - sy * SIZE - 0.5;
            const px = Math.floor(fx);
            const py = Math.floor(fy);
            const tx = fx - px;
            const ty = fy - py;
            return (at(px, py) * (1 - tx) + at(px + 1, py) * tx) * (1 - ty)
                + (at(px, py + 1) * (1 - tx) + at(px + 1, py + 1) * tx) * ty;
        };
    }

    return { samplerFor };
}
