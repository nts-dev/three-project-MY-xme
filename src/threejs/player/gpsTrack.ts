import * as THREE from "three";
import { getActiveTerrain, getTerrainHeightAt } from "../terrain/terrainData";

// Live GPS on the map: a player streaming real coordinates (the "Live GPS" button on a phone, or a
// tracker posting fixes) is placed by its latitude / longitude through the terrain's geo frame
// (scene x east, z south, metres), not by a scene position worked out on the device.
//
// The avatar follows the path the fixes describe: the fixes are played back a little late (about
// one fix interval, PLAYBACK_DELAY) and the avatar walks straight from one fix to the next at the
// speed that took, so it goes along the actual route (round each corner the device went round)
// instead of cutting across towards the newest fix. Bad fixes are dropped (poor accuracy, jumps
// faster than a car), and jitter while standing still does not move the avatar.
//
// One track per player, shared by everything that shows it (the avatar, the follow camera), so they
// agree on where the player is.

const MAX_ACCURACY_M = 50; // fixes less accurate than this are ignored (once there is a good one)
const MAX_SPEED_MS = 70; // a jump implying more than this (~250 km/h) is a bad fix
const MAX_REJECTS = 3; // ... unless it keeps coming: then the device really is there
const STILL_M = 2; // closer than this (or half the fix accuracy) to the last fix: standing still
const TELEPORT_M = 300; // farther than this: the avatar jumps (a new session, a long gap)
const MIN_DELAY_MS = 400;
const MAX_DELAY_MS = 5000;
const STALE_MS = 30000; // no fix for this long: the track has stopped (idle)
const KEEP_POINTS = 120;
const FILTER_ALPHA = 0.4; // share of a fix's surprise taken into the position
const FILTER_BETA = 0.08; // ... and into the velocity

export type GpsSample = {
    position: THREE.Vector3;
    heading: number | null; // radians, the avatar's rotation.y (0 = facing +z / south)
    speed: number; // metres a second along the path
    moving: boolean;
    snapped: boolean; // jumped (first fix, teleport): no walking in between
    stale: boolean;
};

// x / z: position; t: render time; vx / vz: filtered velocity there (for the facing);
// along: metres along the snap route (when snapped onto it).
type Point = { x: number; z: number; t: number; vx?: number; vz?: number; along?: number };

/**
 * A route the own avatar's GPS track is snapped onto ("map matching"): the GPS route test's planned
 * route while its simulated walk runs, so the avatar walks the line and turns only at its corners.
 * Fixes farther than SNAP_MAX_M off the route are not snapped (the walker left it).
 */
type SnapRoute = { points: { x: number; z: number }[]; cumulative: number[]; length: number };
let snapRoute: SnapRoute | null = null;
const SNAP_MAX_M = 25;
const SNAP_BACK_M = 5; // along the route, a fix may fall back this much (noise), not more
const SNAP_AHEAD_M = 40;

export function setGpsSnapRoute(route: SnapRoute | null) {
    snapRoute = route && route.points.length >= 2 ? route : null;
}

// The route travels with the walker's GPS fixes ("gpsRoute" of the player updates: an encoded
// polyline of real coordinates, 6 decimals), so everyone watching holds that player's avatar on the
// same line as the walker's own view does.
const POLYLINE_FACTOR = 1e6;

export function encodeRoutePolyline(geo: { lat: number; lon: number }[]) {
    let out = "";
    let lastLat = 0;
    let lastLon = 0;
    const put = (value: number) => {
        let v = value < 0 ? ~(value << 1) : value << 1;
        while (v >= 0x20) {
            out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
            v >>= 5;
        }
        out += String.fromCharCode(v + 63);
    };
    for (const p of geo) {
        const lat = Math.round(p.lat * POLYLINE_FACTOR);
        const lon = Math.round(p.lon * POLYLINE_FACTOR);
        put(lat - lastLat);
        put(lon - lastLon);
        lastLat = lat;
        lastLon = lon;
    }
    return out;
}

function decodeRoutePolyline(text: string) {
    const points: { lat: number; lon: number }[] = [];
    let index = 0;
    let lat = 0;
    let lon = 0;
    const take = () => {
        let result = 0;
        let shift = 0;
        let byte;
        do {
            byte = text.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20); // a cut-off string ends in NaN, which stops it
        return result & 1 ? ~(result >> 1) : result >> 1;
    };
    while (index < text.length) {
        lat += take();
        lon += take();
        points.push({ lat: lat / POLYLINE_FACTOR, lon: lon / POLYLINE_FACTOR });
    }
    return points;
}

/** A snap route through these scene points. */
export function makeSnapRoute(points: { x: number; z: number }[]): SnapRoute | null {
    if (points.length < 2) return null;
    const cumulative = [0];
    for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
    return { points, cumulative, length: cumulative[cumulative.length - 1] };
}

const decodedRoutes = new Map<string, { frame: any; route: SnapRoute | null }>();

/** The snap route a player's updates carry (decoded once per route and map), or null. */
function playerRoute(player: any, frame: any): SnapRoute | null {
    const text = typeof player?.gpsRoute === "string" ? player.gpsRoute : "";
    if (!text || !frame) return null;
    const cached = decodedRoutes.get(text);
    if (cached && cached.frame === frame) return cached.route;
    let route: SnapRoute | null = null;
    try {
        route = makeSnapRoute(decodeRoutePolyline(text).map((p) => {
            const s = frame.geoToScene(p.lat, p.lon);
            return { x: s.x, z: s.z };
        }));
    } catch {
        route = null;
    }
    if (decodedRoutes.size > 50) decodedRoutes.clear();
    decodedRoutes.set(text, { frame, route });
    return route;
}

/** The point `along` metres along the snap route, and the direction there. */
function routeAt(route: SnapRoute, along: number) {
    const { points, cumulative } = route;
    const d = THREE.MathUtils.clamp(along, 0, route.length);
    let i = 1;
    while (i < points.length - 1 && cumulative[i] < d) i++;
    const a = points[i - 1];
    const b = points[i];
    const span = cumulative[i] - cumulative[i - 1] || 1;
    const f = (d - cumulative[i - 1]) / span;
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, heading: Math.atan2(b.x - a.x, b.z - a.z) };
}

/** Nearest point of the snap route (near the previous position along it), or null when far off. */
function projectOnRoute(route: SnapRoute, x: number, z: number, previous: number | null) {
    let best: { along: number; d: number } | null = null;
    let nearby: { along: number; d: number } | null = null;
    const { points, cumulative } = route;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const f = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
        const d = Math.hypot(x - a.x - dx * f, z - a.z - dz * f);
        const along = cumulative[i - 1] + (cumulative[i] - cumulative[i - 1]) * f;
        if (!best || d < best.d) best = { along, d };
        if (previous !== null && along >= previous - SNAP_BACK_M && along <= previous + SNAP_AHEAD_M && (!nearby || d < nearby.d)) nearby = { along, d };
    }
    const pick = nearby && nearby.d < SNAP_MAX_M ? nearby : best;
    if (!pick || pick.d > SNAP_MAX_M) return null;
    // Noise does not walk the avatar backwards along the route.
    return previous !== null && pick.along < previous && pick.along > previous - SNAP_BACK_M ? previous : pick.along;
}

const DEG = Math.PI / 180;

/** Latitude / longitude of a player snapshot (the server's `gps`, or the raw fields), or null. */
export function playerGpsFix(player: any): { lat: number; lon: number; accuracy: number; key: string } | null {
    const gps = player?.gps;
    const lat = Number(gps?.latitude ?? player?.latitude);
    const lon = Number(gps?.longitude ?? player?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    const accuracy = Number(player?.accuracy ?? gps?.accuracy);
    return {
        lat,
        lon,
        accuracy: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 10,
        // The same fix can come twice (the Live GPS sender and the character controller both carry it).
        key: `${lat},${lon},${player?.gpsAt ?? gps?.recordedAt ?? player?.dateTime ?? ""}`,
    };
}

/** The geo frame of the map shown (null without a terrain map). */
export function activeGeoFrame(): any {
    return getActiveTerrain()?.world?.frame || null;
}

/** Ground metres between two lat/lon points (short distances). */
export function geoDistance(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
    const dy = (b.lat - a.lat) * 111320;
    const dx = (b.lon - a.lon) * 111320 * Math.cos(((a.lat + b.lat) / 2) * DEG);
    return Math.hypot(dx, dy);
}

export class GpsTrack {
    points: Point[] = [];
    lastKey = "";
    lastFixAt = 0;
    interval = 1000; // ms between fixes (eased average)
    rejects = 0;
    heading: number | null = null;
    snapUntil = 0; // render time before which the avatar is placed, not walked
    frame: any = null;
    vx = 0; // filtered velocity, m/s
    vz = 0;
    lastPointAt = 0;
    snap: boolean;
    lastAlong: number | null = null;
    route: SnapRoute | null = null; // the route the player's own updates carry (another player)

    /** snap: follow the snap route (setGpsSnapRoute) while one is set (the own avatar). */
    constructor(snap = false) {
        this.snap = snap;
    }

    /** The route followed: the player's own (another player's walk), else this device's (own avatar). */
    snapTo() {
        return this.route || (this.snap ? snapRoute : null);
    }

    /** Snaps a new point onto the snap route (when following one). */
    private snapPoint(point: Point) {
        const route = this.snapTo();
        if (!route) {
            this.lastAlong = null;
            return point;
        }
        const along = projectOnRoute(route, point.x, point.z, this.lastAlong);
        if (along === null) {
            this.lastAlong = null;
            return point;
        }
        this.lastAlong = along;
        const p = routeAt(route, along);
        return { ...point, x: p.x, z: p.z, along };
    }

    /** Adds the player's current fix (no-op when it is the one already added). */
    push(player: any, now = performance.now()) {
        const fix = playerGpsFix(player);
        const frame = activeGeoFrame();
        if (!fix || !frame) return false;
        if (frame !== this.frame) {
            // Another map (frame): start over.
            this.frame = frame;
            this.points = [];
            this.lastKey = "";
        }
        if (fix.key === this.lastKey) return false;
        this.lastKey = fix.key;

        const p = frame.geoToScene(fix.lat, fix.lon);
        const last = this.points[this.points.length - 1];
        if (this.lastFixAt) {
            const gap = THREE.MathUtils.clamp(now - this.lastFixAt, 100, 10000);
            this.interval += (gap - this.interval) * 0.3;
        }
        this.lastFixAt = now;

        if (!last) {
            if (fix.accuracy > MAX_ACCURACY_M * 4) return false;
            this.vx = this.vz = 0;
            this.lastPointAt = now;
            this.lastAlong = null;
            this.points.push(this.snapPoint({ x: p.x, z: p.z, t: now }));
            this.snapUntil = now + this.delay();
            return true;
        }
        if (fix.accuracy > MAX_ACCURACY_M) return false;

        const distance = Math.hypot(p.x - last.x, p.z - last.z);
        const seconds = Math.max(0.1, (now - last.t) / 1000);
        // A late fix (a dropped one, a slow network): the avatar has been waiting at the last point.
        // It sets off from there now, instead of jumping to where it would have been on time.
        const shown = now - this.delay();
        if (last.t < shown) last.t = shown;
        if (distance / seconds > MAX_SPEED_MS && distance > 30 && ++this.rejects <= MAX_REJECTS) return false;
        this.rejects = 0;

        // Standing still (GPS wanders a few metres): hold the last point, only its time moves on.
        if (distance < Math.max(STILL_M, fix.accuracy * 0.5) && distance / seconds < 0.6) {
            this.vx *= 0.3;
            this.vz *= 0.3;
            this.points.push({ x: last.x, z: last.z, t: now, along: last.along });
        } else if (distance > TELEPORT_M) {
            this.snapUntil = now + this.delay();
            this.vx = this.vz = 0;
            this.lastAlong = null;
            this.points.push(this.snapPoint({ x: p.x, z: p.z, t: now }));
        } else {
            // Alpha-beta filter (position + velocity): each fix pulls the predicted position part of
            // the way, so the fix-to-fix noise (a metre or so each second, at walking pace as large
            // as the step itself) does not zigzag the avatar; steady walking is followed without lag.
            const dt = Math.min(5, Math.max(0.2, (now - this.lastPointAt) / 1000));
            const px = last.x + this.vx * dt;
            const pz = last.z + this.vz * dt;
            const rx = p.x - px;
            const rz = p.z - pz;
            this.vx += (FILTER_BETA * rx) / dt;
            this.vz += (FILTER_BETA * rz) / dt;
            const v = Math.hypot(this.vx, this.vz);
            if (v > MAX_SPEED_MS) {
                this.vx *= MAX_SPEED_MS / v;
                this.vz *= MAX_SPEED_MS / v;
            }
            this.points.push(this.snapPoint({ x: px + FILTER_ALPHA * rx, z: pz + FILTER_ALPHA * rz, t: now, vx: this.vx, vz: this.vz }));
        }
        this.lastPointAt = now;
        if (this.points.length > KEEP_POINTS) this.points.splice(0, this.points.length - KEEP_POINTS);
        return true;
    }

    /** Playback delay: a little more than one fix interval, so the next fix is usually there. */
    delay() {
        return THREE.MathUtils.clamp(this.interval * 1.25 + 150, MIN_DELAY_MS, MAX_DELAY_MS);
    }

    /** Where the avatar is now (ground height from the terrain), or null before the first fix. */
    sample(now: number, out: GpsSample) {
        const points = this.points;
        if (!points.length) return null;
        const t = now - this.delay();
        let i = points.length - 1;
        while (i > 0 && points[i].t > t) i--;
        const a = points[i];
        const b = points[Math.min(i + 1, points.length - 1)];
        let x = a.x;
        let z = a.z;
        let speed = 0;
        if (b !== a && t > a.t) {
            const f = Math.min(1, (t - a.t) / Math.max(1, b.t - a.t));
            const route = this.snapTo();
            if (route && a.along !== undefined && b.along !== undefined) {
                // Along the route itself (round its corners, not across them); facing along it.
                const along = a.along + (b.along - a.along) * f;
                const p = routeAt(route, along);
                x = p.x;
                z = p.z;
                if (f < 1) speed = Math.abs(b.along - a.along) / Math.max(0.05, (b.t - a.t) / 1000);
                if (b.along - a.along > 0.3) this.heading = p.heading;
            } else {
                x = a.x + (b.x - a.x) * f;
                z = a.z + (b.z - a.z) * f;
                const length = Math.hypot(b.x - a.x, b.z - a.z);
                if (f < 1) speed = length / Math.max(0.05, (b.t - a.t) / 1000);
                // Facing: the filtered walking direction (steady), not each fix-to-fix step (noisy).
                const v = Math.hypot(b.vx ?? 0, b.vz ?? 0);
                if (v > 0.4) this.heading = Math.atan2(b.vx!, b.vz!);
                else if (length > 0.3 && b.vx === undefined) this.heading = Math.atan2(b.x - a.x, b.z - a.z);
            }
        }
        // Points already walked past are not needed any more (one kept as the segment start).
        if (i > 1) points.splice(0, i - 1);

        const ground = getTerrainHeightAt(x, z);
        out.position.set(x, ground ?? 0, z);
        out.heading = this.heading;
        out.speed = speed;
        out.moving = speed > 0.2;
        out.snapped = t < this.snapUntil;
        out.stale = now - this.lastFixAt > STALE_MS;
        return out;
    }
}

const tracks = new Map<string, GpsTrack>();

/** The shared track of a player (fed with its latest snapshot), or null when it has no GPS fix / no map. */
export function gpsTrackFor(player: any, now = performance.now()) {
    if (!player?.clientId || player?.rtls || player?.isTrackReplay) return null;
    const fix = playerGpsFix(player);
    if (!fix || !activeGeoFrame()) return null;
    const id = String(player.clientId);
    let track = tracks.get(id);
    if (!track) {
        track = new GpsTrack();
        tracks.set(id, track);
    }
    // Walking a route (GPS route walk on their device): held on that route's line here too.
    const route = playerRoute(player, activeGeoFrame());
    if (route !== track.route) {
        track.route = route;
        track.lastAlong = null;
    }
    track.push(player, now);
    return track.points.length ? track : null;
}

/** Routes other players are walking now (for drawing their lines): [{ id, route }]. */
export function remoteGpsRoutes() {
    const list: { id: string; route: SnapRoute }[] = [];
    const now = performance.now();
    for (const [id, track] of tracks) {
        if (track.route && now - track.lastFixAt < STALE_MS) list.push({ id, route: track.route });
    }
    return list;
}

/** Forgets the track of a player who left. */
export function dropGpsTrack(clientId: any) {
    tracks.delete(String(clientId));
}

export function createGpsSample(): GpsSample {
    return { position: new THREE.Vector3(), heading: null, speed: 0, moving: false, snapped: true, stale: false };
}
