// Terrain height data: loads the tiles written by the backend's scripts/terrain/build-terrain.mjs
// and answers height queries. Other code (placement, player, snapping) should read the ground
// through getTerrainHeightAt rather than raycasting the meshes.
import seriKembangan from "./seriKembangan.json";

/** Resolves a scene's `terrain.manifest` (relative to the backend's /files) to a URL. */
export function resolveTerrainUrl(manifestPath) {
    if (/^https?:\/\//i.test(manifestPath)) return manifestPath;
    const apiBase = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
    return `${apiBase}/files/${String(manifestPath).replace(/^\/+/, "")}`;
}

export async function loadProjectTerrainConfig(projectId, legacyTerrain, { signal } = {}) {
    const level = String(projectId).trim().toUpperCase();
    if (level === "33_L0") return legacyTerrain ?? seriKembangan;
    if (level !== "153_L2") return legacyTerrain;
    try {
        const response = await fetch(resolveTerrainUrl("terrain/153_L2/terrain.json"), { signal, cache: "no-cache" });
        if (response.status === 404) return legacyTerrain;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        if (error.name === "AbortError") throw error;
        console.warn("[terrain] Could not load 153_L2 terrain configuration", error);
        return legacyTerrain;
    }
}

export async function loadTerrain(manifestUrl, { signal, onProgress } = {}) {
    const manifestResponse = await fetch(manifestUrl, { signal, cache: "no-cache" });
    if (!manifestResponse.ok) throw new Error(`Terrain manifest ${manifestUrl}: HTTP ${manifestResponse.status}`);
    const manifest = await manifestResponse.json();
    const baseUrl = new URL(".", new URL(manifestUrl, window.location.href));

    let loaded = 0;
    const tiles = await Promise.all(manifest.tiles.map(async (tile) => {
        const response = await fetch(new URL(tile.file, baseUrl), { signal, cache: "no-cache" });
        if (!response.ok) throw new Error(`Terrain tile ${tile.file}: HTTP ${response.status}`);
        const quantised = new Uint16Array(await response.arrayBuffer());
        const range = tile.max - tile.min;
        const heights = new Float32Array(quantised.length);
        for (let i = 0; i < quantised.length; i++) heights[i] = tile.min + (quantised[i] / 65535) * range;
        onProgress?.(++loaded / manifest.tiles.length);
        return { ...tile, heights };
    }));

    return createTerrain(manifest, tiles);
}

export function createTerrain(manifest, tiles) {
    const { samples, tileSize, tilesX, tilesZ, origin } = manifest;
    const cells = samples - 1;
    const step = tileSize / cells;
    const width = tilesX * cells + 1;
    const height = tilesZ * cells + 1;
    const tileByKey = new Map(tiles.map((tile) => [`${tile.column}_${tile.row}`, tile]));

    /** Height at a global grid sample (clamped to the grid). */
    const sample = (column, row) => {
        const c = Math.min(width - 1, Math.max(0, column));
        const r = Math.min(height - 1, Math.max(0, row));
        const tileColumn = Math.min(tilesX - 1, Math.floor(c / cells));
        const tileRow = Math.min(tilesZ - 1, Math.floor(r / cells));
        const tile = tileByKey.get(`${tileColumn}_${tileRow}`);
        if (!tile) return 0;
        return tile.heights[(r - tileRow * cells) * samples + (c - tileColumn * cells)];
    };

    /** Ground height (scene y) at scene x/z, bilinear between samples. */
    const heightAt = (x, z) => {
        const fx = (x - origin.x) / step;
        const fz = (z - origin.z) / step;
        const c = Math.floor(fx);
        const r = Math.floor(fz);
        const tx = fx - c;
        const tz = fz - r;
        const top = sample(c, r) * (1 - tx) + sample(c + 1, r) * tx;
        const bottom = sample(c, r + 1) * (1 - tx) + sample(c + 1, r + 1) * tx;
        return top * (1 - tz) + bottom * tz;
    };

    const contains = (x, z) =>
        x >= origin.x && z >= origin.z && x <= origin.x + tilesX * tileSize && z <= origin.z + tilesZ * tileSize;

    return { manifest, tiles, step, width, height, sample, heightAt, contains };
}

let activeTerrain = null;

/** Store selector: does the loaded scene JSON of `projectId` define terrain? useGame((s) => sceneHasTerrain(s, id)) */
export function sceneHasTerrain(state, projectId) {
    const key = (value) => String(value ?? "").trim().toUpperCase();
    return Boolean(state?.projectSceneData?.terrain) && key(state.projectSceneKey) === key(projectId);
}

export function setActiveTerrain(terrain) {
    activeTerrain = terrain;
}

export function clearActiveTerrain(terrain) {
    if (!terrain || activeTerrain === terrain) activeTerrain = null;
}

export function getActiveTerrain() {
    return activeTerrain;
}

/** Ground height at scene x/z, or null when no terrain is loaded or the point is off the map. */
export function getTerrainHeightAt(x, z) {
    if (!activeTerrain || !activeTerrain.contains(x, z)) return null;
    return activeTerrain.heightAt(x, z);
}
