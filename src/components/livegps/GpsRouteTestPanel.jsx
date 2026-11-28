import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useGpsRouteTest, { isMobileGpsDevice, isPlace } from "./gpsRouteTest";
import useLiveGps from "./liveGpsStore";
import { buildIndex, findBuildingMatches } from "../buildingSearchIndex";
import "./gpsRouteTest.css";

// The GPS route walk's panel: From / To buildings, where the path comes from, the walk button
// (a phone walks with its own GPS, a computer simulates the fixes) and the progress.

function duration(seconds) {
    const s = Math.round(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "7 min" / "1 h 5 min" (a walking time). */
function minutes(seconds) {
    const m = Math.max(1, Math.round(seconds / 60));
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

const PATH_SOURCES = [
    { id: "google", label: "Google", title: "Google's walking directions (the way Google sends a pedestrian), drawn along the map's roads" },
    { id: "streets", label: "Map streets", title: "The shortest way along this map's own streets (no Google)" },
];

const MAX_SUGGESTIONS = 8;
const normalize = (value) => String(value ?? "").trim().toLowerCase();

/** The text with the first match of `query` in bold. */
function Highlight({ text, query }) {
    const at = normalize(text).indexOf(normalize(query));
    if (!query.trim() || at < 0) return text;
    const end = at + query.trim().length;
    return <>{text.slice(0, at)}<strong>{text.slice(at, end)}</strong>{text.slice(end)}</>;
}

/**
 * A building field with its own suggestion list (the browser's datalist showed the secondary text
 * instead of the names): the buildings matching what is typed, as the top bar search finds them
 * (name, number, business type, street), best first. Arrow keys / Enter / Escape, or click.
 */
function BuildingField({ label, value, onText, onPick }) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const rootRef = useRef(null);
    const index = useMemo(() => (open ? buildIndex() : []), [open]);
    const shown = useMemo(() => (value.trim() ? findBuildingMatches(value, index).filter(isPlace).slice(0, MAX_SUGGESTIONS) : []), [value, index]);
    useEffect(() => setActive(0), [value]);
    useEffect(() => {
        if (!open) return undefined;
        const onPointer = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
        document.addEventListener("pointerdown", onPointer);
        return () => document.removeEventListener("pointerdown", onPointer);
    }, [open]);
    const pick = (match) => {
        onPick(match);
        setOpen(false);
    };
    const onKeyDown = (event) => {
        event.stopPropagation(); // typing must not move the camera / avatar
        if (event.key === "ArrowDown" && shown.length) {
            event.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % shown.length);
        } else if (event.key === "ArrowUp" && shown.length) {
            event.preventDefault();
            setActive((i) => (i - 1 + shown.length) % shown.length);
        } else if (event.key === "Enter") {
            event.preventDefault();
            if (open && shown[active]) pick(shown[active]);
        } else if (event.key === "Escape") {
            setOpen(false);
        }
    };
    const listOpen = open && shown.length > 0;
    const listId = `gps-route-${label.toLowerCase()}-list`;
    return (
        <div className="gps-route-test__field" ref={rootRef}>
            <label>
                <span>{label}</span>
                <input
                    value={value}
                    placeholder="Building name or number"
                    autoComplete="off"
                    spellCheck={false}
                    role="combobox"
                    aria-expanded={listOpen}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={listOpen ? `${listId}-${active}` : undefined}
                    onChange={(e) => { onText(e.target.value); setOpen(true); }}
                    onFocus={(e) => { setOpen(true); e.target.select(); }}
                    onKeyDown={onKeyDown}
                    onKeyUp={(e) => e.stopPropagation()}
                />
            </label>
            {listOpen && (
                <ul id={listId} className="gps-route-test__suggest" role="listbox" aria-label={`${label} buildings`}>
                    {shown.map((match, i) => {
                        const { Icon, color, label: kind } = match.kind;
                        const street = match.extra.find((field) => field.key === "street name")?.value;
                        const meta = [match.number && !match.name.startsWith("Building No.") && `No. ${match.number}`, kind, street].filter(Boolean).join(" · ");
                        return (
                            <li key={match.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                                <button
                                    type="button"
                                    className={i === active ? "is-active" : ""}
                                    onMouseEnter={() => setActive(i)}
                                    onPointerDown={(e) => e.preventDefault()}
                                    onClick={() => pick(match)}
                                >
                                    <span className="gps-route-test__badge" style={{ "--kind": color }}><Icon aria-hidden="true" /></span>
                                    <span className="gps-route-test__suggest-text">
                                        <span><Highlight text={match.name} query={value} /></span>
                                        {meta && <small>{meta}</small>}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/** From / To (typed, or picked from the suggestions) and where the path comes from. */
function PlanWalk() {
    const from = useGpsRouteTest((s) => s.from);
    const to = useGpsRouteTest((s) => s.to);
    const pathSource = useGpsRouteTest((s) => s.pathSource);
    const planning = useGpsRouteTest((s) => s.planning);
    const planNote = useGpsRouteTest((s) => s.planNote);
    const { setPlan, plan } = useGpsRouteTest.getState();
    return (
        <div className="gps-route-test__plan">
            <BuildingField label="From" value={from} onText={(text) => setPlan({ from: text, fromId: "" })} onPick={(m) => setPlan({ from: m.name, fromId: m.id })} />
            <BuildingField label="To" value={to} onText={(text) => setPlan({ to: text, toId: "" })} onPick={(m) => setPlan({ to: m.name, toId: m.id })} />
            <div className="gps-route-test__path">
                <span>Path</span>
                <div className="gps-route-test__toggle" role="radiogroup" aria-label="Path">
                    {PATH_SOURCES.map((source) => (
                        <button
                            key={source.id}
                            type="button"
                            role="radio"
                            aria-checked={pathSource === source.id}
                            className={pathSource === source.id ? "is-active" : ""}
                            title={source.title}
                            onClick={() => setPlan({ pathSource: source.id })}
                        >
                            {source.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="gps-route-test__plan-row">
                <button type="button" disabled={planning} onClick={() => plan()}>{planning ? "Planning…" : "Show route"}</button>
                <button type="button" title="Swap From and To" aria-label="Swap From and To" onClick={() => { const st = useGpsRouteTest.getState(); setPlan({ from: st.to, fromId: st.toId, to: st.from, toId: st.fromId }); }}>⇄</button>
            </div>
            {/* Only when Google's route could not be used. */}
            {planNote && !planNote.startsWith("Path:") && <p className="gps-route-test__meta">{planNote}</p>}
        </div>
    );
}

export default function GpsRouteTestPanel({ onStart }) {
    const open = useGpsRouteTest((s) => s.open);
    const route = useGpsRouteTest((s) => s.route);
    const active = useGpsRouteTest((s) => s.active);
    const error = useGpsRouteTest((s) => s.error);
    const progress = useGpsRouteTest((s) => s.progress);
    const arrivedAt = useGpsRouteTest((s) => s.arrivedAt);
    const summary = useGpsRouteTest((s) => s.summary);
    const { stop, close } = useGpsRouteTest.getState();
    const liveStatus = useLiveGps((s) => s.status);
    const accuracy = useLiveGps((s) => s.accuracy);
    const fixes = useLiveGps((s) => s.fixes);
    const liveError = useLiveGps((s) => s.error);
    const phone = useMemo(() => isMobileGpsDevice(), []);

    if (!open) return null;
    const percent = route ? Math.min(100, (progress / Math.max(1, route.length)) * 100) : 0;
    // Google's distance for the walk when the path came from Google, else the line's length.
    const total = route ? route.distance || route.length : 0;
    const walkedM = route ? Math.min(total, (progress / Math.max(1, route.length)) * total) : 0;
    const approximate = active && liveStatus === "live" && fixes >= 3 && accuracy > 100;
    const status = active
        ? liveStatus === "waiting"
            ? "Waiting for GPS…"
            : liveStatus === "error"
                ? liveError
                : arrivedAt ? "Arrived" : ""
        : summary
            ? summary.arrived
                ? `Arrived · ${Math.round(summary.routeLength)} m in ${duration(summary.seconds)}`
                : `Stopped after ${Math.round(summary.walked)} of ${Math.round(summary.routeLength)} m`
            : error;

    return createPortal(
        <section className="gps-route-test" aria-label="GPS route walk">
            <header>
                <strong>{route?.test.label || "Route walk"}</strong>
                <button type="button" className="gps-route-test__close" aria-label="Close" onClick={close}>×</button>
            </header>
            {!active && <PlanWalk />}
            {status && <p className="gps-route-test__status">{status}</p>}
            {approximate && (
                <p className="gps-route-test__warn">
                    Location is only approximate (±{accuracy} m): turn on <strong>Precise location</strong> for this browser.
                </p>
            )}
            {route && (
                <>
                    <div className="gps-route-test__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
                        <span style={{ width: `${percent}%` }} />
                    </div>
                    <p className="gps-route-test__meta">
                        {Math.round(walkedM)} / {Math.round(total)} m
                        {route.duration ? ` · ${active && percent > 0 ? `${minutes(route.duration * (1 - percent / 100))} left` : `${minutes(route.duration)} walk`}` : ""}
                        {route.distance ? " (Google)" : ""}
                    </p>
                </>
            )}
            <div className="gps-route-test__actions">
                {active ? (
                    <button type="button" onClick={() => stop()}>Stop</button>
                ) : (
                    <button
                        type="button"
                        title={phone ? "Walk the route with this phone's GPS" : "Walk the route with simulated GPS"}
                        onClick={() => onStart(phone ? "real" : "sim")}
                    >
                        {phone ? "Walk" : "Simulate"}
                    </button>
                )}
            </div>
        </section>,
        document.body
    );
}
