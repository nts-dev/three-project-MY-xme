import { create } from "zustand";
import useLiveGps, { setLiveGpsRoute } from "./liveGpsStore";
import { getActiveTerrain } from "../../threejs/terrain/terrainData";
import { planGoogleRoute, planRoute, pointAlong, routeOffset } from "../../threejs/player/gpsRoutes";
import { encodeRoutePolyline, setGpsSnapRoute } from "../../threejs/player/gpsTrack";
import { buildIndex, findBuildingMatches } from "../buildingSearchIndex";

/** A building one can walk to: named or numbered (not an unnamed object, listed as "Unit <id>"). */
export const isPlace = (item) => !/^Unit \d+$/.test(item.name);

const MIN_MATCH_SCORE = 35; // typed text (not picked from the list): the best match must be at least this good

/**
 * The building meant by From / To: the one picked from the list (by id) while its name is still
 * what the field shows, else the best search match for the typed text (as the top bar search finds
 * buildings: name, number, business type, street). { id, name } or null.
 */
export function resolveBuilding(text, id) {
    const query = String(text || "").trim();
    if (!query) return null;
    const index = buildIndex();
    const picked = id && index.find((item) => item.id === id);
    if (picked && picked.name === query) return { id: picked.id, name: picked.name };
    const best = findBuildingMatches(query, index).filter(isPlace)[0];
    return best && best.score >= MIN_MATCH_SCORE ? { id: best.id, name: best.name } : null;
}

// GPS route test: a walk shown as a blue line, which the own avatar walks along (character view),
// driven by live GPS fixes going exactly the way real phone fixes go (liveGpsStore -> server ->
// gpsTrack). The avatar is held on the line ("map matching", gpsTrack.ts setGpsSnapRoute), so GPS
// noise does not wobble or turn it: it turns only where the line does.
//
// The route: any two buildings of the map (From / To in the panel, preset per project, e.g. 153_L2
// NTS Computers -> Girbau Southeast Asia), the path from Google's walking directions or along the
// map's streets (gpsRoutes.ts); shown as the blue line before walking ("Show route").
//
// Modes:
// - "sim":  fixes made up along the route in real time with a phone's errors (on a computer).
// - "real": this device's own precise GPS (a phone running this app).

const WALK_SPEED = 1.4; // m/s, a normal walking pace
const FIX_INTERVAL = 1000; // ms
const FIX_JITTER = 150; // ms
const DRIFT_SIGMA = 2.5; // m, the slowly wandering error (per axis)
const DRIFT_TAU = 20; // s, how slowly it wanders
const NOISE_SIGMA = 0.7; // m, fix-to-fix noise (per axis)
const DROP_RATE = 0.05; // fixes not delivered
const COLD_START_S = 4; // s standing at the door while the first fixes settle
const STAND_AT_END_S = 8; // s standing at the destination before the walk ends
const ARRIVED_M = 4; // avatar this close to the destination: arrived

function gaussian() {
    let u = 0;
    let v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Phones / tablets running the app (touch, with a location service on a secure page). */
export function isMobileGpsDevice() {
    try {
        return Boolean(window.matchMedia?.("(pointer: coarse)").matches && "geolocation" in navigator && window.isSecureContext);
    } catch {
        return false;
    }
}

/**
 * A location source walking the route (watchPosition / clearWatch like navigator.geolocation),
 * producing real coordinates through the map's geo frame.
 */
function routeWalkSource(route, frame, { speed = WALK_SPEED, onEnd } = {}) {
    let timer = null;
    return {
        watchPosition(success) {
            const started = performance.now();
            const drift = { x: gaussian() * DRIFT_SIGMA, z: gaussian() * DRIFT_SIGMA };
            let last = started;
            const walkTime = route.length / speed;
            const tick = () => {
                const now = performance.now();
                const t = (now - started) / 1000;
                const dt = (now - last) / 1000;
                last = now;
                // Gauss-Markov drift: correlated over ~DRIFT_TAU seconds.
                const keep = Math.exp(-dt / DRIFT_TAU);
                const kick = Math.sqrt(1 - keep * keep) * DRIFT_SIGMA;
                drift.x = drift.x * keep + gaussian() * kick;
                drift.z = drift.z * keep + gaussian() * kick;
                // The first fixes (just out of the door) are poor and settle within a few seconds.
                const cold = Math.max(0, 1 - t / COLD_START_S);
                const walked = Math.max(0, t - COLD_START_S) * speed;
                const p = pointAlong(route, walked);
                const x = p.x + drift.x + gaussian() * (NOISE_SIGMA + cold * 6);
                const z = p.z + drift.z + gaussian() * (NOISE_SIGMA + cold * 6);
                if (Math.random() >= DROP_RATE || t < 1) {
                    const g = frame.sceneToGeo(x, z);
                    const accuracy = Math.round(4 + Math.abs(gaussian()) * 2 + cold * 18);
                    success({
                        timestamp: Date.now(),
                        coords: { latitude: g.lat, longitude: g.lon, altitude: null, accuracy, heading: null, speed: null },
                    });
                }
                if (t > COLD_START_S + walkTime + STAND_AT_END_S) {
                    onEnd?.();
                    return;
                }
                timer = setTimeout(tick, FIX_INTERVAL + (Math.random() * 2 - 1) * FIX_JITTER);
            };
            timer = setTimeout(tick, 300);
            return 1;
        },
        clearWatch() {
            clearTimeout(timer);
            timer = null;
        },
    };
}

const PLAN_KEY = "gps-route-plan";

function readPlan() {
    try {
        return JSON.parse(localStorage.getItem(PLAN_KEY) || "{}") || {};
    } catch {
        return {};
    }
}

function writePlan(plan) {
    try {
        localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    } catch {
        // Not kept: fine.
    }
}

/** A route test between two buildings ({ id, name }). */
function routeBetween(from, to) {
    return { id: `walk-${from.id}-${to.id}`, fromId: from.id, toId: to.id, from: from.name, to: to.name, label: `${from.name} → ${to.name}` };
}

let avatarPlaced = false; // the avatar has reached the line (placed at the start)

const savedPlan = readPlan();

const useGpsRouteTest = create((set, get) => ({
    open: false, // the panel is shown
    from: savedPlan.from || "", // the building the walk starts at (as the field shows it)
    fromId: savedPlan.fromId || "", // ... its scene asset id when picked from the list
    to: savedPlan.to || "",
    toId: savedPlan.toId || "",
    pathSource: savedPlan.pathSource || "google", // "google" | "streets"
    planning: false,
    planNote: "", // e.g. why Google's route could not be used
    active: false,
    mode: null, // "sim" | "real"
    route: null,
    error: "",
    startedAt: 0,
    progress: 0, // metres along the line (the avatar)
    arrivedAt: 0,
    summary: null,

    /** Opens the panel (the recorded walks, the actions) without starting a walk. */
    show() {
        set({ open: true });
    },

    /** From / To / path source (kept in this browser). */
    setPlan(patch) {
        set({ ...patch, planNote: "" });
        const { from, fromId, to, toId, pathSource } = get();
        writePlan({ from, fromId, to, toId, pathSource });
    },

    /** Presets From / To (a project's route) when nothing is chosen yet. */
    preset(test) {
        if (!test || get().from || get().to) return;
        const from = resolveBuilding(test.from);
        const to = resolveBuilding(test.to);
        set({ from: from?.name || "", fromId: from?.id || "", to: to?.name || "", toId: to?.id || "" });
    },

    /**
     * Plans the route From -> To (Google's walking directions, falling back to the map's streets) and
     * shows it as the blue line; returns it (null when it cannot be planned).
     */
    async plan() {
        const { from, fromId, to, toId, pathSource, active } = get();
        if (active) return get().route;
        if (!from.trim() || !to.trim()) {
            set({ open: true, error: "Pick the building to start at and the one to walk to." });
            return null;
        }
        const start = resolveBuilding(from, fromId);
        const end = resolveBuilding(to, toId);
        if (!start || !end) {
            set({ open: true, error: `No building matching "${(!start ? from : to).trim()}" on this map: pick one from the list.` });
            return null;
        }
        if (start.id === end.id) {
            set({ open: true, error: "From and To are the same building." });
            return null;
        }
        // The fields show the buildings found.
        get().setPlan({ from: start.name, fromId: start.id, to: end.name, toId: end.id });
        const test = routeBetween(start, end);
        set({ open: true, planning: true, error: "", planNote: "", summary: null });
        let route = null;
        let note = "";
        if (pathSource === "google") {
            try {
                route = await planGoogleRoute(test);
                note = "Path: Google walking directions.";
            } catch (error) {
                note = `${error.message} Using the map's streets instead.`;
            }
        }
        if (!route) {
            route = planRoute(test);
            if (route && !note) note = "Path: along the map's streets.";
        }
        set({
            planning: false,
            route,
            mode: null,
            progress: 0,
            planNote: route ? note : "",
            error: route ? "" : "No route between these buildings (the map may still be loading).",
        });
        return route;
    },

    /** Starts a walk along the planned route (mode "sim": simulated fixes; "real": this device's GPS). */
    start(test, mode = "sim", plannedRoute = null) {
        get().stop(true);
        const frame = getActiveTerrain()?.world?.frame;
        const route = !frame ? null : plannedRoute || (test ? planRoute(test) : null);
        if (!route || !frame) {
            set({ open: true, summary: null, error: "The map or the buildings are not loaded yet; try again in a moment." });
            return false;
        }
        avatarPlaced = false;
        setGpsSnapRoute(route);
        // Sent with the fixes: everyone watching holds this avatar on the same line.
        setLiveGpsRoute(encodeRoutePolyline(route.geo));
        set({ open: true, active: true, mode, route, error: "", startedAt: Date.now(), progress: 0, arrivedAt: 0, summary: null });
        const live = useLiveGps.getState();
        if (live.status === "live" || live.status === "waiting") live.stop();
        if (mode === "sim") {
            live.start({ source: routeWalkSource(route, frame, { onEnd: () => get().finish() }) });
        } else {
            live.start();
        }
        return true;
    },

    /** Avatar position sample (scene x / z) while the walk runs. */
    sampleAvatar(x, z) {
        const { active, route, arrivedAt, mode } = get();
        if (!active || !route) return;
        if (useLiveGps.getState().status !== "live") return;
        const { off, along } = routeOffset(route, x, z);
        // Not counted before the avatar has been placed at the start (it may be anywhere until then).
        if (!avatarPlaced && off > 10) return;
        avatarPlaced = true;
        const end = route.points[route.points.length - 1];
        const arrived = !arrivedAt && Math.hypot(x - end.x, z - end.z) < ARRIVED_M;
        set({
            progress: along,
            ...(arrived ? { arrivedAt: Date.now() } : {}),
        });
        // Walking for real: done a little after arriving.
        if (mode === "real" && get().arrivedAt && Date.now() - get().arrivedAt > STAND_AT_END_S * 1000) get().finish();
    },

    /** Ends the walk: stops the GPS stream and keeps a short summary. */
    finish() {
        const state = get();
        if (!state.active) return;
        const summary = {
            routeLength: state.route.distance || state.route.length,
            walked: state.arrivedAt
                ? state.route.distance || state.route.length
                : (state.progress / Math.max(1, state.route.length)) * (state.route.distance || state.route.length),
            seconds: (Date.now() - state.startedAt) / 1000,
            arrived: Boolean(state.arrivedAt),
        };
        useLiveGps.getState().stop();
        setGpsSnapRoute(null);
        setLiveGpsRoute(null);
        set({ active: false, summary });
    },

    /** Stops the walk (quiet: no summary, when starting another one). */
    stop(quiet = false) {
        if (get().active) {
            if (!quiet) return get().finish();
            useLiveGps.getState().stop();
        }
        setGpsSnapRoute(null);
        setLiveGpsRoute(null);
        set({ active: false });
    },

    close() {
        get().stop(true);
        set({ open: false, route: null, summary: null, error: "", mode: null });
    },

}));

export default useGpsRouteTest;
