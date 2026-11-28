import { loadGoogleMaps } from "../../../components/project-map/ProjectGoogleWebGLMap";

// Ground heights from the Google Elevation API for a scene area (scene JSON `terrain.elevation`):
//   { provider: "google", bounds: { minX, maxX, minZ, maxZ }, spacing: 10, blend: 80,
//     pads: [{ c: [x, z], a: angleDeg, s: [along, depth], h, blend? } or { p: [[x, z], ...], h, blend? }],
//     roads: [{ w: width, p: [[x, z], ...], h?: [y, ...] }],
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
            if (results.length !== locations.length || results.some((result) => !Number.isFinite(result?.elevation))) {
                throw new Error("Google elevation returned incomplete height samples");
            }
            results.forEach((result, k) => { heights[start + k] = result.elevation; });
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
    return pads.map(({ c, a, s, h, p, blend = PAD_BLEND }) => {
        if (p?.length >= 3) {
            const xs = p.map(([x]) => x);
            const zs = p.map(([, z]) => z);
            return {
                p, h, blend,
                minX: Math.min(...xs) - blend, maxX: Math.max(...xs) + blend,
                minZ: Math.min(...zs) - blend, maxZ: Math.max(...zs) + blend,
            };
        }
        const t = (a * Math.PI) / 180;
        const halfAlong = s[0] / 2 + PAD_MARGIN;
        const halfDepth = s[1] / 2 + PAD_MARGIN;
        const reach = Math.hypot(halfAlong, halfDepth) + blend;
        // Along-row axis [cos t, -sin t], depth axis [sin t, cos t] (scene x/z).
        return {
            x: c[0], z: c[1], cos: Math.cos(t), sin: Math.sin(t), halfAlong, halfDepth, h, blend,
            minX: c[0] - reach, maxX: c[0] + reach, minZ: c[1] - reach, maxZ: c[1] + reach,
        };
    });
}

function polygonDistance(poly, x, z) {
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
    return inside ? 0 : nearest;
}

const featherWeight = (distance, blend) => distance <= 0 ? 1 : distance >= blend ? 0 : 1 - smoothstep(distance / blend);

/** Road polylines -> short segments carrying smoothed centreline heights (metres above sea level). */
function prepareRoads(roads = [], natural, anchorElevation = 0) {
    const segments = [];
    for (const road of roads) {
        if (road.p.length < 2) continue;
        // Heights at the given points: the road's own (`h`, scene y: estate streets get the level of
        // the lots beside them) or else Google's.
        const given = road.p.map((_, i) => (Number.isFinite(road.h?.[i]) ? road.h[i] + anchorElevation : null));
        const fixedGrade = given.every((value) => value !== null);
        // Resample the centreline every ROAD_STEP metres.
        const pts = [];
        let h = [];
        for (let i = 0; i < road.p.length - 1; i++) {
            const [ax, az] = road.p[i];
            const [bx, bz] = road.p[i + 1];
            const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / ROAD_STEP));
            for (let k = 0; k < n; k++) {
                const x = ax + ((bx - ax) * k) / n;
                const z = az + ((bz - az) * k) / n;
                const start = given[i];
                const end = given[i + 1];
                pts.push([x, z]);
                if (start !== null && end !== null) h.push(start + ((end - start) * k) / n);
                else h.push((k === 0 ? start : null) ?? natural(x, z));
            }
        }
        pts.push(road.p[road.p.length - 1]);
        h.push(given.at(-1) ?? natural(...road.p.at(-1)));
        // Moving average of the heights along the road (±ROAD_SMOOTH samples, a few passes).
        for (let pass = 0; pass < 3; pass++) {
            h = h.map((value, i) => {
                if (value === null) return null;
                let sum = 0;
                let count = 0;
                for (let j = Math.max(0, i - ROAD_SMOOTH); j <= Math.min(h.length - 1, i + ROAD_SMOOTH); j++) {
                    if (h[j] === null) continue;
                    sum += h[j];
                    count++;
                }
                return sum / count;
            });
        }
        const half = road.w / 2;
        const blend = Number.isFinite(road.blend) && road.blend > 0 ? road.blend : ROAD_BLEND;
        const reach = half + blend;
        for (let i = 0; i < pts.length - 1; i++) {
            if (h[i] === null || h[i + 1] === null) continue;
            const [ax, az] = pts[i];
            const [bx, bz] = pts[i + 1];
            const dx = bx - ax;
            const dz = bz - az;
            segments.push({
                ax, az, dx, dz, lengthSq: dx * dx + dz * dz || 1, ha: h[i], hb: h[i + 1], half, blend, fixedGrade,
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
    return createLocalElevation(config, anchorElevation, grid);
}

/** Combines the sampled elevation grid with the scene's graded surfaces. */
export function createLocalElevation(config, anchorElevation, grid = null) {
    const { minX, maxX, minZ, maxZ } = config.bounds;
    const spacing = config.spacing ?? 10;
    const blend = config.blend ?? 80;
    const nx = Math.ceil((maxX - minX) / spacing) + 1;
    const nz = Math.ceil((maxZ - minZ) / spacing) + 1;
    const influence = { minX, maxX, minZ, maxZ };
    const include = (minX, maxX, minZ, maxZ) => {
        influence.minX = Math.min(influence.minX, minX);
        influence.maxX = Math.max(influence.maxX, maxX);
        influence.minZ = Math.min(influence.minZ, minZ);
        influence.maxZ = Math.max(influence.maxZ, maxZ);
    };
    // Pads bucketed on a coarse grid, so each height query only checks the few pads nearby.
    const BUCKET = 50;
    const buckets = new Map();
    for (const pad of preparePads(config.pads)) {
        include(pad.minX, pad.maxX, pad.minZ, pad.maxZ);
        for (let bx = Math.floor(pad.minX / BUCKET); bx <= Math.floor(pad.maxX / BUCKET); bx++) {
            for (let bz = Math.floor(pad.minZ / BUCKET); bz <= Math.floor(pad.maxZ / BUCKET); bz++) {
                const k = `${bx},${bz}`;
                if (!buckets.has(k)) buckets.set(k, []);
                buckets.get(k).push(pad);
            }
        }
    }
    const NO_PADS = [];

    const natural = (x, z) => {
        if (!grid || x < minX || x > maxX || z < minZ || z > maxZ) return null;
        const fx = (x - minX) / spacing;
        const fz = (z - minZ) / spacing;
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
    for (const platform of platforms) {
        const reach = platform.blend ?? 60;
        for (const [x, z] of platform.p) include(x - reach, x + reach, z - reach, z + reach);
    }

    const roadBuckets = new Map();
    for (const segment of prepareRoads(config.roads, natural, anchorElevation)) {
        if (segment.fixedGrade) include(segment.minX, segment.maxX, segment.minZ, segment.maxZ);
        for (let bx = Math.floor(segment.minX / BUCKET); bx <= Math.floor(segment.maxX / BUCKET); bx++) {
            for (let bz = Math.floor(segment.minZ / BUCKET); bz <= Math.floor(segment.maxZ / BUCKET); bz++) {
                const k = `${bx},${bz}`;
                if (!roadBuckets.has(k)) roadBuckets.set(k, []);
                roadBuckets.get(k).push(segment);
            }
        }
    }

    /** Ground in metres above sea level, with site grading independent of the sampled grid edge. */
    const heightAt = (x, z, base) => {
        if (x < influence.minX || x > influence.maxX || z < influence.minZ || z > influence.maxZ) return base;
        const edge = Math.min(x - minX, maxX - x, z - minZ, maxZ - z);
        const gridWeight = grid && edge > 0 ? (blend > 0 ? smoothstep(Math.min(1, edge / blend)) : 1) : 0;
        let ground = base;
        if (gridWeight > 0) ground += (natural(x, z) - ground) * gridWeight;
        for (const platform of platforms) {
            const w = featherWeight(polygonDistance(platform.p, x, z), platform.blend ?? 60);
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
            if (distance >= s.blend) continue;
            const weight = featherWeight(distance, s.blend) * (s.fixedGrade ? 1 : gridWeight);
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
            if (x < pad.minX || x > pad.maxX || z < pad.minZ || z > pad.maxZ) continue;
            let outside;
            if (pad.p) outside = polygonDistance(pad.p, x, z);
            else {
                const dx = x - pad.x;
                const dz = z - pad.z;
                const along = Math.abs(dx * pad.cos - dz * pad.sin) - pad.halfAlong;
                const depth = Math.abs(dx * pad.sin + dz * pad.cos) - pad.halfDepth;
                outside = Math.hypot(Math.max(0, along), Math.max(0, depth));
            }
            const weight = featherWeight(outside, pad.blend);
            if (weight > padWeight) {
                padWeight = weight;
                padHeight = pad.h + anchorElevation;
            }
        }
        if (padWeight > 0) ground = ground * (1 - padWeight) + padHeight * padWeight;
        return ground;
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
            if (ground.every((height, i) => Math.abs(height - points[i][3]) < 0.001)) return bridge;
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
            const MAX_GRADE = 0.08;
            // Away from the roads it crosses, the deck climbs from its ends at most MAX_GRADE: the
            // old clearance kept everywhere left decks high near an end that the new ground brought
            // down (a 5 m drop over the last 20 m). Over a road crossing beneath, the clearance stays.
            const crossings = (bridge.ground || []).filter((road) => road.points?.length >= 2);
            const crossesAt = (x, z, hx, hz) => {
                const hl = Math.hypot(hx, hz) || 1;
                return crossings.some((road) => road.points.some((p, k) => {
                    if (!k) return false;
                    const [x1, z1] = road.points[k - 1];
                    const dx = p[0] - x1;
                    const dz = p[1] - z1;
                    const l = Math.hypot(dx, dz) || 1;
                    if (Math.abs((dx * hz - dz * hx) / (l * hl)) < 0.3) return false; // runs along the deck
                    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (l * l)));
                    return Math.hypot(x - x1 - t * dx, z - z1 - t * dz) <= road.half + 2;
                }));
            };
            const overRoad = points.map(([x, z], i) => {
                const prev = points[Math.max(0, i - 1)];
                const next = points[Math.min(last, i + 1)];
                return crossesAt(x, z, next[0] - prev[0], next[1] - prev[1]);
            });
            // (Only with the roads known: without them every point would count as off the roads.)
            for (let i = 1; Array.isArray(bridge.ground) && i < last; i++) {
                if (overRoad[i]) continue;
                const fromEnds = Math.min(deck[0] + MAX_GRADE * along[i], deck[last] + MAX_GRADE * (length - along[i]));
                deck[i] = Math.max(Math.min(deck[i], fromEnds), ground[i] + 0.1);
            }
            // The clearance lift above raises only the high points: from the ends the deck would step
            // up onto them (a ~1 m step near each end). Ramp up to them at most MAX_GRADE instead
            // (both directions; the end points stay on the ground).
            for (let i = last - 1; i >= 1; i--) deck[i] = Math.max(deck[i], deck[i + 1] - MAX_GRADE * (along[i + 1] - along[i]));
            for (let i = 1; i <= last - 1; i++) deck[i] = Math.max(deck[i], deck[i - 1] - MAX_GRADE * (along[i] - along[i - 1]));
            // Smooth the clamped deck a little, ends fixed on the ground.
            for (let pass = 0; pass < 2; pass++) {
                deck = deck.map((value, i) => (i === 0 || i === last ? value : (deck[i - 1] + value * 2 + deck[i + 1]) / 4));
            }
            // Where the deck runs close to the ground (the ends, coming down onto the road), the
            // ground between the ~8 m deck points can rise above the straight deck between them and
            // poke through it: there, extra points every NEAR_GROUND_STEP metres keep the deck
            // NEAR_GROUND_LIFT above the actual ground.
            const NEAR_GROUND = 1.5;
            const NEAR_GROUND_STEP = 2;
            const NEAR_GROUND_LIFT = 0.25;
            // Ground under the centre and both deck edges (a bank across the road is higher on one side).
            const half = (bridge.width ?? 8) / 2;
            const groundUnder = (px, pz, dirX, dirZ, base) => {
                const l = Math.hypot(dirX, dirZ) || 1;
                const ox = (-dirZ / l) * half;
                const oz = (dirX / l) * half;
                let high = -Infinity;
                for (const s of [0, 1, -1]) {
                    const p = toScene(px + ox * s, pz + oz * s, 0);
                    high = Math.max(high, localElevation.heightAt(p.x, p.z, base + ref) - ref);
                }
                return high;
            };
            const out = [];
            for (let i = 0; i < points.length; i++) {
                const [x, z] = points[i];
                const prev = points[Math.max(0, i - 1)];
                const next = points[Math.min(last, i + 1)];
                let d = deck[i];
                if (i > 0 && i < last && d - ground[i] <= NEAR_GROUND) d = Math.max(d, groundUnder(x, z, next[0] - prev[0], next[1] - prev[1], points[i][3]) + NEAR_GROUND_LIFT);
                out.push([x, z, d, ground[i]]);
                if (i === last) break;
                const [nx, nz] = points[i + 1];
                if (Math.min(deck[i] - ground[i], deck[i + 1] - ground[i + 1]) > NEAR_GROUND) continue;
                const steps = Math.floor(Math.hypot(nx - x, nz - z) / NEAR_GROUND_STEP);
                for (let k = 1; k < steps; k++) {
                    const t = k / steps;
                    const px = x + (nx - x) * t;
                    const pz = z + (nz - z) * t;
                    const p = toScene(px, pz, 0);
                    const g = localElevation.heightAt(p.x, p.z, points[i][3] + ref) - ref;
                    const high = groundUnder(px, pz, nx - x, nz - z, points[i][3]);
                    const dt = deck[i] + (deck[i + 1] - deck[i]) * t;
                    out.push([px, pz, Math.max(dt, high + NEAR_GROUND_LIFT), g]);
                }
            }
            // The same end grade over the final points (with the extra near-ground ones): nothing
            // added after the limit above may make a step up just inside an end.
            if (Array.isArray(bridge.ground) && out.length > 2) {
                const s = [0];
                for (let j = 1; j < out.length; j++) s.push(s[j - 1] + Math.hypot(out[j][0] - out[j - 1][0], out[j][1] - out[j - 1][1]));
                const total = s[s.length - 1];
                const start = out[0][2];
                const end = out[out.length - 1][2];
                for (let j = 1; j < out.length - 1; j++) {
                    const a = out[j - 1];
                    const b = out[j + 1];
                    if (crossesAt(out[j][0], out[j][1], b[0] - a[0], b[1] - a[1])) continue;
                    const cap = Math.min(start + MAX_GRADE * s[j], end + MAX_GRADE * (total - s[j]));
                    out[j][2] = Math.max(Math.min(out[j][2], cap), out[j][3] + 0.1);
                }
            }
            return { ...bridge, points: out };
        });
        return { ...region, bridges };
    });
}
