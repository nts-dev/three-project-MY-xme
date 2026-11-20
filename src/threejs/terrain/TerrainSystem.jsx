import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import { clearActiveTerrain, loadTerrain, resolveTerrainUrl, setActiveTerrain } from "./terrainData";
import { applyTerrainTileTexture, buildTerrainGroup, disposeTerrainGroup } from "./terrainMesh";
import { createTerrainImagery } from "./terrainImagery";
import { WorldTerrain } from "./world/worldTerrain";
import { loadRegions } from "./world/regionOverlay";
import { bridgeImageryMasks, buildBridges } from "./world/bridgeMeshes";
import { roadSurfaceLines } from "./world/roadSurfaces";
import { buildGroundRoads } from "./world/groundRoads";
import { resolveImageryProvider } from "./world/imageryProviders";
import { ELEVATION_ATTRIBUTION } from "./world/elevationSource";

const cameraPosition = new THREE.Vector3();

const sameSceneKey = (left, right) =>
    String(left ?? "").trim().toUpperCase() === String(right ?? "").trim().toUpperCase();

/** Small credit line over the canvas; imagery providers require it to stay visible. */
function showAttribution(canvas, text) {
    const host = canvas?.parentElement;
    if (!host || !text) return () => {};
    const element = document.createElement("div");
    element.className = "terrain-attribution";
    element.textContent = text;
    Object.assign(element.style, {
        position: "absolute",
        right: "6px",
        bottom: "4px",
        zIndex: 5,
        padding: "1px 6px",
        font: "11px/1.4 sans-serif",
        color: "#222",
        background: "rgba(255,255,255,0.7)",
        borderRadius: "3px",
        pointerEvents: "none",
    });
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.appendChild(element);
    return () => element.remove();
}

/**
 * Renders the terrain of the current scene from its scene JSON `terrain`:
 *  - { mode: "world", anchor: { lat, lon }, regions: [manifest, ...], imagery: { provider, maxZoom }, ... }
 *    endless terrain streamed around the camera (WorldTerrain), with built regions as corrections;
 *  - { manifest, imagery } a fixed area built by the backend's scripts/terrain/build-terrain.mjs.
 * Scenes without `terrain` render nothing.
 */
export default function TerrainSystem({ sceneKey }) {
    const projectSceneData = useGame((state) => state.projectSceneData);
    const projectSceneKey = useGame((state) => state.projectSceneKey);
    const terrainConfig = sameSceneKey(projectSceneKey, sceneKey) ? projectSceneData?.terrain : null;
    const configKey = terrainConfig ? JSON.stringify(terrainConfig) : "";
    if (!configKey) return null;
    return terrainConfig.mode === "world"
        ? <WorldTerrainLayer configKey={configKey} />
        : <RegionTerrainLayer configKey={configKey} />;
}

// Drawn roads, tarmac aprons and lawn strips (3D and painted into the photo) are off for now, to inspect
// the raw Google map imagery; ?roads=on in the URL shows them.
const showRoads = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("roads") === "on";

/** Endless terrain: tiles load and unload as the camera moves. */
function WorldTerrainLayer({ configKey }) {
    const gl = useThree((state) => state.gl);
    const getThree = useThree((state) => state.get);
    const [terrain, setTerrain] = useState(null);
    const lastUpdateRef = useRef(0);

    useEffect(() => {
        const config = JSON.parse(configKey);
        const controller = new AbortController();
        let world = null;
        let bridges = null;
        let groundRoads = null;
        let removeAttribution = () => {};

        Promise.all([
            loadRegions(config.regions || [], { signal: controller.signal }),
            resolveImageryProvider(config.imagery, { signal: controller.signal }),
        ])
            .then(([regions, provider]) => {
                if (controller.signal.aborted) return;
                world = new WorldTerrain({
                    anchor: config.anchor,
                    // Default: the first region's reference height, so its ground stays at y = 0.
                    anchorElevation: config.anchorElevation ?? regions[0]?.referenceElevation ?? 0,
                    regions,
                    imagery: provider ? { url: provider.url, maxZoom: provider.maxZoom } : null,
                    // Raised bridge decks are erased from the ground photo (the deck is built in 3D).
                    imageryMasks: bridgeImageryMasks(regions),
                    roadSurfaces: showRoads ? roadSurfaceLines(regions) : [],
                    maxAnisotropy: gl.capabilities.getMaxAnisotropy(),
                    ...(config.options || {}),
                });
                // `world` / `getBridges` give the physics ground (TerrainGroundCollider) the loaded
                // tiles and the raised bridge decks to build colliders from.
                setActiveTerrain({
                    heightAt: (x, z) => world.heightAt(x, z),
                    contains: (x, z) => world.heightAt(x, z) !== null,
                    world,
                    getBridges: () => bridges?.group ?? null,
                });
                if (regions.some((region) => region.bridges?.length)) {
                    bridges = buildBridges({
                        regions,
                        frame: world.frame,
                        anchorElevation: world.anchorElevation,
                        maxAnisotropy: gl.capabilities.getMaxAnisotropy(),
                    });
                    world.group.add(bridges.group);
                    // Compile the bridge materials now, in the background (parallel shader compile
                    // where the browser supports it): compiled on first sight, they froze the frame
                    // a bridge first came into view for ~70 ms (Firefox).
                    const { scene, camera } = getThree();
                    gl.compileAsync?.(bridges.group, camera, scene).catch(() => {});
                }
                if (showRoads && regions.some((region) => region.roads?.length)) {
                    // Roads as sharp 3D surfaces on the ground (the photo-painted roads stay for far views).
                    groundRoads = buildGroundRoads({
                        regions,
                        frame: world.frame,
                        anchorElevation: world.anchorElevation,
                        maxAnisotropy: gl.capabilities.getMaxAnisotropy(),
                    });
                    world.group.add(groundRoads.group);
                }
                removeAttribution = showAttribution(gl.domElement, [
                    provider?.attribution,
                    ELEVATION_ATTRIBUTION,
                    regions.length ? "© OpenStreetMap contributors" : null,
                ].filter(Boolean).join(" · "));
                window.__worldTerrain = world; // for debugging in the console: __worldTerrain.stats
                setTerrain(world);
            })
            .catch((error) => {
                if (error.name !== "AbortError") console.error("[terrain] world terrain failed to start", error);
            });

        return () => {
            controller.abort();
            removeAttribution();
            bridges?.dispose();
            groundRoads?.dispose();
            if (world) {
                world.dispose();
                clearActiveTerrain();
                if (window.__worldTerrain === world) delete window.__worldTerrain;
            }
            setTerrain(null);
        };
    }, [configKey, gl, getThree]);

    useFrame(({ camera, clock }) => {
        if (!terrain) return;
        // Downloaded tiles become meshes one per frame, their photo uploaded to the GPU there too.
        terrain.finishTiles(gl, 1);
        const time = clock.getElapsedTime();
        if (time - lastUpdateRef.current < 0.15) return;
        lastUpdateRef.current = time;
        terrain.update(camera);
    });

    return terrain ? <primitive object={terrain.group} /> : null;
}

/** A fixed terrain area from one manifest, with optional camera-dependent imagery. */
function RegionTerrainLayer({ configKey }) {
    const gl = useThree((state) => state.gl);
    const [group, setGroup] = useState(null);
    const imageryRef = useRef(null);
    const lastCameraRef = useRef({ position: new THREE.Vector3(Infinity, 0, 0), time: 0 });

    // Imagery zoom follows the camera; re-check when it moved noticeably, at most 4 times a second.
    useFrame(({ camera, clock }) => {
        const imagery = imageryRef.current;
        if (!imagery) return;
        const last = lastCameraRef.current;
        const time = clock.getElapsedTime();
        if (time - last.time < 0.25) return;
        camera.getWorldPosition(cameraPosition);
        if (cameraPosition.distanceToSquared(last.position) < 25) return;
        last.position.copy(cameraPosition);
        last.time = time;
        imagery.update(cameraPosition);
    });

    useEffect(() => {
        const config = JSON.parse(configKey);
        const controller = new AbortController();
        let terrain = null;
        let built = null;
        let removeAttribution = () => {};

        loadTerrain(resolveTerrainUrl(config.manifest), { signal: controller.signal })
            .then((loaded) => {
                if (controller.signal.aborted) return;
                terrain = loaded;
                built = buildTerrainGroup(loaded);
                setActiveTerrain(loaded);
                setGroup(built);

                if (!config.imagery) return;
                const imagery = createTerrainImagery(
                    loaded,
                    { ...config.imagery, signal: controller.signal, maxAnisotropy: gl.capabilities.getMaxAnisotropy() },
                    (tile, texture) => {
                        if (controller.signal.aborted) texture.dispose();
                        else applyTerrainTileTexture(built, tile, texture);
                    }
                );
                removeAttribution = showAttribution(gl.domElement, imagery.attribution);
                imageryRef.current = imagery;
            })
            .catch((error) => {
                if (error.name !== "AbortError") console.error("[terrain] failed to load", config.manifest, error);
            });

        return () => {
            controller.abort();
            imageryRef.current?.dispose();
            imageryRef.current = null;
            removeAttribution();
            if (built) disposeTerrainGroup(built);
            clearActiveTerrain(terrain);
            setGroup(null);
        };
    }, [configKey, gl]);

    return group ? <primitive object={group} /> : null;
}
