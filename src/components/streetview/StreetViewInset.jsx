import { useEffect, useRef, useState } from "react";
import { getActiveTerrain } from "../../threejs/terrain/terrainData";
import { GOOGLE_MAPS_API_KEY } from "../project-map/ProjectGoogleWebGLMap";
import useGame from "../../hooks/useGame";
import "./StreetViewInset.css";

// Character mode on terrain (world map) scenes: a small window with the real Google Street View photo
// from the avatar's position, looking where the camera looks. It refreshes when the avatar has moved
// MOVE_M metres or turned TURN_DEG and then held still for SETTLE_MS (each photo is a billed request;
// the metadata lookup that finds the nearest panorama is free).

const POLL_MS = 400;
const SETTLE_MS = 700;
const MOVE_M = 10;
const TURN_DEG = 25;
const RADIUS_M = 60;
const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY;

const WALK_SPLIT_CLASS = "play-mobile-walk-split";

const angleDiff =(a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

function sample(cameraRef) {
    const terrain = getActiveTerrain();
    const frame = terrain?.world?.frame;
    const body = useGame.getState().characterRef;
    const camera = cameraRef?.current;
    if (!frame || !body || !camera) return null;
    let position;
    try {
        position = body.translation();
    } catch {
        return null;
    }
    const forward = camera.getWorldDirection(camera.position.clone());
    // Scene: x east, z south. Street View heading: degrees clockwise from north.
    const heading = ((Math.atan2(forward.x, -forward.z) * 180) / Math.PI + 360) % 360;
    // The scene is aligned to the ground photo (Esri); Google's Street View coordinates sit a few
    // metres apart from it. terrain.json options.streetViewOffset = [east, south] metres (measured from
    // the panorama positions along the estate roads) maps the avatar onto the matching Street View spot.
    const [dx, dz] = terrain.world.options?.streetViewOffset || [0, 0];
    const { lat, lon } = frame.sceneToGeo(position.x + dx, position.z + dz);
    return { x: position.x, z: position.z, lat, lon, heading };
}

export default function StreetViewInset({ cameraRef }) {
    const [open, setOpen] = useState(true);
    const [view, setView] = useState({ status: "idle" });
    const shown = useRef(null); // last requested sample
    const pending = useRef({ sample: null, since: 0 });

    // Phones: the walking view splits like free navigation, with this panel (or the company
    // details sheet) in the bottom third (PlayMobileSplit.css).
    useEffect(() => {
        if (!key) return undefined;
        document.body.classList.add(WALK_SPLIT_CLASS);
        return () => document.body.classList.remove(WALK_SPLIT_CLASS);
    }, []);

    useEffect(() => {
        if (!open || !key) return undefined;
        let cancelled = false;
        const timer = setInterval(async () => {
            const s = sample(cameraRef);
            if (!s) return;
            const last = shown.current;
            if (last && Math.hypot(s.x - last.x, s.z - last.z) < MOVE_M && angleDiff(s.heading, last.heading) < TURN_DEG) {
                pending.current = { sample: null, since: 0 };
                return;
            }
            // Wait until the avatar holds still (position and view) for SETTLE_MS.
            const p = pending.current;
            const now = performance.now();
            if (!p.sample || Math.hypot(s.x - p.sample.x, s.z - p.sample.z) > 1.5 || angleDiff(s.heading, p.sample.heading) > 8) {
                pending.current = { sample: s, since: now };
                return;
            }
            if (now - p.since < SETTLE_MS) return;
            shown.current = s;
            pending.current = { sample: null, since: 0 };
            setView((v) => ({ ...v, status: "loading" }));
            try {
                const meta = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?location=${s.lat},${s.lon}&radius=${RADIUS_M}&source=outdoor&key=${key}`).then((r) => r.json());
                if (cancelled) return;
                if (meta.status !== "OK") {
                    setView({ status: "none" });
                    return;
                }
                const url = `https://maps.googleapis.com/maps/api/streetview?size=480x300&pano=${meta.pano_id}&heading=${s.heading.toFixed(0)}&fov=90&pitch=0&key=${key}`;
                setView({ status: "ok", url, date: meta.date, distance: Math.round(distanceM(s, meta.location)) });
            } catch {
                if (!cancelled) setView({ status: "error" });
            }
        }, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [open, cameraRef]);

    if (!key) return null;
    if (!open) {
        return (
            <button type="button" className="street-view-inset__reopen" onClick={() => { shown.current = null; setOpen(true); }}>
                Street View
            </button>
        );
    }
    return (
        <div className="street-view-inset" role="region" aria-label="Street View at the avatar">
            <div className="street-view-inset__head">
                <span>Street View</span>
                {view.status === "ok" && <small>{view.date ? `Photo ${view.date}` : ""}{view.distance ? ` · ${view.distance} m away` : ""}</small>}
                <button type="button" aria-label="Close Street View" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="street-view-inset__body">
                {view.status === "ok" && <img src={view.url} alt="Google Street View at the avatar's position" />}
                {view.status === "loading" && <div className="street-view-inset__note">Loading…</div>}
                {view.status === "idle" && <div className="street-view-inset__note">Stand still to load the view</div>}
                {view.status === "none" && <div className="street-view-inset__note">No Street View here</div>}
                {view.status === "error" && <div className="street-view-inset__note">Street View unavailable</div>}
            </div>
        </div>
    );
}

function distanceM(a, loc) {
    if (!loc) return 0;
    const dLat = (loc.lat - a.lat) * 110574;
    const dLon = (loc.lng - a.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180);
    return Math.hypot(dLat, dLon);
}
