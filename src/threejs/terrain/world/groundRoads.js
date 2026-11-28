import * as THREE from "three";
import { edges, regionToScene, StripBuilder } from "./bridgeMeshes";
import { findJunctions, junctionFans } from "./roadJunctions";
import { groundMaterial } from "./groundMaterial";
import { applyWetSurface } from "./wetSurface";

// Ground roads as 3D surfaces: the regions' road surfaces (roads.json, scripts/terrain/steps/
// roadSurfaces.mjs) built as thin meshes lying on the region ground, with small repeating asphalt
// and marking textures. They stay sharp at any zoom, unlike the roads painted into the terrain
// photo (roadSurfaces.js), which remain underneath for far views where the coarse terrain tiles
// cover these meshes.

const STEP = 2; // metres between cross-sections along a road
const LIFT = 0.06; // asphalt above the region ground (plus polygon offset against z-fighting)
const MARK_LIFT = 0.03; // markings above the asphalt
const MARK_WIDTH = 0.15; // painted line width in metres
const MARK_STRIP = MARK_WIDTH * 3; // the strip is wider than the line so mipmaps soften it far away
const DASH_CYCLE = 9; // metres: 3 m dash, 6 m gap (as in roadSurfaces.js)
export const ASPHALT_REPEAT = 6; // metres per asphalt texture repeat
const END_TRIM = 2; // markings stop this far from road ends
const GRASS_LIFT = 0.05; // lawn strips (surface "grass") just under the asphalt level

const canvasTexture = (canvas, maxAnisotropy, wrapS) => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = wrapS;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = maxAnisotropy;
    return texture;
};

/** Plain asphalt with a fine grain (no markings; those are separate strips). */
export function asphaltTexture(maxAnisotropy) {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    context.fillStyle = "#5d5e5b";
    context.fillRect(0, 0, size, size);
    const image = context.getImageData(0, 0, size, size);
    for (let i = 0; i < image.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 14;
        image.data[i] += noise;
        image.data[i + 1] += noise;
        image.data[i + 2] += noise;
    }
    context.putImageData(image, 0, 0);
    return canvasTexture(canvas, maxAnisotropy, THREE.RepeatWrapping);
}

/** Lawn: green with a fine mottle. */
function grassTexture(maxAnisotropy) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    context.fillStyle = "#5f8f3a";
    context.fillRect(0, 0, size, size);
    const image = context.getImageData(0, 0, size, size);
    for (let i = 0; i < image.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 30;
        image.data[i] += noise * 0.6;
        image.data[i + 1] += noise;
        image.data[i + 2] += noise * 0.4;
    }
    context.putImageData(image, 0, 0);
    return canvasTexture(canvas, maxAnisotropy, THREE.RepeatWrapping);
}

/** Adds a triangle fan (centre + ring, region metres) to a builder, uv = metres / repeat. */
function addFan(builder, centre, ring, point, lift, repeat) {
    const base = builder.positions.length / 3;
    for (const p of [centre, ...ring]) {
        const v = point(p, lift);
        builder.positions.push(v.x, v.y, v.z);
        builder.uvs.push(p[0] / repeat, p[1] / repeat);
    }
    for (let i = 1; i < ring.length; i++) builder.indices.push(base, base + i, base + i + 1);
}

/** A white line in the middle third of the strip; dashed: only the first third of each cycle. */
function markingTexture(dashed, maxAnisotropy) {
    const width = 48;
    const height = dashed ? 144 : 48;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgba(238, 236, 228, 0.95)";
    context.fillRect(width / 3, 0, width / 3, dashed ? height / 3 : height);
    return canvasTexture(canvas, maxAnisotropy, THREE.ClampToEdgeWrapping);
}

/** A polyline resampled every `step` metres (keeps the corners). Points: [x, z]. */
function densify(points, step) {
    const out = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1];
        const [bx, bz] = points[i];
        const count = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
        for (let k = 1; k <= count; k++) out.push([ax + ((bx - ax) * k) / count, az + ((bz - az) * k) / count]);
    }
    return out;
}

/**
 * Like densify, also carrying per-point [left, right] half widths (interpolated along). For aprons
 * with "sides": a taper, or a kerb curving out into a junction.
 */
function densifySides(points, sides, step) {
    const centre = [points[0]];
    const out = [sides[0]];
    for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1];
        const [bx, bz] = points[i];
        const count = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
        for (let k = 1; k <= count; k++) {
            const t = k / count;
            centre.push([ax + (bx - ax) * t, az + (bz - az) * t]);
            out.push([sides[i - 1][0] + (sides[i][0] - sides[i - 1][0]) * t, sides[i - 1][1] + (sides[i][1] - sides[i - 1][1]) * t]);
        }
    }
    return { centre, sides: out };
}

/** A polyline shifted sideways by offsets(i) metres per point (positive = left of travel). */
function offsetLineBy(points, offsets) {
    return points.map((p, i) => {
        const a = points[Math.max(0, i - 1)];
        const b = points[Math.min(points.length - 1, i + 1)];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const length = Math.hypot(dx, dz) || 1;
        return [p[0] + (dz / length) * offsets[i], p[1] - (dx / length) * offsets[i]];
    });
}

/** A polyline shifted sideways by `offset` metres (positive = left of the direction of travel). */
function offsetLine(points, offset) {
    return points.map((p, i) => {
        const a = points[Math.max(0, i - 1)];
        const b = points[Math.min(points.length - 1, i + 1)];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const length = Math.hypot(dx, dz) || 1;
        return [p[0] + (dz / length) * offset, p[1] - (dx / length) * offset];
    });
}

function distanceToSegment([px, pz], [ax, az], [bx, bz]) {
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/** True when the point lies on another road's asphalt (junctions: no markings across them). */
const onOtherRoad = (p, others) => others.some((road) => road.points.some((b, i) => i > 0 && distanceToSegment(p, road.points[i - 1], b) < road.width / 2 - 0.3));

/** Splits a polyline into runs of points that are not on another road; drops short runs. */
function clearRuns(points, others) {
    const runs = [];
    let run = [];
    for (const p of points) {
        if (onOtherRoad(p, others)) {
            if (run.length > 1) runs.push(run);
            run = [];
        } else run.push(p);
    }
    if (run.length > 1) runs.push(run);
    return runs;
}

/** Builds the ground roads of all regions. Returns { group, dispose }. */
export function buildGroundRoads({ regions, frame, anchorElevation, maxAnisotropy = 8, groundAt = null, sceneCoords = false, streetsOnly = false }) {
    const group = new THREE.Group();
    group.name = "world_ground_roads";
    group.userData.isTerrain = true;
    const asphaltMap = asphaltTexture(maxAnisotropy);
    const solidMap = markingTexture(false, maxAnisotropy);
    const dashMap = markingTexture(true, maxAnisotropy);
    // Same lighting as the terrain and the 153_L1 ground models (groundMaterial.js).
    const surface = { side: THREE.DoubleSide, polygonOffset: true };
    // Rain: wet asphalt with puddles, wet markings and lawns (wetSurface.js, driven by RainEffect).
    const asphalt = applyWetSurface(groundMaterial({ ...surface, map: asphaltMap, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), { puddles: true });
    const markingMaterial = (map) => applyWetSurface(groundMaterial({ ...surface, map, transparent: true, depthWrite: false, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }), { puddles: false, strength: 0.8 });
    const solid = markingMaterial(solidMap);
    const dashed = markingMaterial(dashMap);
    const grassMap = grassTexture(maxAnisotropy);
    const grass = applyWetSurface(groundMaterial({ ...surface, map: grassMap, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), { puddles: false, strength: 0.35 });
    const grassStrips = new StripBuilder();
    const asphaltStrips = new StripBuilder();
    const solidStrips = new StripBuilder();
    const dashStrips = new StripBuilder();

    for (const region of regions) {
        const all = (region.roads || []).filter((road) => road.points?.length >= 2 && road.width > 0);
        const roads = all.filter((road) => !road.surface);
        const lawns = all.filter((road) => road.surface === "grass");
        // Tarmac aprons (surface "paved"): plain asphalt from the kerb to the fences, under the roads.
        // In the normal view (streetsOnly) only those marked "always" (part of the street, e.g. a
        // road widening into a junction); all of them with ?roads=on.
        const aprons = all.filter((road) => road.surface === "paved" && (!streetsOnly || road.always));
        const toScene = regionToScene(region, frame, anchorElevation);
        const ground = (x, z) => region.terrain.heightAt(x, z);
        // groundAt (scene x/z -> scene y): the rendered ground when it differs from the region's own
        // heights (e.g. Google elevation); otherwise the region's heights.
        // sceneCoords: the road points are already scene metres (roads fitted to the placed buildings);
        // otherwise region metres, converted through lat/lon (which stretches north-south by ~0.7%,
        // about 1 m per 150 m from the anchor).
        const point = groundAt
            ? ([x, z], lift) => {
                const p = sceneCoords ? new THREE.Vector3(x, 0, z) : toScene(x, z, 0);
                p.y = groundAt(p.x, p.z) + lift;
                return p;
            }
            : ([x, z], lift) => toScene(x, z, ground(x, z) + lift);

        // Lawn strips: plain grass ribbons.
        for (const lawn of lawns) {
            const centre = densify(lawn.points, STEP);
            const half = lawn.width / 2;
            const rows = [offsetLine(centre, half), offsetLine(centre, -half)];
            grassStrips.strip(rows[0].map((p) => point(p, GRASS_LIFT)), rows[1].map((p) => point(p, GRASS_LIFT)), rows[0].map((p) => [p[0] / 4, p[1] / 4]), rows[1].map((p) => [p[0] / 4, p[1] / 4]));
        }

        for (const apron of aprons) {
            let rows;
            if (Array.isArray(apron.sides) && apron.sides.length === apron.points.length) {
                // Per-point side widths: tapers and kerbs curving out (finer steps for the curves).
                const { centre, sides } = densifySides(apron.points, apron.sides, Math.min(STEP, 1));
                rows = [offsetLineBy(centre, sides.map((s) => s[0])), offsetLineBy(centre, sides.map((s) => -s[1]))];
            } else {
                const centre = densify(apron.points, STEP);
                const half = apron.width / 2;
                rows = [offsetLine(centre, half), offsetLine(centre, -half)];
            }
            const uv = (row) => row.map((p) => [p[0] / ASPHALT_REPEAT, p[1] / ASPHALT_REPEAT]);
            asphaltStrips.strip(rows[0].map((p) => point(p, LIFT - 0.012)), rows[1].map((p) => point(p, LIFT - 0.012)), uv(rows[0]), uv(rows[1]));
        }

        // Junctions: rounded kerb corners and a filled middle, under the road ribbons.
        for (const junction of findJunctions(roads)) {
            for (const { centre, ring } of junctionFans(junction)) addFan(asphaltStrips, centre, ring, point, LIFT - 0.004, ASPHALT_REPEAT);
        }

        roads.forEach((road, index) => {
            const centre = densify(road.points, STEP);
            // A hair of height per road so overlapping roads at junctions do not z-fight.
            const lift = LIFT + index * 0.004;
            const half = road.width / 2;
            const rows = [offsetLine(centre, half), centre, offsetLine(centre, -half)].map((line) => line.map((p) => point(p, lift)));
            let along = 0;
            const v = centre.map((p, i) => {
                if (i) along += Math.hypot(p[0] - centre[i - 1][0], p[1] - centre[i - 1][1]);
                return along / ASPHALT_REPEAT;
            });
            const u = (offset) => v.map((vv) => [offset / ASPHALT_REPEAT, vv]);
            asphaltStrips.strip(rows[0], rows[1], u(0), u(half));
            asphaltStrips.strip(rows[1], rows[2], u(half), u(road.width));

            // Markings: edge lines and dashed lane lines, kept off the junctions with other roads.
            const others = roads.filter((other) => other !== road);
            const markLift = lift + MARK_LIFT;
            const fine = densify(road.points, 1);
            const total = fine.length - 1;
            const trimmed = fine.slice(END_TRIM, Math.max(END_TRIM, total - END_TRIM + 1));
            const edge = half - 0.5;
            const lanes = Math.max(1, road.lanes ?? 2);
            const lines = [
                { offset: edge, builder: solidStrips },
                { offset: -edge, builder: solidStrips },
                ...Array.from({ length: lanes - 1 }, (_, i) => ({ offset: -edge + (2 * edge * (i + 1)) / lanes, builder: dashStrips })),
            ];
            for (const { offset, builder } of lines) {
                for (const run of clearRuns(offsetLine(trimmed, offset), others)) {
                    const points = run.map((p) => point(p, markLift));
                    const { left, right } = edges(points, MARK_STRIP / 2);
                    let length = 0;
                    const vv = run.map((p, i) => {
                        if (i) length += Math.hypot(p[0] - run[i - 1][0], p[1] - run[i - 1][1]);
                        return length / DASH_CYCLE;
                    });
                    builder.strip(left, right, vv.map((x) => [0, x]), vv.map((x) => [1, x]));
                }
            }
        });
    }

    const meshes = [
        [grassStrips, grass, 1],
        [asphaltStrips, asphalt, 1],
        [solidStrips, solid, 2],
        [dashStrips, dashed, 2],
    ].filter(([builder]) => builder.positions.length).map(([builder, material, order]) => {
        const mesh = new THREE.Mesh(builder.build(), material);
        mesh.renderOrder = order;
        mesh.receiveShadow = true;
        mesh.userData.isTerrain = true;
        group.add(mesh);
        return mesh;
    });

    return {
        group,
        count: meshes.length,
        dispose() {
            group.removeFromParent();
            meshes.forEach((mesh) => mesh.geometry.dispose());
            [asphalt, solid, dashed, grass].forEach((material) => material.dispose());
            [asphaltMap, solidMap, dashMap, grassMap].forEach((texture) => texture.dispose());
        },
    };
}
