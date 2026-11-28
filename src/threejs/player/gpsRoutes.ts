import * as THREE from "three";
import { getActiveTerrain } from "../terrain/terrainData";
import { regionToScene } from "../terrain/world/bridgeMeshes";
import { frontOfAssetId, frontOfCompany } from "./projectSpawn";

/** Start and end points (in front of the two buildings) of a route test, or nulls. */
function routeEnds(test: RouteTest) {
    const end = (id?: string, name?: string) => (id ? frontOfAssetId(id, FRONT_DISTANCE) : name ? frontOfCompany(name, FRONT_DISTANCE) : null);
    return { start: end(test.fromId, test.from), end: end(test.toId, test.to) };
}

// Walking routes along the map's streets between two buildings, as real GPS coordinates: used by
// the GPS route test (components/livegps/gpsRouteTest.js) to stream the walk as live GPS fixes
// (simulated), and as the reference for walking it for real with a phone.
//
// The route follows the street centrelines of the map region (OSM based roads, the same ones the
// ground roads are drawn from): from the front of the first building to the nearest street, the
// shortest way along the streets, then to the front of the second building.

// from / to: Company Names; fromId / toId: scene asset ids (picked in the panel; any building).
export type RouteTest = { id: string; projects?: string[]; from?: string; to?: string; fromId?: string; toId?: string; label: string };

export const ROUTE_TESTS: RouteTest[] = [
    {
        id: "nts-girbau",
        projects: ["153_L2"],
        from: "NTS Computers",
        to: "Girbau Southeast Asia",
        label: "NTS Computers → Girbau Southeast Asia",
    },
];

export function routeTestFor(projectId: unknown): RouteTest | null {
    const id = String(projectId ?? "").trim().toUpperCase();
    return ROUTE_TESTS.find((route) => route.projects?.includes(id)) || null;
}

export type PlannedRoute = {
    test: RouteTest;
    points: { x: number; z: number }[]; // scene metres (x east, z south)
    geo: { lat: number; lon: number }[]; // the same points as real coordinates
    length: number; // metres (of the line drawn)
    distance?: number; // metres Google gives for the walk (shown instead of the line's length)
    duration?: number; // seconds Google gives for walking it
    cumulative: number[]; // metres along the route at each point
};

const FRONT_DISTANCE = 3; // metres in front of the facade (start / end of the walk)
const STEP = 2; // metres between street graph nodes
const JOIN = 2.6; // nodes of two streets closer than this are connected (crossings)
const STUB_JOIN = 12; // a street end this close to another street joins it (T-junctions)

type Graph = { x: Float64Array; z: Float64Array; edges: Map<number, [number, number][]> };

/** Street centrelines of the active map, in scene metres. */
function streetLines(): { x: number; z: number }[][] {
    const world = getActiveTerrain()?.world;
    if (!world?.regions?.length) return [];
    const lines: { x: number; z: number }[][] = [];
    for (const region of world.regions) {
        const toScene = world.roadsInSceneCoords ? null : regionToScene(region, world.frame, world.anchorElevation);
        for (const road of region.roads || []) {
            if (road.surface || !(road.points?.length >= 2) || !(road.width > 0)) continue;
            lines.push(road.points.map(([x, z]: [number, number]) => {
                if (!toScene) return { x, z };
                const p = toScene(x, z, 0);
                return { x: p.x, z: p.z };
            }));
        }
    }
    return lines;
}

function buildGraph(lines: { x: number; z: number }[][]): Graph {
    const xs: number[] = [];
    const zs: number[] = [];
    const line: number[] = [];
    const edges = new Map<number, [number, number][]>();
    const link = (a: number, b: number) => {
        if (a === b) return;
        const d = Math.hypot(xs[a] - xs[b], zs[a] - zs[b]);
        if (!edges.has(a)) edges.set(a, []);
        if (!edges.has(b)) edges.set(b, []);
        edges.get(a)!.push([b, d]);
        edges.get(b)!.push([a, d]);
    };
    const ends: number[] = [];
    lines.forEach((points, lineIndex) => {
        let previous = -1;
        for (let i = 0; i < points.length; i++) {
            const a = points[i];
            const b = points[i + 1];
            const pieces = b ? Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / STEP)) : 1;
            for (let k = 0; k < pieces; k++) {
                if (!b && k > 0) break;
                const f = b ? k / pieces : 0;
                xs.push(a.x + (b ? (b.x - a.x) * f : 0));
                zs.push(a.z + (b ? (b.z - a.z) * f : 0));
                line.push(lineIndex);
                const node = xs.length - 1;
                if (previous >= 0) link(previous, node);
                if (previous < 0) ends.push(node);
                previous = node;
            }
        }
        if (previous >= 0) ends.push(previous);
    });

    // Spatial hash for the crossings / junctions.
    const cell = STUB_JOIN;
    const grid = new Map<string, number[]>();
    const cellKey = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    for (let i = 0; i < xs.length; i++) {
        const key = cellKey(xs[i], zs[i]);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(i);
    }
    const near = (i: number, radius: number, each: (j: number, d: number) => void) => {
        const cx = Math.floor(xs[i] / cell);
        const cz = Math.floor(zs[i] / cell);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            for (const j of grid.get(`${cx + dx},${cz + dz}`) || []) {
                if (line[j] === line[i]) continue;
                const d = Math.hypot(xs[i] - xs[j], zs[i] - zs[j]);
                if (d <= radius) each(j, d);
            }
        }
    };
    for (let i = 0; i < xs.length; i++) near(i, JOIN, (j) => { if (j > i) link(i, j); });
    // Street ends stopping short of the street they meet: joined to its nearest node.
    for (const i of ends) {
        let best = -1;
        let bestD = Infinity;
        near(i, STUB_JOIN, (j, d) => { if (d < bestD) { bestD = d; best = j; } });
        if (best >= 0 && bestD > JOIN) link(i, best);
    }
    return { x: Float64Array.from(xs), z: Float64Array.from(zs), edges };
}

// The street graph of the active map, built once per map.
let graphCache: { world: any; graph: Graph | null } | null = null;
function streetGraph(): Graph | null {
    const world = getActiveTerrain()?.world;
    if (!world) return null;
    if (graphCache?.world !== world) {
        const lines = streetLines();
        graphCache = { world, graph: lines.length ? buildGraph(lines) : null };
    }
    return graphCache.graph;
}

const FOLLOW_STEP = 20; // metres between the points of a path matched to the streets
const FOLLOW_MAX_OFF = 30; // a path point farther than this from any street is not matched
const FOLLOW_MAX_DETOUR = 1.6; // the matched path may be at most this much longer than the path

/**
 * The same way as `path` (e.g. Google's walking route, which follows the real-world roads), traced
 * along the map's own street centrelines: points every FOLLOW_STEP metres are matched to the nearest
 * street, and joined by the shortest way along the streets. Null when it does not match well.
 */
export function followStreets(path: { x: number; z: number }[]): { x: number; z: number }[] | null {
    const graph = streetGraph();
    if (!graph || path.length < 2) return null;
    let length = 0;
    const samples: { x: number; z: number }[] = [path[0]];
    for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        const pieces = Math.max(1, Math.ceil(d / FOLLOW_STEP));
        for (let k = 1; k <= pieces; k++) samples.push({ x: a.x + ((b.x - a.x) * k) / pieces, z: a.z + ((b.z - a.z) * k) / pieces });
        length += d;
    }
    const nodes: number[] = [];
    for (const p of samples) {
        const node = nearestNode(graph, p.x, p.z);
        if (node < 0 || Math.hypot(graph.x[node] - p.x, graph.z[node] - p.z) > FOLLOW_MAX_OFF) continue;
        if (nodes[nodes.length - 1] !== node) nodes.push(node);
    }
    if (nodes.length < 2) return null;
    const out: number[] = [nodes[0]];
    for (let i = 1; i < nodes.length; i++) {
        const leg = shortestPath(graph, out[out.length - 1], nodes[i]);
        if (!leg) return null;
        out.push(...leg.slice(1));
    }
    // A matched point on the wrong street sends the path out and back: cut such loops.
    const points = out.map((i) => ({ x: graph.x[i], z: graph.z[i] }));
    const seen = new Map<number, number>();
    const clean: number[] = [];
    for (const node of out) {
        if (seen.has(node)) {
            const at = seen.get(node)!;
            for (const dropped of clean.splice(at + 1)) seen.delete(dropped);
            continue;
        }
        seen.set(node, clean.length);
        clean.push(node);
    }
    const matched = clean.map((i) => ({ x: graph.x[i], z: graph.z[i] }));
    let matchedLength = 0;
    for (let i = 1; i < matched.length; i++) matchedLength += Math.hypot(matched[i].x - matched[i - 1].x, matched[i].z - matched[i - 1].z);
    if (matchedLength > Math.max(length * FOLLOW_MAX_DETOUR, length + 60)) return null;
    // Kinks where two street pieces join (a step of a few metres in the data) are straightened; real
    // corners lie far off the straight line and stay.
    return simplify(matched.length >= 2 ? matched : points, 2.5);
}

function nearestNode(graph: Graph, x: number, z: number) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < graph.x.length; i++) {
        const d = Math.hypot(graph.x[i] - x, graph.z[i] - z);
        if (d < bestD) { bestD = d; best = i; }
    }
    return best;
}

function shortestPath(graph: Graph, from: number, to: number): number[] | null {
    const n = graph.x.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const heap: [number, number][] = [];
    const push = (d: number, i: number) => {
        heap.push([d, i]);
        let c = heap.length - 1;
        while (c > 0) {
            const p = (c - 1) >> 1;
            if (heap[p][0] <= heap[c][0]) break;
            [heap[p], heap[c]] = [heap[c], heap[p]];
            c = p;
        }
    };
    const pop = () => {
        const top = heap[0];
        const last = heap.pop()!;
        if (heap.length) {
            heap[0] = last;
            let c = 0;
            for (;;) {
                const l = c * 2 + 1;
                const r = l + 1;
                let m = c;
                if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                if (m === c) break;
                [heap[m], heap[c]] = [heap[c], heap[m]];
                c = m;
            }
        }
        return top;
    };
    dist[from] = 0;
    push(0, from);
    while (heap.length) {
        const [d, i] = pop();
        if (d > dist[i]) continue;
        if (i === to) break;
        for (const [j, w] of graph.edges.get(i) || []) {
            if (d + w < dist[j]) {
                dist[j] = d + w;
                prev[j] = i;
                push(d + w, j);
            }
        }
    }
    if (!Number.isFinite(dist[to])) return null;
    const path: number[] = [];
    for (let i = to; i >= 0; i = prev[i]) path.push(i);
    return path.reverse();
}

/** Drops points that lie (nearly) on the straight line between their neighbours. */
export function simplify(points: { x: number; z: number }[], tolerance = 0.4) {
    if (points.length < 3) return points;
    const keep = new Array(points.length).fill(false);
    keep[0] = keep[points.length - 1] = true;
    const stack: [number, number][] = [[0, points.length - 1]];
    while (stack.length) {
        const [a, b] = stack.pop()!;
        const pa = points[a];
        const pb = points[b];
        const length = Math.hypot(pb.x - pa.x, pb.z - pa.z) || 1;
        let worst = -1;
        let worstD = tolerance;
        for (let i = a + 1; i < b; i++) {
            const p = points[i];
            const d = Math.abs((pb.x - pa.x) * (pa.z - p.z) - (pa.x - p.x) * (pb.z - pa.z)) / length;
            if (d > worstD) { worstD = d; worst = i; }
        }
        if (worst >= 0) {
            keep[worst] = true;
            stack.push([a, worst], [worst, b]);
        }
    }
    return points.filter((_, i) => keep[i]);
}

/** A route through these scene points (e.g. the smoothed path of a recorded walk). */
export function routeFromScenePoints(test: RouteTest, scenePoints: { x: number; z: number }[]): PlannedRoute | null {
    const frame = getActiveTerrain()?.world?.frame;
    if (!frame || scenePoints.length < 2) return null;
    const points = simplify(scenePoints, 0.3);
    const cumulative = [0];
    for (let i = 1; i < points.length; i++) {
        cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
    }
    return { test, points, geo: points.map((p) => frame.sceneToGeo(p.x, p.z)), length: cumulative[cumulative.length - 1], cumulative };
}

/** Plans the route of a route test on the active map; null when the map / buildings are not ready. */
export function planRoute(test: RouteTest): PlannedRoute | null {
    const frame = getActiveTerrain()?.world?.frame;
    const { start, end } = routeEnds(test);
    if (!frame || !start || !end) return null;
    const graph = streetGraph();
    if (!graph) return null;
    const a = nearestNode(graph, start.x, start.z);
    const b = nearestNode(graph, end.x, end.z);
    const path = a >= 0 && b >= 0 ? shortestPath(graph, a, b) : null;
    if (!path) return null;
    const points = simplify([
        { x: start.x, z: start.z },
        ...path.map((i) => ({ x: graph.x[i], z: graph.z[i] })),
        { x: end.x, z: end.z },
    ]);
    const cumulative = [0];
    for (let i = 1; i < points.length; i++) {
        cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
    }
    return {
        test,
        points,
        geo: points.map((p) => frame.sceneToGeo(p.x, p.z)),
        length: cumulative[cumulative.length - 1],
        cumulative,
    };
}

/** Point (scene x / z) `distance` metres along the route, and the direction of travel there. */
export function pointAlong(route: PlannedRoute, distance: number) {
    const { points, cumulative } = route;
    const d = THREE.MathUtils.clamp(distance, 0, route.length);
    let i = 1;
    while (i < points.length - 1 && cumulative[i] < d) i++;
    const a = points[i - 1];
    const b = points[i];
    const span = cumulative[i] - cumulative[i - 1] || 1;
    const f = (d - cumulative[i - 1]) / span;
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, dx: (b.x - a.x) / span, dz: (b.z - a.z) / span };
}

/** Shortest distance (metres) from a scene point to the route line, and how far along it that is. */
export function routeOffset(route: PlannedRoute, x: number, z: number) {
    let best = Infinity;
    let along = 0;
    const { points, cumulative } = route;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const f = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
        const d = Math.hypot(x - a.x - dx * f, z - a.z - dz * f);
        if (d < best) {
            best = d;
            along = cumulative[i - 1] + (cumulative[i] - cumulative[i - 1]) * f;
        }
    }
    return { off: best, along };
}

/** The route as a GPX file (a track to follow / load into a GPS app). */
export function routeGpx(route: PlannedRoute) {
    const points = route.geo.map((p) => `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"></trkpt>`).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPS route test" xmlns="http://www.topografix.com/GPX/1/1">
  <rte><name>${route.test.label.replace(/[<>&]/g, "")}</name>
${route.geo.map((p) => `    <rtept lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"></rtept>`).join("\n")}
  </rte>
  <trk><name>${route.test.label.replace(/[<>&]/g, "")}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`;
}

/**
 * The walking route Google gives between the two buildings (Google Maps: the Routes API, else the
 * older Directions service), from the front of the first to the front of the second. Throws when
 * Google refuses (the API key needs the "Routes API" or "Directions API" enabled) or finds no route.
 */
const GOOGLE_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} did not answer.`)), GOOGLE_TIMEOUT_MS)),
    ]);
}

export async function planGoogleRoute(test: RouteTest): Promise<PlannedRoute> {
    const frame = getActiveTerrain()?.world?.frame;
    const { start, end } = routeEnds(test);
    if (!frame || !start || !end) throw new Error("The map or the buildings are not loaded yet.");
    const a = frame.sceneToGeo(start.x, start.z);
    const b = frame.sceneToGeo(end.x, end.z);
    const { loadGoogleMaps } = await import("../../components/project-map/ProjectGoogleWebGLMap");
    const maps: any = await withTimeout(loadGoogleMaps(), "Google Maps");
    const lib: any = maps.importLibrary ? await withTimeout(maps.importLibrary("routes"), "Google Maps") : maps;
    let path: { lat: number; lng: number }[] | null = null;
    let distance: number | undefined;
    let duration: number | undefined;
    const errors: string[] = [];
    if (lib.Route?.computeRoutes) {
        try {
            const { routes } = await withTimeout<any>(lib.Route.computeRoutes({
                origin: { lat: a.lat, lng: a.lon },
                destination: { lat: b.lat, lng: b.lon },
                travelMode: "WALKING",
                fields: ["path", "distanceMeters", "durationMillis"],
            }), "Google's route service");
            const points = routes?.[0]?.path;
            if (points?.length) path = points.map((p: any) => ({ lat: typeof p.lat === "function" ? p.lat() : p.lat, lng: typeof p.lng === "function" ? p.lng() : p.lng }));
            if (Number.isFinite(routes?.[0]?.distanceMeters)) distance = routes[0].distanceMeters;
            if (Number.isFinite(routes?.[0]?.durationMillis)) duration = routes[0].durationMillis / 1000;
        } catch (error: any) {
            errors.push(String(error?.message || error));
        }
    }
    if (!path && lib.DirectionsService) {
        try {
            const result: any = await withTimeout(new lib.DirectionsService().route({
                origin: { lat: a.lat, lng: a.lon },
                destination: { lat: b.lat, lng: b.lon },
                travelMode: "WALKING",
            }), "Google's directions service");
            const points = result?.routes?.[0]?.overview_path;
            if (points?.length) path = points.map((p: any) => ({ lat: p.lat(), lng: p.lng() }));
            const legs = result?.routes?.[0]?.legs || [];
            if (legs.length) distance = legs.reduce((sum: number, leg: any) => sum + (leg?.distance?.value || 0), 0) || undefined;
            if (legs.length) duration = legs.reduce((sum: number, leg: any) => sum + (leg?.duration?.value || 0), 0) || undefined;
        } catch (error: any) {
            errors.push(String(error?.message || error));
        }
    }
    if (!path) {
        const denied = errors.some((e) => /denied|not allowed|permission/i.test(e));
        throw new Error(denied
            ? "Google refused: enable the \"Routes API\" for this app's Google Maps API key (Google Cloud console)."
            : errors[0] || "Google found no walking route.");
    }
    const google = path.map((p) => frame.geoToScene(p.lat, p.lng)).map((p: any) => ({ x: p.x, z: p.z }));
    // Along the 3D map's streets (Google's road geometry can be metres off them); Google's own line
    // only when it does not match the map's streets.
    const scene = followStreets(google) || google;
    const route = routeFromScenePoints(test, [{ x: start.x, z: start.z }, ...scene, { x: end.x, z: end.z }]);
    if (route && distance) route.distance = distance;
    if (route && duration) route.duration = duration;
    if (!route) throw new Error("Google's route could not be placed on the map.");
    return route;
}
