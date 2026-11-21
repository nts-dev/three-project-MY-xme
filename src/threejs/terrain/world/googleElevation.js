import { loadGoogleMaps } from "../../../components/project-map/ProjectGoogleWebGLMap";

// Ground heights from the Google Elevation API for a scene area (scene JSON `terrain.elevation`):
//   { provider: "google", bounds: { minX, maxX, minZ, maxZ }, spacing: 10, blend: 80,
//     pads: [{ c: [x, z], a: angleDeg, s: [along, depth], h }], roads: [{ w: width, p: [[x, z], ...], h?: [y, ...] }],
//     platform: { p: [[x, z], ...], h, blend }, platforms: [{ p, h, blend }, ...] }
// Bounds are scene metres (x east, z south). Heights are sampled on a `spacing` grid, fetched when the
// scene loads and kept in memory only (Google's terms do not allow storing them). Inside the bounds they
// replace the worldwide/region elevation, blending back to it over `blend` metres at the edge.
// Pads: level ground under each building (rectangle centred at c, turned by a like the asset's Angle,
// size along x depth), at scene height h; the ground eases back to Google's over PAD_BLEND metres.

export const GOOGLE_ELEVATION_ATTRIBUTION = "Elevation © Google";

const MAX_PER_REQUEST = 512;
const CONCURRENCY = 4;
const TIMEOUT_MS = 20000;
const PAD_MARGIN = 1.5; // metres of level ground beyond each pad edge
const PAD_BLEND = 8; // metres to ease from the pad level back to the natural ground

const ROAD_STEP = 4; // metres between smoothed height samples along a road
const ROAD_SMOOTH = 6; // samples each side in the moving average (±24 m)
const ROAD_BLEND = 12; // metres to ease from the road level back to the natural ground

const smoothstep =(t) => t * t * (3 - 2 * t);
const cache = new Map(); // config key -> Promise<Float32Array> (this page session only)

// The Elevation web service does not answer browser (CORS) requests; in the browser it is used
// through the Maps JavaScript API's ElevationService (same key, billed as Elevation API requests).
async function fetchHeights(points, signal) {
    const maps = await Promise.race([
        loadGoogleMaps(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Google Maps JavaScript API did not load")), TIMEOUT_MS)),
    ]);
    const { ElevationService } = maps.importLibrary ? await maps.importLibrary("elevation") : maps;
    const service = new ElevationService();
    const heights = new Float32Array(points.length);
    const chunks = [];
    for (let i = 0; i < points.length; i += MAX_PER_REQUEST) chunks.push(i);
    let next = 0;
    const worker = async () => {
        while (next < chunks.length) {
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
            const start = chunks[next++];
            const locations = points.slice(start, start + MAX_PER_REQUEST).map(({ lat, lon }) => ({ lat, lng: lon }));
            let results = null;
            for (let attempt = 0; !results; attempt++) {
                try {
                    ({ results } = await service.getElevationForLocations({ locations }));
                } catch (error) {
                    // Short bursts can hit the per-second limit: wait and retry a few times.
                    if (attempt >= 3 || !/OVER_QUERY_LIMIT|UNKNOWN_ERROR/.test(String(error?.code || error?.message))) throw error;
                    await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
                }
            }
            results.forEach((result, k) => {
                heights[start + k] = result.elevation;
            });
        }
    };
    // A key the Maps JavaScript API rejects (e.g. ApiTargetBlockedMapError) never answers: give up
    // after TIMEOUT_MS so the scene starts with the built-in elevation instead of waiting forever.
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Google elevation timed out (is the Maps JavaScript API allowed for the key?)")), TIMEOUT_MS);
    });
    try {
        await Promise.race([Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker)), timeout]);
    } finally {
        clearTimeout(timer);
    }
    return heights;
}

function preparePads(pads = []) {
    return pads.map(({ c, a, s, h }) => {
        const t = (a * Math.PI) / 180;
        const halfAlong = s[0] / 2 + PAD_MARGIN;
        const halfDepth = s[1] / 2 + PAD_MARGIN;
        const reach = Math.hypot(halfAlong, halfDepth) + PAD_BLEND;
        // Along-row axis [cos t, -sin t], depth axis [sin t, cos t] (scene x/z).
        return { x: c[0], z: c[1], cos: Math.cos(t), sin: Math.sin(t), halfAlong, halfDepth, h, reach };
    });
}

/** Road polylines -> short segments carrying smoothed centreline heights (metres above sea level). */
function prepareRoads(roads = [], natural, anchorElevation = 0) {
    const segments = [];
    for (const road of roads) {
        // Heights at the given points: the road's own (`h`, scene y: estate streets get the level of
        // the lots beside them) or else Google's.
        const given = road.p.map(([x, z], i) => (road.h?.[i] != null ? road.h[i] + anchorElevation : natural(x, z)));
        // Resample the centreline every ROAD_STEP metres.
        const pts = [];
        let h = [];
        for (let i = 0; i < road.p.length - 1; i++) {
            const [ax, az] = road.p[i];
            const [bx, bz] = road.p[i + 1];
            const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / ROAD_STEP));
            for (let k = 0; k < n; k++) {
                pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
                h.push(given[i] + ((given[i + 1] - given[i]) * k) / n);
            }
        }
        pts.push(road.p[road.p.length - 1]);
        h.push(given[given.length - 1]);
        // Moving average of the heights along the road (±ROAD_SMOOTH samples, a few passes).
        for (let pass = 0; pass < 3; pass++) {
            h = h.map((_, i) => {
                let sum = 0;
                let count = 0;
                for (let j = Math.max(0, i - ROAD_SMOOTH); j <= Math.min(h.length - 1, i + ROAD_SMOOTH); j++) {
                    sum += h[j];
                    count++;
                }
                return sum / count;
            });
        }
        const half = road.w / 2;
        const reach = half + ROAD_BLEND;
        for (let i = 0; i < pts.length - 1; i++) {
            const [ax, az] = pts[i];
            const [bx, bz] = pts[i + 1];
            const dx = bx - ax;
            const dz = bz - az;
            segments.push({
                ax, az, dx, dz, lengthSq: dx * dx + dz * dz || 1, ha: h[i], hb: h[i + 1], half,
                minX: Math.min(ax, bx) - reach, maxX: Math.max(ax, bx) + reach,
                minZ: Math.min(az, bz) - reach, maxZ: Math.max(az, bz) + reach,
            });
        }
    }
    return segments;
}

/**
 * Loads the heights; resolves to { heightAt(x, z, baseElevation) -> metres above sea level, bounds }
 * or null when the config does not ask for Google elevation. When the API fails, the pads still
 * apply over the base elevation (`google: false`).
 */
export async function loadGoogleElevation(config, frame, anchorElevation, { signal } = {}) {
    if (config?.provider !== "google" || !config.bounds) return null;
    const { minX, maxX, minZ, maxZ } = config.bounds;
    const spacing = config.spacing ?? 10;
    const blend = config.blend ?? 80;
    const nx = Math.ceil((maxX - minX) / spacing) + 1;
    const nz = Math.ceil((maxZ - minZ) / spacing) + 1;

    const cacheKey = JSON.stringify([frame.sceneToGeo(0, 0), config.bounds, spacing]);
    if (!cache.has(cacheKey)) {
        const points = [];
        for (let r = 0; r < nz; r++) {
            for (let c = 0; c < nx; c++) points.push(frame.sceneToGeo(minX + c * spacing, minZ + r * spacing));
        }
        const request = fetchHeights(points, signal);
        cache.set(cacheKey, request);
        request.catch(() => cache.delete(cacheKey));
    }
    let grid = null;
    try {
        grid = await cache.get(cacheKey);
    } catch (error) {
        if (error.name === "AbortError") throw error;
        // Buildings stand at their pad levels, so keep the pads on the built-in ground.
        console.warn("[terrain] Google elevation unavailable; building pads on the built-in elevation", error);
    }
    // Pads bucketed on a coarse grid, so each height query only checks the few pads nearby.
    const BUCKET = 50;
    const buckets = new Map();
    for (const pad of preparePads(config.pads)) {
        for (let bx = Math.floor((pad.x - pad.reach) / BUCKET); bx <= Math.floor((pad.x + pad.reach) / BUCKET); bx++) {
            for (let bz = Math.floor((pad.z - pad.reach) / BUCKET); bz <= Math.floor((pad.z + pad.reach) / BUCKET); bz++) {
                const k = `${bx},${bz}`;
                if (!buckets.has(k)) buckets.set(k, []);
                buckets.get(k).push(pad);
            }
        }
    }
    const NO_PADS = [];

    const natural = (x, z) => {
        const fx = Math.min(nx - 1, Math.max(0, (x - minX) / spacing));
        const fz = Math.min(nz - 1, Math.max(0, (z - minZ) / spacing));
        const c = Math.min(nx - 2, Math.floor(fx));
        const r = Math.min(nz - 2, Math.floor(fz));
        const tx = fx - c;
        const tz = fz - r;
        const g = (cc, rr) => grid[rr * nx + cc];
        return (g(c, r) * (1 - tx) + g(c + 1, r) * tx) * (1 - tz) + (g(c, r + 1) * (1 - tx) + g(c + 1, r + 1) * tx) * tz;
    };

    // Main roads: Google's surface model has bumps on them (vehicles, medians, trees beside them), so
    // each road gets the Google heights smoothed along its centreline and is level across its width.
    // Level platform (config.platform: { p: polygon, h: scene y, blend }): the estate is graded flat;
    // the ground eases back to the natural heights over `blend` metres outside it.
    // More level areas can be given as config.platforms (same shape); later ones go on top.
    const platforms = [config.platform, ...(config.platforms || [])].filter((p) => p?.p?.length >= 3);
    const platformWeight = (platform, x, z) => {
        const poly = platform.p;
        let inside = false;
        let nearest = Infinity;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const [xi, zi] = poly[i];
            const [xj, zj] = poly[j];
            if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
            const dx = xj - xi;
            const dz = zj - zi;
            const t = Math.max(0, Math.min(1, ((x - xi) * dx + (z - zi) * dz) / (dx * dx + dz * dz || 1)));
            nearest = Math.min(nearest, Math.hypot(x - xi - t * dx, z - zi - t * dz));
        }
        if (inside) return 1;
        const blendDistance = platform.blend ?? 60;
        return nearest >= blendDistance ? 0 : 1 - smoothstep(nearest / blendDistance);
    };

    const roadBuckets = new Map();
    if (grid) {
        for (const segment of prepareRoads(config.roads, natural, anchorElevation)) {
            for (let bx = Math.floor(segment.minX / BUCKET); bx <= Math.floor(segment.maxX / BUCKET); bx++) {
                for (let bz = Math.floor(segment.minZ / BUCKET); bz <= Math.floor(segment.maxZ / BUCKET); bz++) {
                    const k = `${bx},${bz}`;
                    if (!roadBuckets.has(k)) roadBuckets.set(k, []);
                    roadBuckets.get(k).push(segment);
                }
            }
        }
    }

    /** Ground in metres above sea level; `base` (the other elevation sources) outside the bounds. */
    const heightAt = (x, z, base) => {
        const edge = Math.min(x - minX, maxX - x, z - minZ, maxZ - z);
        if (edge <= 0) return base;
        let ground = grid ? natural(x, z) : base;
        for (const platform of platforms) {
            const w = platformWeight(platform, x, z);
            if (w > 0) ground = ground * (1 - w) + (platform.h + anchorElevation) * w;
        }
        // Where roads meet (ramps, merges, the median between carriageways) their levels are mixed,
        // weighted towards the nearest road: picking a single road made saw-tooth ridges.
        let roadWeight = 0;
        let mixWeight = 0;
        let mixHeight = 0;
        for (const s of roadBuckets.get(`${Math.floor(x / BUCKET)},${Math.floor(z / BUCKET)}`) ?? NO_PADS) {
            if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
            const t = Math.max(0, Math.min(1, ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.lengthSq));
            const distance = Math.hypot(x - (s.ax + t * s.dx), z - (s.az + t * s.dz)) - s.half;
            if (distance >= ROAD_BLEND) continue;
            const weight = distance <= 0 ? 1 : 1 - smoothstep(distance / ROAD_BLEND);
            const w4 = weight ** 4;
            mixWeight += w4;
            mixHeight += w4 * (s.ha + (s.hb - s.ha) * t);
            if (weight > roadWeight) roadWeight = weight;
        }
        if (roadWeight > 0) ground = ground * (1 - roadWeight) + (mixHeight / mixWeight) * roadWeight;
        // Strongest pad wins (pads only touch at their edges).
        let padWeight = 0;
        let padHeight = 0;
        for (const pad of buckets.get(`${Math.floor(x / BUCKET)},${Math.floor(z / BUCKET)}`) ?? NO_PADS) {
            const dx = x - pad.x;
            const dz = z - pad.z;
            if (Math.abs(dx) > pad.reach || Math.abs(dz) > pad.reach) continue;
            const along = Math.abs(dx * pad.cos - dz * pad.sin) - pad.halfAlong;
            const depth = Math.abs(dx * pad.sin + dz * pad.cos) - pad.halfDepth;
            const outside = Math.hypot(Math.max(0, along), Math.max(0, depth));
            if (outside >= PAD_BLEND) continue;
            const weight = 1 - smoothstep(outside / PAD_BLEND);
            if (weight > padWeight) {
                padWeight = weight;
                padHeight = pad.h + anchorElevation;
            }
        }
        if (padWeight > 0) ground = ground * (1 - padWeight) + padHeight * padWeight;
        const weight = smoothstep(Math.min(1, edge / blend));
        return base * (1 - weight) + ground * weight;
    };

    return { heightAt, bounds: config.bounds, google: Boolean(grid) };
}

/**
 * Bridges built with a region sit on that region's (old) ground. With Google heights the roads they
 * join may be higher or lower, so each deck is shifted along its length (linearly between its ends)
 * until both ends meet the new ground; where the deck spans a road it keeps at least its old clearance
 * (up to MIN_CLEARANCE). The stored ground under each point (piers, shading) is updated too.
 * Returns new region objects; the ground itself is not changed.
 */
export function fitBridgesToGround(regions, localElevation, frame, anchorElevation, regionToScene) {
    const MIN_CLEARANCE = 5.5;
    return regions.map((region) => {
        if (!region.bridges?.length) return region;
        const toScene = regionToScene(region, frame, anchorElevation);
        const ref = region.referenceElevation;
        const bridges = region.bridges.map((bridge) => {
            const points = bridge.points;
            if (points.length < 2 || points[0][3] === undefined) return bridge;
            const ground = points.map(([x, z, , oldGround]) => {
                const p = toScene(x, z, 0);
                return localElevation.heightAt(p.x, p.z, oldGround + ref) - ref;
            });
            const along = [0];
            for (let i = 1; i < points.length; i++) along.push(along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
            const length = along[along.length - 1] || 1;
            const last = points.length - 1;
            const d0 = ground[0] - points[0][2];
            const d1 = ground[last] - points[last][2];
            let deck = points.map(([, , y, oldGround], i) => {
                let value = y + d0 + ((d1 - d0) * along[i]) / length;
                const clearance = y - oldGround;
                if (clearance > 2) value = Math.max(value, ground[i] + Math.min(clearance, MIN_CLEARANCE));
                return value;
            });
            // Smooth the clamped deck a little, ends fixed on the ground.
            for (let pass = 0; pass < 2; pass++) {
                deck = deck.map((value, i) => (i === 0 || i === last ? value : (deck[i - 1] + value * 2 + deck[i + 1]) / 4));
            }
            return { ...bridge, points: points.map(([x, z], i) => [x, z, deck[i], ground[i]]) };
        });
        return { ...region, bridges };
    });
}
