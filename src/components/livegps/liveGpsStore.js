import { create } from "zustand";
import { connectSocket, emitSocketEvent } from "../../socket";
import useGame from "../../hooks/useGame";
import { getActiveTerrain } from "../../threejs/terrain/terrainData";

// Live GPS: this device streams its real position (the browser's geolocation, high accuracy) to the
// other players of the map, whose view shows this player's avatar walking the real route
// (threejs/player/gpsTrack.ts). Each fix goes out as a "playerMove" with latitude / longitude /
// accuracy; while streaming, the character controller's own moves carry the latest fix too
// (liveGpsFields), so both describe the same player and the server keeps the GPS position.
// The screen is kept on while streaming (a phone with its screen off stops the location updates).

const FIX_OPTIONS = { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 };

let watchId = null;
let wakeLock = null;
let source = null; // where the fixes come from: the device (navigator.geolocation) or a simulation
const history = []; // the fixes received while streaming (for the route test overlay and log)
const MAX_HISTORY = 5000;
let latestFix = null; // { latitude, longitude, altitude, accuracy, heading, speed, at }
let walkRoute = null; // the GPS route walk's route (encoded polyline), sent along so viewers follow it too
let localClientId = "custom_person"; // what the character controller sends (the server keys the player by it)

/** The player id the character controller uses (Ecctrl calls this before each move it sends). */
export function setLiveGpsClientId(id) {
    if (id) localClientId = id;
}

/** The route being walked (GPS route walk) as an encoded polyline, or null: sent with the fixes. */
export function setLiveGpsRoute(encoded) {
    walkRoute = encoded || null;
}

/** Fields of the latest fix to add to a "playerMove" while streaming (empty when not streaming). */
export function liveGpsFields() {
    if (watchId === null || !latestFix) return null;
    return {
        latitude: latestFix.latitude,
        longitude: latestFix.longitude,
        altitude: latestFix.altitude,
        accuracy: latestFix.accuracy,
        gpsHeading: latestFix.heading,
        gpsSpeed: latestFix.speed,
        gpsAt: latestFix.at,
        ...(walkRoute ? { gpsRoute: walkRoute } : {}),
    };
}

/** The fixes received since streaming started ({ latitude, longitude, accuracy, at, receivedAt }). */
export function liveGpsHistory() {
    return history;
}

export const LIVE_GPS_KEYS = ["latitude", "longitude", "altitude", "accuracy", "gpsHeading", "gpsSpeed", "gpsAt", "gpsRoute"];

async function keepScreenOn() {
    try {
        if (document.visibilityState === "visible" && navigator.wakeLock && !wakeLock) {
            wakeLock = await navigator.wakeLock.request("screen");
            wakeLock.addEventListener?.("release", () => { wakeLock = null; });
        }
    } catch {
        wakeLock = null; // not allowed (battery saver, no user gesture): GPS still streams while the screen is on
    }
}

function onVisibility() {
    if (watchId !== null) keepScreenOn();
}

function sendFix() {
    if (!latestFix) return;
    const game = useGame.getState();
    const frame = getActiveTerrain()?.world?.frame;
    // A scene position too (from the map's geo frame), for views without the map.
    const position = frame ? { ...frame.geoToScene(latestFix.latitude, latestFix.longitude), y: 0 } : { x: 0, y: 0, z: 0 };
    emitSocketEvent("playerMove", {
        mType: "player",
        clientId: localClientId,
        projectID: game.projectID,
        userName: game.userData?.fullname,
        personColor: game.personColor,
        currentAnimation: "Idle",
        position,
        dateTime: new Date(latestFix.at).toISOString(),
        ...liveGpsFields(),
    });
}

const useLiveGps = create((set, get) => ({
    status: "off", // off | waiting | live | error
    error: "",
    accuracy: null,
    fixes: 0,
    simulated: false, // the fixes come from a simulation (GPS route test), not the device

    // The device's location (default), or another source with the same watchPosition / clearWatch
    // calls (the simulated walk of the GPS route test): everything after it is the same.
    start: (options = {}) => {
        if (watchId !== null) return;
        const simulated = Boolean(options.source);
        if (!simulated && !("geolocation" in navigator)) {
            set({ status: "error", error: "This device has no location service." });
            return;
        }
        if (!simulated && !window.isSecureContext) {
            set({ status: "error", error: "Location needs a secure (https) page." });
            return;
        }
        connectSocket();
        source = options.source || navigator.geolocation;
        history.length = 0;
        set({ status: "waiting", error: "", accuracy: null, fixes: 0, simulated });
        watchId = source.watchPosition(
            (position) => {
                const c = position.coords;
                latestFix = {
                    latitude: c.latitude,
                    longitude: c.longitude,
                    altitude: Number.isFinite(c.altitude) ? c.altitude : 0,
                    accuracy: c.accuracy,
                    heading: Number.isFinite(c.heading) ? c.heading : null,
                    speed: Number.isFinite(c.speed) ? c.speed : null,
                    at: position.timestamp || Date.now(),
                };
                history.push({ ...latestFix, receivedAt: Date.now() });
                if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
                sendFix();
                set({ status: "live", accuracy: Math.round(c.accuracy), fixes: get().fixes + 1, error: "" });
            },
            (error) => {
                const message = error.code === 1
                    ? "Location permission was denied."
                    : error.code === 3 ? "Waiting for a GPS fix…" : "Location is unavailable.";
                // A timeout only means no fix yet: keep watching.
                set({ status: error.code === 3 ? "waiting" : "error", error: message });
                if (error.code === 1) get().stop(message);
            },
            FIX_OPTIONS
        );
        keepScreenOn();
        document.addEventListener("visibilitychange", onVisibility);
    },

    stop: (error = "") => {
        if (watchId !== null) source?.clearWatch(watchId);
        watchId = null;
        source = null;
        latestFix = null;
        document.removeEventListener("visibilitychange", onVisibility);
        wakeLock?.release?.().catch(() => {});
        wakeLock = null;
        set({ status: error ? "error" : "off", error, accuracy: null, simulated: false });
    },

    toggle: () => (watchId === null ? get().start() : get().stop()),
}));

export default useLiveGps;
