import { loadTerrain, resolveTerrainUrl } from "../terrainData";

// Height corrections from regions built by the backend (scripts/terrain/build-terrain.mjs):
// e.g. XME with flattened estates and roads. Inside a region its heights replace the raw
// worldwide elevation, blending back to the raw data near the region's edge.
const METERS_PER_DEGREE_LAT = 110574;
const METERS_PER_DEGREE_LON_AT_EQUATOR = 111320;

const smoothstep = (t) => t * t * (3 - 2 * t);

export async function loadRegions(paths = [], { signal } = {}) {
    const regions = await Promise.all(paths.map(async (path) => {
        try {
            const manifestUrl = resolveTerrainUrl(path);
            const terrain = await loadTerrain(manifestUrl, { signal });
            const { manifest } = terrain;
            if (manifest.rotation) {
                console.warn(`[terrain] region ${path} is rotated; rotated regions are not supported yet`);
                return null;
            }
            // Extra data built with the region: 3D bridge decks (steps/bridges.mjs) and road surfaces
            // painted over the photo (steps/roadSurfaces.mjs).
            const loadExtra = async (file, key) => {
                if (!file) return [];
                try {
                    const response = await fetch(new URL(file, new URL(manifestUrl, window.location.href)), { signal, cache: "no-cache" });
                    return response.ok ? (await response.json())[key] || [] : [];
                } catch (error) {
                    if (error.name === "AbortError") throw error;
                    console.warn(`[terrain] ${key} of region ${path} could not be loaded`, error);
                    return [];
                }
            };
            const [bridges, roads] = await Promise.all([loadExtra(manifest.bridges, "bridges"), loadExtra(manifest.roads, "roads")]);
            return {
                path,
                terrain,
                lat: manifest.center.lat,
                lon: manifest.center.lon,
                metersPerDegreeLon: METERS_PER_DEGREE_LON_AT_EQUATOR * Math.cos((manifest.center.lat * Math.PI) / 180),
                referenceElevation: manifest.referenceElevation,
                minX: manifest.origin.x,
                minZ: manifest.origin.z,
                maxX: manifest.origin.x + manifest.tilesX * manifest.tileSize,
                maxZ: manifest.origin.z + manifest.tilesZ * manifest.tileSize,
                bridges,
                roads,
            };
        } catch (error) {
            if (error.name === "AbortError") throw error;
            console.warn(`[terrain] region ${path} could not be loaded`, error);
            return null;
        }
    }));
    return regions.filter(Boolean);
}

/** Elevation (metres above sea level) with region corrections applied. */
export function correctElevation(regions, lat, lon, rawElevation, blend = 250) {
    let elevation = rawElevation;
    for (const region of regions) {
        const x = (lon - region.lon) * region.metersPerDegreeLon;
        const z = -(lat - region.lat) * METERS_PER_DEGREE_LAT;
        const edge = Math.min(x - region.minX, region.maxX - x, z - region.minZ, region.maxZ - z);
        if (edge <= 0) continue;
        const corrected = region.terrain.heightAt(x, z) + region.referenceElevation;
        const weight = smoothstep(Math.min(1, edge / blend));
        elevation = elevation * (1 - weight) + corrected * weight;
    }
    return elevation;
}
